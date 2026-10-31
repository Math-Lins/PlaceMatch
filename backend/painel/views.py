from datetime import timedelta

from django.db.models import Count, Avg, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.timezone import make_aware
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from usuarios.models import Usuario
from perfis.models import Perfil
from matches.models import Curtida, Match, Compatibilidade
from chat.models import Mensagem
from logs.servicos import registrar
from .exportacao import gerar_csv_response
from .filtros import validar_e_parsear_datas
from .permissoes import AdminPermission

# ─── Catálogo de relatórios ───────────────────────────────────────────────────

RELATORIOS = {
    'matches': {
        'titulo': 'Matches',
        'descricao': 'Listagem de matches no período com métricas de engajamento.',
        'filtros': ['data_inicio', 'data_fim', 'regiao', 'tipo'],
    },
    'compatibilidade-regiao': {
        'titulo': 'Compatibilidade por Região',
        'descricao': 'Estatísticas de compatibilidade e matches agrupados por região.',
        'filtros': ['regiao', 'tipo'],
    },
    'atividade': {
        'titulo': 'Atividade por Dia',
        'descricao': 'Curtidas, recusas, matches e mensagens agrupados por dia.',
        'filtros': ['data_inicio', 'data_fim', 'regiao', 'tipo'],
    },
    'usuarios': {
        'titulo': 'Usuários Cadastrados',
        'descricao': (
            'Usuários cadastrados no período com dados de perfil. Somente administradores.'
        ),
        'filtros': ['data_inicio', 'data_fim', 'tipo'],
    },
    'denuncias': {
        'titulo': 'Denúncias',
        'descricao': 'Listagem de denúncias no período com status e motivo.',
        'filtros': ['data_inicio', 'data_fim', 'status'],
    },
}

# ─── Helpers ──────────────────────────────────────────────────────────────────


def _perfil_ids_filtrados(regiao=None, tipo=None):
    qs = Perfil.objects.all()
    if regiao:
        qs = qs.filter(regiao=regiao)
    if tipo:
        qs = qs.filter(usuario__tipo=tipo)
    return list(qs.values_list('id', flat=True))


def _gerar_serie_datas(periodo_inicio, periodo_fim, dados_qs):
    """
    Zero-fill de uma série temporal.
    dados_qs deve ter colunas 'dia' (TruncDate) e 'total' (Count).
    Retorna lista de {'data': 'AAAA-MM-DD', 'total': int}.
    """
    mapa = {}
    for row in dados_qs:
        d = row['dia']
        if hasattr(d, 'date'):        # datetime
            key = d.date()
        elif isinstance(d, str):      # SQLite às vezes retorna string
            from datetime import date as date_cls
            key = date_cls.fromisoformat(d[:10])
        else:                         # date
            key = d
        mapa[key] = row['total']

    resultado = []
    atual = periodo_inicio.date()
    fim = periodo_fim.date()
    while atual <= fim:
        resultado.append({'data': str(atual), 'total': mapa.get(atual, 0)})
        atual += timedelta(days=1)
    return resultado


# ─── Dashboard ────────────────────────────────────────────────────────────────

class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated, AdminPermission]

    def get(self, request):
        params = request.query_params
        data_inicio, data_fim, erro = validar_e_parsear_datas(params)
        if erro:
            return erro

        regiao = params.get('regiao')
        tipo = params.get('tipo')

        # Período padrão: últimos 30 dias
        agora = timezone.now()
        hoje_inicio = make_aware(
            timezone.datetime(agora.year, agora.month, agora.day, 0, 0, 0)
        )
        periodo_inicio = data_inicio or (hoje_inicio - timedelta(days=29))
        periodo_fim = data_fim or make_aware(
            timezone.datetime(agora.year, agora.month, agora.day, 23, 59, 59)
        )

        # ── Bases filtradas ───────────────────────────────────────────────────
        perfil_ids = _perfil_ids_filtrados(regiao, tipo)

        # ── KPIs ─────────────────────────────────────────────────────────────
        from moderacao.models import Denuncia
        usuarios_total = Usuario.objects.count()

        if tipo:
            usuarios_por_tipo = {tipo: Usuario.objects.filter(tipo=tipo).count()}
        else:
            usuarios_por_tipo = {
                r['tipo']: r['count']
                for r in Usuario.objects.values('tipo').annotate(count=Count('id'))
            }

        perfis_total = Perfil.objects.filter(id__in=perfil_ids).count()

        curtidas_qs = Curtida.objects.filter(
            perfil_origem_id__in=perfil_ids, tipo='curtir'
        )
        recusas_qs = Curtida.objects.filter(
            perfil_origem_id__in=perfil_ids, tipo='recusar'
        )
        matches_qs = Match.objects.filter(
            Q(perfil_a_id__in=perfil_ids) | Q(perfil_b_id__in=perfil_ids)
        )

        curtidas_total = curtidas_qs.count()
        recusas_total = recusas_qs.count()
        matches_total = matches_qs.count()

        # taxa_match = (matches × 2) / curtidas × 100
        # Cada match resulta de 2 curtidas mútuas; matches×2 estima as curtidas
        # que geraram match sobre o total de curtidas positivas.
        if curtidas_total > 0:
            taxa_match = round((matches_total * 2 / curtidas_total) * 100, 2)
        else:
            taxa_match = 0.0

        mensagens_qs = Mensagem.objects.filter(match__in=matches_qs)
        mensagens_total = mensagens_qs.count()
        conversas_ativas = (
            matches_qs.filter(mensagens__isnull=False).distinct().count()
        )
        score_medio = round(
            matches_qs.aggregate(avg=Avg('score'))['avg'] or 0.0, 4
        )

        # ── Séries temporais ──────────────────────────────────────────────────
        matches_dia_qs = (
            Match.objects
            .filter(Q(perfil_a_id__in=perfil_ids) | Q(perfil_b_id__in=perfil_ids))
            .filter(data_match__gte=periodo_inicio, data_match__lte=periodo_fim)
            .annotate(dia=TruncDate('data_match'))
            .values('dia')
            .annotate(total=Count('id'))
            .order_by('dia')
        )
        curtidas_dia_qs = (
            Curtida.objects
            .filter(perfil_origem_id__in=perfil_ids)
            .filter(data__gte=periodo_inicio, data__lte=periodo_fim)
            .annotate(dia=TruncDate('data'))
            .values('dia')
            .annotate(total=Count('id'))
            .order_by('dia')
        )
        mensagens_dia_qs = (
            Mensagem.objects
            .filter(match__in=matches_qs)
            .filter(data_envio__gte=periodo_inicio, data_envio__lte=periodo_fim)
            .annotate(dia=TruncDate('data_envio'))
            .values('dia')
            .annotate(total=Count('id'))
            .order_by('dia')
        )

        matches_por_dia = _gerar_serie_datas(periodo_inicio, periodo_fim, matches_dia_qs)
        curtidas_por_dia = _gerar_serie_datas(periodo_inicio, periodo_fim, curtidas_dia_qs)
        mensagens_por_dia = _gerar_serie_datas(periodo_inicio, periodo_fim, mensagens_dia_qs)

        # ── Top regiões (até 8) ───────────────────────────────────────────────
        top_regioes_qs = list(
            Perfil.objects
            .values('regiao')
            .annotate(perfis=Count('id'))
            .order_by('-perfis')[:8]
        )
        regioes_nomes = [r['regiao'] for r in top_regioes_qs]

        # Carrega IDs por região em uma única query
        perfis_por_regiao: dict[str, list] = {}
        for p in Perfil.objects.filter(regiao__in=regioes_nomes).values('id', 'regiao'):
            perfis_por_regiao.setdefault(p['regiao'], []).append(p['id'])

        # Um match conta para a região dos dois perfis: um match entre perfil de
        # Recife e perfil de Olinda aparece nas estatísticas de AMBAS as regiões.
        top_regioes = []
        for row in top_regioes_qs:
            r = row['regiao']
            ids = perfis_por_regiao.get(r, [])
            agg = Match.objects.filter(
                Q(perfil_a_id__in=ids) | Q(perfil_b_id__in=ids)
            ).aggregate(cnt=Count('id'), avg=Avg('score'))
            top_regioes.append({
                'regiao': r,
                'perfis': row['perfis'],
                'matches': agg['cnt'] or 0,
                # score_medio é null quando não há matches na região (nunca 0.0)
                'score_medio': round(agg['avg'], 4) if agg['avg'] is not None else None,
            })

        # ── Distribuição de score ─────────────────────────────────────────────
        # Score 0..1 → faixas percentuais 0-20, 20-40, 40-60, 60-80, 80-100
        distribuicao_score = []
        faixas = [
            ('0-20',   0.0,  0.2),
            ('20-40',  0.2,  0.4),
            ('40-60',  0.4,  0.6),
            ('60-80',  0.6,  0.8),
            ('80-100', 0.8,  1.001),  # 1.001 inclui score == 1.0
        ]
        for label, minv, maxv in faixas:
            cnt = Compatibilidade.objects.filter(
                score__gte=minv, score__lt=maxv
            ).count()
            distribuicao_score.append({'faixa': label, 'total': cnt})

        filtros_aplicados = {
            k: v for k, v in {
                'data_inicio': params.get('data_inicio'),
                'data_fim': params.get('data_fim'),
                'regiao': regiao,
                'tipo': tipo,
            }.items() if v
        }

        return Response({
            'kpis': {
                'usuarios_total': usuarios_total,
                'usuarios_por_tipo': usuarios_por_tipo,
                'usuarios_suspensos': Usuario.objects.filter(is_active=False).count(),
                'perfis_total': perfis_total,
                'curtidas_total': curtidas_total,
                'recusas_total': recusas_total,
                'matches_total': matches_total,
                'taxa_match': taxa_match,
                'mensagens_total': mensagens_total,
                'conversas_ativas': conversas_ativas,
                'score_medio': score_medio,
                'denuncias_pendentes': Denuncia.objects.filter(status='pendente').count(),
            },
            'series': {
                'matches_por_dia': matches_por_dia,
                'curtidas_por_dia': curtidas_por_dia,
                'mensagens_por_dia': mensagens_por_dia,
            },
            'top_regioes': top_regioes,
            'distribuicao_score': distribuicao_score,
            'filtros_aplicados': filtros_aplicados,
        })


# ─── Relatórios ───────────────────────────────────────────────────────────────

def _dados_relatorio_matches(data_inicio, data_fim, regiao, tipo):
    qs = Match.objects.select_related(
        'perfil_a', 'perfil_a__usuario',
        'perfil_b', 'perfil_b__usuario',
    ).annotate(qtd_mensagens=Count('mensagens'))

    if data_inicio:
        qs = qs.filter(data_match__gte=data_inicio)
    if data_fim:
        qs = qs.filter(data_match__lte=data_fim)
    if regiao:
        qs = qs.filter(
            Q(perfil_a__regiao=regiao) | Q(perfil_b__regiao=regiao)
        )
    if tipo:
        qs = qs.filter(
            Q(perfil_a__usuario__tipo=tipo) | Q(perfil_b__usuario__tipo=tipo)
        )

    colunas = [
        'Data', 'Perfil A', 'Perfil B', 'Região A', 'Região B',
        'Score (%)', 'Mensagens', 'Ativa',
    ]
    linhas = []
    totais = {'matches': 0, 'mensagens': 0}

    for m in qs.order_by('-data_match'):
        ativa = 'sim' if m.qtd_mensagens > 0 else 'não'
        linhas.append([
            str(m.data_match.date()),
            m.perfil_a.nome,
            m.perfil_b.nome,
            m.perfil_a.regiao,
            m.perfil_b.regiao,
            round(m.score * 100, 2),
            m.qtd_mensagens,
            ativa,
        ])
        totais['matches'] += 1
        totais['mensagens'] += m.qtd_mensagens

    return colunas, linhas, totais


def _dados_relatorio_compatibilidade_regiao(regiao, tipo):
    perfis_qs = Perfil.objects.all()
    if tipo:
        perfis_qs = perfis_qs.filter(usuario__tipo=tipo)

    regioes_qs = list(
        perfis_qs.values('regiao').annotate(perfis=Count('id')).order_by('-perfis')
    )
    if regiao:
        regioes_qs = [r for r in regioes_qs if r['regiao'] == regiao]

    regioes_nomes = [r['regiao'] for r in regioes_qs]
    perfis_por_regiao: dict[str, list] = {}
    for p in Perfil.objects.filter(regiao__in=regioes_nomes).values('id', 'regiao'):
        perfis_por_regiao.setdefault(p['regiao'], []).append(p['id'])

    colunas = [
        'Região', 'Perfis', 'Compatibilidades', 'Score (%)',
        'Matches (participações)', 'Perfis com match (%)',
    ]
    linhas = []
    totais = {'perfis': 0, 'compatibilidades': 0, 'matches': 0}
    all_match_ids: set = set()

    for row in regioes_qs:
        r = row['regiao']
        ids = perfis_por_regiao.get(r, [])
        compats = Compatibilidade.objects.filter(
            Q(perfil_a_id__in=ids) | Q(perfil_b_id__in=ids)
        ).aggregate(cnt=Count('id'), avg=Avg('score'))

        region_match_ids = set(
            Match.objects.filter(
                Q(perfil_a_id__in=ids) | Q(perfil_b_id__in=ids)
            ).values_list('id', flat=True)
        )
        all_match_ids.update(region_match_ids)

        n_perfis = row['perfis']
        n_compats = compats['cnt'] or 0
        n_matches = len(region_match_ids)
        # score em % (0-1 → 0-100); null quando não há compatibilidades
        score_pct = round(compats['avg'] * 100, 2) if compats['avg'] is not None else None

        # perfis_com_match_pct: perfis da região com ≥ 1 match ÷ total perfis × 100
        if n_perfis > 0 and region_match_ids:
            perfis_com_match = Perfil.objects.filter(
                Q(id__in=ids) & (
                    Q(matches_como_a__in=region_match_ids) |
                    Q(matches_como_b__in=region_match_ids)
                )
            ).distinct().count()
            perfis_com_match_pct = round(min(perfis_com_match / n_perfis * 100, 100.0), 2)
        else:
            perfis_com_match_pct = 0.0

        linhas.append([
            r, n_perfis, n_compats,
            score_pct if score_pct is not None else '',
            n_matches, perfis_com_match_pct,
        ])
        totais['perfis'] += n_perfis
        totais['compatibilidades'] += n_compats

    # matches é a contagem DISTINTA (não a soma por região)
    totais['matches'] = len(all_match_ids)

    return colunas, linhas, totais


def _agg_por_dia_mapa(qs, campo_data):
    """Retorna dict {date: total} a partir de queryset com TruncDate."""
    from datetime import date as date_cls
    resultado = {}
    for row in (
        qs.annotate(dia=TruncDate(campo_data))
          .values('dia')
          .annotate(total=Count('id'))
    ):
        d = row['dia']
        if hasattr(d, 'date'):
            key = d.date()
        elif isinstance(d, str):
            key = date_cls.fromisoformat(d[:10])
        else:
            key = d
        resultado[key] = row['total']
    return resultado


def _dados_relatorio_atividade(data_inicio, data_fim, regiao, tipo):
    perfil_ids = _perfil_ids_filtrados(regiao, tipo)

    curtidas_base = Curtida.objects.filter(perfil_origem_id__in=perfil_ids)
    matches_base = Match.objects.filter(
        Q(perfil_a_id__in=perfil_ids) | Q(perfil_b_id__in=perfil_ids)
    )
    mensagens_base = Mensagem.objects.filter(match__in=matches_base)

    if data_inicio:
        curtidas_base = curtidas_base.filter(data__gte=data_inicio)
        matches_base = matches_base.filter(data_match__gte=data_inicio)
        mensagens_base = mensagens_base.filter(data_envio__gte=data_inicio)
    if data_fim:
        curtidas_base = curtidas_base.filter(data__lte=data_fim)
        matches_base = matches_base.filter(data_match__lte=data_fim)
        mensagens_base = mensagens_base.filter(data_envio__lte=data_fim)

    curtidas_dia = _agg_por_dia_mapa(curtidas_base.filter(tipo='curtir'), 'data')
    recusas_dia = _agg_por_dia_mapa(curtidas_base.filter(tipo='recusar'), 'data')
    matches_dia = _agg_por_dia_mapa(matches_base, 'data_match')
    msgs_dia = _agg_por_dia_mapa(mensagens_base, 'data_envio')

    todos_dias = sorted(
        set(curtidas_dia) | set(recusas_dia) | set(matches_dia) | set(msgs_dia)
    )

    colunas = ['Data', 'Curtidas', 'Recusas', 'Matches', 'Mensagens']
    linhas = []
    totais = {'curtidas': 0, 'recusas': 0, 'matches': 0, 'mensagens': 0}

    for d in todos_dias:
        c = curtidas_dia.get(d, 0)
        r = recusas_dia.get(d, 0)
        m = matches_dia.get(d, 0)
        msg = msgs_dia.get(d, 0)
        linhas.append([str(d), c, r, m, msg])
        totais['curtidas'] += c
        totais['recusas'] += r
        totais['matches'] += m
        totais['mensagens'] += msg

    return colunas, linhas, totais


def _dados_relatorio_usuarios(data_inicio, data_fim, tipo):
    qs = Usuario.objects.all()
    if data_inicio:
        qs = qs.filter(date_joined__gte=data_inicio)
    if data_fim:
        qs = qs.filter(date_joined__lte=data_fim)
    if tipo:
        qs = qs.filter(tipo=tipo)

    qs = qs.select_related('perfil').order_by('date_joined')

    colunas = [
        'Data de Cadastro', 'Nome', 'E-mail', 'Tipo', 'Região', 'Tem Perfil',
    ]
    linhas = []
    totais = {'usuarios': 0, 'com_perfil': 0}

    for u in qs:
        try:
            p = u.perfil
            regiao = p.regiao
            tem_perfil = 'sim'
            totais['com_perfil'] += 1
        except Exception:
            regiao = ''
            tem_perfil = 'não'

        linhas.append([
            str(u.date_joined.date()),
            u.get_full_name() or u.username,
            u.email,
            u.tipo,
            regiao,
            tem_perfil,
        ])
        totais['usuarios'] += 1

    return colunas, linhas, totais


def _dados_relatorio_denuncias(data_inicio, data_fim):
    from moderacao.models import Denuncia
    qs = Denuncia.objects.select_related('denunciante', 'denunciado', 'resolvida_por')
    if data_inicio:
        qs = qs.filter(criada_em__gte=data_inicio)
    if data_fim:
        qs = qs.filter(criada_em__lte=data_fim)

    colunas = ['Data', 'Denunciante', 'Denunciado', 'Motivo', 'Status', 'Resolvida Por']
    linhas = []
    totais = {'total': 0, 'pendentes': 0, 'resolvidas': 0, 'descartadas': 0}

    for d in qs.order_by('-criada_em'):
        linhas.append([
            str(d.criada_em.date()),
            d.denunciante.email if d.denunciante else '',
            d.denunciado.email,
            d.get_motivo_display(),
            d.status,
            d.resolvida_por.email if d.resolvida_por else '',
        ])
        totais['total'] += 1
        if d.status == 'pendente':
            totais['pendentes'] += 1
        elif d.status == 'resolvida':
            totais['resolvidas'] += 1
        elif d.status == 'descartada':
            totais['descartadas'] += 1

    return colunas, linhas, totais


def _obter_dados_relatorio(rel_id, data_inicio, data_fim, regiao, tipo):
    if rel_id == 'matches':
        return _dados_relatorio_matches(data_inicio, data_fim, regiao, tipo)
    if rel_id == 'compatibilidade-regiao':
        return _dados_relatorio_compatibilidade_regiao(regiao, tipo)
    if rel_id == 'atividade':
        return _dados_relatorio_atividade(data_inicio, data_fim, regiao, tipo)
    if rel_id == 'usuarios':
        return _dados_relatorio_usuarios(data_inicio, data_fim, tipo)
    if rel_id == 'denuncias':
        return _dados_relatorio_denuncias(data_inicio, data_fim)
    return None, None, None


class RelatoriosCatalogoView(APIView):
    permission_classes = [permissions.IsAuthenticated, AdminPermission]

    def get(self, request):
        catalogo = [
            {'id': rid, **info}
            for rid, info in RELATORIOS.items()
        ]
        return Response(catalogo)


class RelatorioDetalheView(APIView):
    permission_classes = [permissions.IsAuthenticated, AdminPermission]

    def get(self, request, rel_id):
        if rel_id not in RELATORIOS:
            return Response(
                {'detail': f'Relatório "{rel_id}" não encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        params = request.query_params
        data_inicio, data_fim, erro = validar_e_parsear_datas(params)
        if erro:
            return erro

        regiao = params.get('regiao')
        tipo = params.get('tipo')
        formato = params.get('formato', 'json').lower()

        colunas, linhas, totais = _obter_dados_relatorio(
            rel_id, data_inicio, data_fim, regiao, tipo
        )

        filtros_aplicados = {
            k: v for k, v in {
                'data_inicio': params.get('data_inicio'),
                'data_fim': params.get('data_fim'),
                'regiao': regiao,
                'tipo': tipo,
            }.items() if v
        }

        if formato == 'csv':
            registrar(
                'RELATORIO_EXPORTADO',
                usuario=request.user,
                entidade='relatorio',
                entidade_id=None,
                detalhes={'relatorio': rel_id, 'filtros': filtros_aplicados},
                request=request,
            )
            return gerar_csv_response(colunas, linhas, rel_id)

        return Response({
            'titulo': RELATORIOS[rel_id]['titulo'],
            'colunas': colunas,
            'linhas': linhas,
            'totais': totais,
            'filtros_aplicados': filtros_aplicados,
            'gerado_em': timezone.now(),
        })


# ─── Administração de usuários ────────────────────────────────────────────────

def _serializar_usuario_admin(u):
    try:
        regiao = u.perfil.regiao
        tem_perfil = True
    except Exception:
        regiao = None
        tem_perfil = False
    return {
        'id': u.id,
        'nome': u.get_full_name() or u.username,
        'email': u.email,
        'tipo': u.tipo,
        'regiao': regiao,
        'data_cadastro': u.date_joined,
        'tem_perfil': tem_perfil,
        'ativo': u.is_active,
    }


def _filtrar_usuarios(params, data_inicio, data_fim):
    qs = Usuario.objects.select_related('perfil').order_by('-date_joined')

    q = params.get('q')
    if q:
        qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q))

    tipo = params.get('tipo')
    if tipo:
        qs = qs.filter(tipo=tipo)

    regiao = params.get('regiao')
    if regiao:
        qs = qs.filter(perfil__regiao=regiao)

    ativo = params.get('ativo')
    if ativo is not None:
        qs = qs.filter(is_active=(ativo.lower() == 'true'))

    if data_inicio:
        qs = qs.filter(date_joined__gte=data_inicio)
    if data_fim:
        qs = qs.filter(date_joined__lte=data_fim)

    return qs


class AdminUsuariosView(APIView):
    permission_classes = [permissions.IsAuthenticated, AdminPermission]

    def get(self, request):
        params = request.query_params
        data_inicio, data_fim, erro = validar_e_parsear_datas(params)
        if erro:
            return erro

        qs = _filtrar_usuarios(params, data_inicio, data_fim)

        try:
            page = max(1, int(params.get('page', 1)))
        except (ValueError, TypeError):
            page = 1
        try:
            page_size = min(100, max(1, int(params.get('page_size', 20))))
        except (ValueError, TypeError):
            page_size = 20

        count = qs.count()
        offset = (page - 1) * page_size
        usuarios = qs[offset:offset + page_size]

        return Response({
            'count': count,
            'page': page,
            'results': [_serializar_usuario_admin(u) for u in usuarios],
        })


class AdminUsuariosExportarView(APIView):
    permission_classes = [permissions.IsAuthenticated, AdminPermission]

    def get(self, request):
        params = request.query_params
        data_inicio, data_fim, erro = validar_e_parsear_datas(params)
        if erro:
            return erro

        qs = _filtrar_usuarios(params, data_inicio, data_fim)

        cabecalho = [
            'ID', 'Nome', 'E-mail', 'Tipo', 'Região',
            'Data de Cadastro', 'Tem Perfil',
        ]
        linhas = []
        for u in qs:
            try:
                regiao = u.perfil.regiao
                tem_perfil = 'sim'
            except Exception:
                regiao = ''
                tem_perfil = 'não'
            linhas.append([
                u.id,
                u.get_full_name() or u.username,
                u.email,
                u.tipo,
                regiao,
                str(u.date_joined.date()),
                tem_perfil,
            ])

        filtros_usados = {k: v for k, v in params.items()}
        registrar(
            'RELATORIO_EXPORTADO',
            usuario=request.user,
            entidade='usuario',
            detalhes={'filtros': filtros_usados},
            request=request,
        )

        return gerar_csv_response(cabecalho, linhas, 'usuarios')
