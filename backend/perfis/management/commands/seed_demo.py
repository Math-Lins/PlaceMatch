"""
python manage.py seed_demo

Prepara um banco de DEMONSTRAÇÃO completo (use só em banco descartável ou de desenvolvimento):
  1. perfis (seed_perfis), matches (seed_matches) e conversas (seed_mensagens);
  2. datas espalhadas nos últimos 30 dias (cadastros, curtidas, matches e mensagens),
     para o painel admin ter gráficos com movimento;
  3. uma curtida pendente (Henrique → Ana) para demonstrar o interesse mútuo;
  4. três denúncias (duas pendentes e uma procedente) e uma conta suspensa (Guilherme);
  5. registros de log coerentes com os dados criados;
  6. embeddings das bios (Afinidade por IA) e recálculo das compatibilidades (gerar_embeddings).
     Sem o modelo de IA, avisa e segue com os 6 critérios.

Idempotente: rodar de novo não duplica denúncias nem logs (são recriados).

  --remover-outros   apaga antes todos os usuários que não são seed nem administrador
                     (ex.: contas criadas pelos testes e2e). SÓ em banco descartável.
A senha dos usuários seed é a definida em seed_perfis (não é impressa).
"""

import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from chat.models import Mensagem
from logs.models import LogOperacao
from matches.models import Curtida, Match
from moderacao.models import Denuncia
from perfis.models import Perfil

User = get_user_model()
SEED_TAG = '__seed__'

# (denunciante, denunciado, motivo, descrição, decisão do admin ou None se pendente)
DENUNCIAS = [
    ('fernanda@seed.pm', 'pedro@seed.pm', 'spam',
     'Recebi várias mensagens repetidas oferecendo um curso que não tem relação com moradia.', None),
    ('clara@seed.pm', 'marcos@seed.pm', 'ofensivo',
     'Usou palavras desrespeitosas quando recusei a proposta de dividir a casa.', None),
    ('vitoria@seed.pm', 'guilherme@seed.pm', 'falso',
     'As fotos e a idade do perfil não batem com a pessoa que encontrei na visita.', 'resolvida'),
]
SUSPENSO = 'guilherme@seed.pm'


def _perfil(email):
    return Perfil.objects.select_related('usuario').get(usuario__email=email)


class Command(BaseCommand):
    help = 'Popula o banco com dados de demonstração coerentes (perfis, matches, conversas, denúncias).'

    def add_arguments(self, parser):
        parser.add_argument('--remover-outros', action='store_true',
                            help='Apaga usuários que não são seed nem administrador (banco descartável).')

    def handle(self, *args, **options):
        rnd = random.Random(2026)
        if options['remover_outros']:
            outros = User.objects.exclude(username__endswith=SEED_TAG).exclude(tipo='administrador')
            n = outros.count()
            outros.delete()
            LogOperacao.objects.filter(usuario__isnull=True).delete()
            self.stdout.write(self.style.WARNING(f'Removidos {n} usuários que não são de demonstração.'))
        agora = timezone.now()

        call_command('seed_perfis', stdout=self.stdout)
        call_command('seed_matches', stdout=self.stdout)
        call_command('seed_mensagens', stdout=self.stdout)

        with transaction.atomic():
            seeds = list(User.objects.filter(username__endswith=SEED_TAG).order_by('id'))
            perfis = Perfil.objects.filter(usuario__in=seeds)

            # ── 1. Cadastros espalhados nos últimos 30 dias ──────────────────────
            for i, u in enumerate(seeds):
                u.date_joined = agora - timedelta(days=30 - i, hours=rnd.randint(0, 10))
                u.save(update_fields=['date_joined'])

            # ── 2. Curtida pendente: Henrique já curtiu a Ana (Ana ainda não respondeu) ──
            henrique, ana = _perfil('henrique@seed.pm'), _perfil('ana@seed.pm')
            # (desfaz um interesse mútuo criado numa demonstração anterior)
            Curtida.objects.filter(perfil_origem=ana, perfil_destino=henrique).delete()
            Match.objects.filter(Q(perfil_a=ana, perfil_b=henrique) | Q(perfil_a=henrique, perfil_b=ana)).delete()
            Curtida.objects.get_or_create(perfil_origem=henrique, perfil_destino=ana, defaults={'tipo': 'curtir'})

            # ── 3. Curtidas, matches e mensagens com datas realistas ─────────────
            curtidas = Curtida.objects.filter(perfil_origem__in=perfis, perfil_destino__in=perfis)
            for c in curtidas:
                Curtida.objects.filter(pk=c.pk).update(data=agora - timedelta(days=rnd.randint(2, 20), hours=rnd.randint(0, 12)))
            matches = Match.objects.filter(Q(perfil_a__in=perfis) | Q(perfil_b__in=perfis))
            for m in matches:
                # o match acontece depois da última curtida do par
                ultima = Curtida.objects.filter(
                    Q(perfil_origem=m.perfil_a, perfil_destino=m.perfil_b) | Q(perfil_origem=m.perfil_b, perfil_destino=m.perfil_a)
                ).order_by('-data').first()
                quando = (ultima.data if ultima else agora - timedelta(days=10)) + timedelta(hours=rnd.randint(1, 20))
                quando = min(quando, agora - timedelta(hours=3))
                Match.objects.filter(pk=m.pk).update(data_match=quando)
                # mensagens em sequência, a partir do match (a última conversa fica para "hoje")
                msgs = list(Mensagem.objects.filter(match=m).order_by('id'))
                inicio = max(quando + timedelta(hours=1), agora - timedelta(days=2)) if m.mensagens.exists() else quando
                for j, msg in enumerate(msgs):
                    Mensagem.objects.filter(pk=msg.pk).update(data_envio=inicio + timedelta(minutes=17 * j + rnd.randint(0, 9)))

            # ── 4. Denúncias e conta suspensa ────────────────────────────────────
            admin = User.objects.filter(tipo='administrador').order_by('id').first()
            antigas = list(Denuncia.objects.filter(denunciante__in=seeds).values_list('id', flat=True))
            Denuncia.objects.filter(id__in=antigas).delete()
            for i, (de, contra, motivo, descricao, decisao) in enumerate(DENUNCIAS):
                d = Denuncia.objects.create(
                    denunciante=User.objects.get(email=de), denunciado=User.objects.get(email=contra),
                    motivo=motivo, descricao=descricao,
                )
                if decisao and admin:
                    d.status = decisao
                    d.resolvida_por = admin
                    d.resolucao = 'Perfil falso confirmado pela moderação; conta suspensa.'
                    d.save()
                Denuncia.objects.filter(pk=d.pk).update(criada_em=agora - timedelta(days=6 - 2 * i, hours=rnd.randint(1, 8)))
            User.objects.filter(email=SUSPENSO).update(is_active=False)

            # ── 5. Logs coerentes com os dados de demonstração ───────────────────
            # Recria só os logs da demonstração: os dos usuários seed e os do admin sobre eles.
            LogOperacao.objects.filter(usuario__in=seeds).delete()
            LogOperacao.objects.filter(acao='DENUNCIA_RESOLVIDA', entidade_id__in=antigas).delete()
            LogOperacao.objects.filter(acao='USUARIO_SUSPENSO', entidade_id__in=[u.id for u in seeds]).delete()
            registros = []
            for u in seeds:
                registros.append(LogOperacao(acao='CADASTRO', usuario=u, entidade='usuario', entidade_id=u.id,
                                             detalhes={'tipo': u.tipo}, data_hora=u.date_joined))
                registros.append(LogOperacao(acao='PERFIL_CRIADO', usuario=u, entidade='perfil', entidade_id=getattr(getattr(u, 'perfil', None), 'id', None),
                                             detalhes={}, data_hora=u.date_joined + timedelta(minutes=8)))
            for m in Match.objects.filter(pk__in=matches.values('pk')).select_related('perfil_a__usuario'):
                registros.append(LogOperacao(acao='MATCH_CRIADO', usuario=m.perfil_a.usuario, entidade='match', entidade_id=m.id,
                                             detalhes={'match_id': m.id, 'score': round(m.score, 4)}, data_hora=m.data_match))
            for d in Denuncia.objects.filter(denunciante__in=seeds):
                registros.append(LogOperacao(acao='DENUNCIA_CRIADA', usuario=d.denunciante, entidade='denuncia', entidade_id=d.id,
                                             detalhes={'denunciado_id': d.denunciado_id, 'motivo': d.motivo}, data_hora=d.criada_em))
                if d.status != 'pendente' and admin:
                    registros.append(LogOperacao(acao='DENUNCIA_RESOLVIDA', usuario=admin, entidade='denuncia', entidade_id=d.id,
                                                 detalhes={'novo_status': d.status, 'denunciado_id': d.denunciado_id},
                                                 data_hora=d.criada_em + timedelta(hours=5)))
                    registros.append(LogOperacao(acao='USUARIO_SUSPENSO', usuario=admin, entidade='usuario', entidade_id=d.denunciado_id,
                                                 detalhes={'motivo': 'Denúncia procedente: perfil falso.', 'email': d.denunciado.email},
                                                 data_hora=d.criada_em + timedelta(hours=5, minutes=2)))
            criados = LogOperacao.objects.bulk_create(registros)
            # data_hora é auto_now_add: grava a data histórica depois de criar.
            for reg, orig in zip(criados, registros):
                LogOperacao.objects.filter(pk=reg.pk).update(data_hora=orig.data_hora)

        # ── 6. Afinidade por IA: embeddings das bios + recálculo dos scores ──────
        from ia import servico
        if servico.disponivel(carregar=True):
            call_command('gerar_embeddings', stdout=self.stdout)
        else:
            self.stdout.write(self.style.WARNING(
                'Modelo de IA indisponível: os scores usam só os 6 critérios. '
                'Rode "python manage.py baixar_modelo_ia" e depois "python manage.py gerar_embeddings".'))

        self.stdout.write(self.style.SUCCESS(
            f'\nDemonstração pronta: {len(seeds)} usuários, {matches.count()} matches, '
            f'{Mensagem.objects.filter(match__in=matches).count()} mensagens, {len(DENUNCIAS)} denúncias, '
            f'1 conta suspensa ({SUSPENSO}).'
        ))
