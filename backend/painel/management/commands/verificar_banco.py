"""Confere a consistência dos dados do banco e imprime um relatório com contagens.

Uso:
    python manage.py verificar_banco               # relatório com contagens
    python manage.py verificar_banco --detalhes    # lista também os ids afetados (até --limite)
    python manage.py verificar_banco --falhar      # sai com erro (código 1) se houver problemas do tipo ERRO

Gravidades: OK (nada a fazer), AVISO (pode ser legítimo, vale conferir) e ERRO (dado inconsistente).
Somente leitura: o comando nunca altera o banco.
"""
from itertools import product

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.models import Exists, F, OuterRef, Q

from chat.models import Mensagem
from logs.models import LogOperacao
from matches.models import Compatibilidade, Curtida, Match
from moderacao.models import Denuncia
from perfis.models import Perfil
from usuarios.models import Usuario


class Resultado:
    def __init__(self, nome, gravidade, total, ids=None, dica=''):
        self.nome = nome
        self.gravidade = gravidade if total else 'OK'
        self.total = total
        self.ids = ids or []
        self.dica = dica


def _orfaos(modelo, campo, relacionado):
    """Registros cuja FK `campo` aponta para um id que não existe em `relacionado`."""
    return modelo.objects.filter(**{f'{campo}__isnull': False}).exclude(
        **{f'{campo}__in': relacionado.objects.values('pk')}
    )


def _resultado(nome, queryset, gravidade, limite, dica='', campo='id'):
    total = queryset.count()
    ids = list(queryset.values_list(campo, flat=True)[:limite]) if total else []
    return Resultado(nome, gravidade, total, ids, dica)


class Command(BaseCommand):
    help = 'Confere a consistência dos dados (órfãos, matches, pares, compatibilidade, mensagens, perfis) e imprime um relatório.'

    def add_arguments(self, parser):
        parser.add_argument('--detalhes', action='store_true', help='lista os ids afetados')
        parser.add_argument('--limite', type=int, default=10, help='máximo de ids listados por verificação (padrão 10)')
        parser.add_argument('--falhar', action='store_true', help='termina com erro se houver problemas de gravidade ERRO')

    # ── verificações ────────────────────────────────────────────────────────────

    def _verificacoes(self, limite):
        r = []

        # 1. Órfãos: FK apontando para registro inexistente
        orfaos = [
            ('Perfil → usuário', _orfaos(Perfil, 'usuario_id', Usuario)),
            ('Compatibilidade → perfil_a', _orfaos(Compatibilidade, 'perfil_a_id', Perfil)),
            ('Compatibilidade → perfil_b', _orfaos(Compatibilidade, 'perfil_b_id', Perfil)),
            ('Curtida → perfil_origem', _orfaos(Curtida, 'perfil_origem_id', Perfil)),
            ('Curtida → perfil_destino', _orfaos(Curtida, 'perfil_destino_id', Perfil)),
            ('Match → perfil_a', _orfaos(Match, 'perfil_a_id', Perfil)),
            ('Match → perfil_b', _orfaos(Match, 'perfil_b_id', Perfil)),
            ('Mensagem → match', _orfaos(Mensagem, 'match_id', Match)),
            ('Mensagem → remetente', _orfaos(Mensagem, 'remetente_id', Perfil)),
            ('Denúncia → denunciado', _orfaos(Denuncia, 'denunciado_id', Usuario)),
            ('Denúncia → denunciante', _orfaos(Denuncia, 'denunciante_id', Usuario)),
            ('Denúncia → resolvida_por', _orfaos(Denuncia, 'resolvida_por_id', Usuario)),
            ('Log → usuário', _orfaos(LogOperacao, 'usuario_id', Usuario)),
        ]
        total = sum(qs.count() for _, qs in orfaos)
        detalhe = [f'{nome}={qs.count()}' for nome, qs in orfaos if qs.count()]
        r.append(Resultado('Registros órfãos (FK para registro inexistente)', 'ERRO', total,
                           detalhe, 'Só ocorre com restrições de FK desligadas ou carga manual.'))

        # 2. Matches sem curtida mútua
        c_ab = Curtida.objects.filter(perfil_origem=OuterRef('perfil_a'), perfil_destino=OuterRef('perfil_b'), tipo='curtir')
        c_ba = Curtida.objects.filter(perfil_origem=OuterRef('perfil_b'), perfil_destino=OuterRef('perfil_a'), tipo='curtir')
        sem_mutua = Match.objects.annotate(ab=Exists(c_ab), ba=Exists(c_ba)).filter(Q(ab=False) | Q(ba=False))
        r.append(_resultado('Matches sem curtida mútua', sem_mutua, 'ERRO', limite,
                            'Um match só nasce quando as duas pessoas se curtem.'))

        # 3. Pares duplicados ou invertidos (Match e Compatibilidade)
        for rotulo, modelo in (('Match', Match), ('Compatibilidade', Compatibilidade)):
            vistos, duplicados, invertidos = {}, [], []
            for pk, a, b in modelo.objects.values_list('id', 'perfil_a_id', 'perfil_b_id'):
                chave = frozenset((a, b))
                if chave in vistos:
                    duplicados.append(pk)
                vistos[chave] = pk
                if a > b:
                    invertidos.append(pk)
            r.append(Resultado(f'{rotulo}: pares duplicados (A,B) e (B,A)', 'ERRO', len(duplicados), duplicados[:limite]))
            r.append(Resultado(f'{rotulo}: pares invertidos (perfil_a > perfil_b)', 'AVISO', len(invertidos), invertidos[:limite],
                               'O sistema grava sempre o menor id em perfil_a.'))

        # 4. Compatibilidade faltando para pares de tipos opostos (e sobrando)
        buscando = set(Perfil.objects.filter(usuario__tipo='buscando_vaga').values_list('id', flat=True))
        oferecendo = set(Perfil.objects.filter(usuario__tipo='oferecendo_vaga').values_list('id', flat=True))
        existentes, sobrando = set(), 0
        for pk, a, b in Compatibilidade.objects.values_list('id', 'perfil_a_id', 'perfil_b_id'):
            if (a in buscando and b in oferecendo) or (a in oferecendo and b in buscando):
                existentes.add(frozenset((a, b)))
            else:
                sobrando += 1
        faltando = len(buscando) * len(oferecendo) - len(existentes)
        amostra = []
        if faltando and limite:
            for b, o in product(sorted(buscando), sorted(oferecendo)):
                if frozenset((b, o)) not in existentes:
                    amostra.append(f'{min(b, o)}-{max(b, o)}')
                    if len(amostra) >= limite:
                        break
        r.append(Resultado('Compatibilidade faltando entre perfis de tipos opostos', 'ERRO', faltando, amostra,
                           'Corrija com: python manage.py recalcular_compatibilidades'))
        r.append(Resultado('Compatibilidade entre perfis que não são de tipos opostos', 'AVISO', sobrando))

        # 5. Mensagens de quem não participa do match
        intrusas = Mensagem.objects.exclude(remetente_id=F('match__perfil_a_id')).exclude(remetente_id=F('match__perfil_b_id'))
        r.append(_resultado('Mensagens enviadas por quem não participa do match', intrusas, 'ERRO', limite))

        # 6. Usuários comuns sem perfil / administrador com perfil
        sem_perfil = Usuario.objects.exclude(tipo='administrador').filter(perfil__isnull=True)
        r.append(_resultado('Usuários comuns sem perfil', sem_perfil, 'AVISO', limite,
                            'Pode ser um cadastro recente que ainda não concluiu o perfil.'))
        admin_com_perfil = Usuario.objects.filter(tipo='administrador', perfil__isnull=False)
        r.append(_resultado('Administradores com perfil', admin_com_perfil, 'ERRO', limite,
                            'O administrador não participa do matching.'))

        # 7. Avaliações entre perfis do mesmo tipo
        mesmo_tipo_c = Curtida.objects.filter(perfil_origem__usuario__tipo=F('perfil_destino__usuario__tipo'))
        r.append(_resultado('Curtidas entre perfis do mesmo tipo', mesmo_tipo_c, 'ERRO', limite))
        mesmo_tipo_m = Match.objects.filter(perfil_a__usuario__tipo=F('perfil_b__usuario__tipo'))
        r.append(_resultado('Matches entre perfis do mesmo tipo', mesmo_tipo_m, 'ERRO', limite))

        # 8. Matches/perfis envolvendo contas suspensas (informativo)
        suspensos = Match.objects.filter(Q(perfil_a__usuario__is_active=False) | Q(perfil_b__usuario__is_active=False))
        r.append(_resultado('Matches com conta suspensa (ocultos na API)', suspensos, 'AVISO', limite,
                            'Esperado enquanto a conta estiver suspensa.'))
        return r

    # ── saída ───────────────────────────────────────────────────────────────────

    def handle(self, *args, **opts):
        limite = max(0, opts['limite'])
        banco = connection.settings_dict
        self.stdout.write('VERIFICAÇÃO DO BANCO — PlaceMatch')
        self.stdout.write(f"Banco: {banco.get('NAME')} ({connection.vendor}) em {banco.get('HOST') or 'local'}:{banco.get('PORT') or '-'}")
        contagens = {
            'usuarios': Usuario.objects.count(), 'perfis': Perfil.objects.count(),
            'compatibilidades': Compatibilidade.objects.count(), 'curtidas': Curtida.objects.count(),
            'matches': Match.objects.count(), 'mensagens': Mensagem.objects.count(),
            'denuncias': Denuncia.objects.count(), 'logs': LogOperacao.objects.count(),
        }
        self.stdout.write('Registros: ' + ' | '.join(f'{k}={v}' for k, v in contagens.items()))
        self.stdout.write('')

        resultados = self._verificacoes(limite)
        for i, res in enumerate(resultados, 1):
            self.stdout.write(f'[{res.gravidade:<5}] {i:>2}. {res.nome}: {res.total}')
            if res.total and res.dica:
                self.stdout.write(f'          dica: {res.dica}')
            if res.total and opts['detalhes'] and res.ids:
                self.stdout.write(f'          ids/itens: {", ".join(str(x) for x in res.ids)}')

        erros = sum(1 for x in resultados if x.gravidade == 'ERRO')
        avisos = sum(1 for x in resultados if x.gravidade == 'AVISO')
        oks = sum(1 for x in resultados if x.gravidade == 'OK')
        self.stdout.write('')
        self.stdout.write(f'Resumo: {len(resultados)} verificações — {oks} OK, {avisos} aviso(s), {erros} erro(s).')
        if opts['falhar'] and erros:
            raise CommandError(f'{erros} verificação(ões) com ERRO.')
