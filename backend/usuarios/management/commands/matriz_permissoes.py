"""
Management command: matriz_permissoes

Cria um banco de teste efêmero (via Django TestRunner), executa chamadas HTTP
contra as rotas da API para quatro perfis de acesso (anônimo, buscando_vaga,
oferecendo_vaga, administrador) e imprime uma tabela rota × perfil.

Uso:
    python manage.py matriz_permissoes [--settings=placematch.test_settings]

O banco é destruído automaticamente ao final (sem alterar dados reais).
"""
import sys

from django.core.management.base import BaseCommand
from django.test import override_settings
from django.test.runner import DiscoverRunner
from rest_framework.test import APIClient

# ─── Dados de teste ───────────────────────────────────────────────────────────

_PERFIL_BASE = dict(
    nome='Matriz', idade=25, regiao='Recife', bio='',
    orcamento_min=500, orcamento_max=1500,
    fumante=False, aceita_pets=True,
    tolerancia_bagunca=3, nivel_organizacao=3,
    perfil_horario='flexivel',
    nivel_ruido=3, nivel_social=3,
    aceita_visitas='as_vezes',
    tipo_imovel='apartamento',
    qtd_moradores=2,
)


def _usuario(email, tipo, senha='Teste@1234'):
    from django.contrib.auth import get_user_model
    U = get_user_model()
    return U.objects.create_user(
        username=email.replace('@', '_').replace('.', '_'),
        email=email, password=senha, tipo=tipo,
    )


def _perfil(usuario):
    from perfis.models import Perfil
    return Perfil.objects.create(usuario=usuario, **_PERFIL_BASE)


def _match(pa, pb):
    from matches.models import Match
    a, b = min(pa.id, pb.id), max(pa.id, pb.id)
    m, _ = Match.objects.get_or_create(perfil_a_id=a, perfil_b_id=b, defaults={'score': 0.75})
    return m


def _cli(user=None):
    c = APIClient()
    if user:
        c.force_authenticate(user=user)
    return c


def _req(client, method, path, data=None):
    fn = getattr(client, method)
    return fn(path, data=data, format='json') if data else fn(path)


def _cor(code, usar_cor):
    s = str(code)
    if not usar_cor:
        return s
    if code in (200, 201):
        return f'\033[92m{s}\033[0m'
    if code in (400, 403, 404):
        return f'\033[93m{s}\033[0m'
    if code == 401:
        return f'\033[94m{s}\033[0m'
    return f'\033[91m{s}\033[0m'


# ─── Command ──────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = (
        'Imprime a matriz rota x perfil com o status HTTP de cada combinacao. '
        'Usa banco de teste efemero (sem alterar dados reais).'
    )

    def add_arguments(self, parser):
        parser.add_argument('--sem_cor', action='store_true',
                            help='Desativa cores ANSI na saida.')

    def handle(self, *args, **options):
        usar_cor = not options['sem_cor'] and sys.stdout.isatty()
        self.stdout.write('Criando banco de teste efemero...\n')
        runner = DiscoverRunner(verbosity=0)
        old_config = runner.setup_databases()
        try:
            with override_settings(ALLOWED_HOSTS=['*'], DEBUG=False):
                self._rodar(usar_cor)
        finally:
            runner.teardown_databases(old_config)
            self.stdout.write('\nBanco de teste destruido.\n')

    def _rodar(self, usar_cor):
        # ── Usuarios e perfis de cenario ──────────────────────────────────────
        user_b   = _usuario('mx_b@t.local',   'buscando_vaga')
        user_o   = _usuario('mx_o@t.local',   'oferecendo_vaga')
        user_b2  = _usuario('mx_b2@t.local',  'buscando_vaga')    # terceiro
        user_o2  = _usuario('mx_o2@t.local',  'oferecendo_vaga')  # terceiro
        user_adm = _usuario('mx_adm@t.local', 'administrador')

        perfil_b  = _perfil(user_b)
        perfil_o  = _perfil(user_o)
        perfil_b2 = _perfil(user_b2)
        perfil_o2 = _perfil(user_o2)

        match = _match(perfil_b, perfil_o)

        # ── Clientes ──────────────────────────────────────────────────────────
        anon  = _cli()              # nao autenticado
        cli_b = _cli(user_b)        # buscando  (participante do match)
        cli_o = _cli(user_o)        # oferecendo (participante do match)
        cli_a = _cli(user_adm)      # admin
        cli_b2 = _cli(user_b2)      # buscando terceiro (nao-participante)
        cli_o2 = _cli(user_o2)      # oferecendo terceiro (nao-participante)

        # ── Definicao das rotas ───────────────────────────────────────────────
        # Cada linha: (rotulo, [(client_anon, data), (client_b, data), (client_o, data), (client_a, data)])
        # None em data = sem payload
        M = match.id

        linhas = [
            # Perfis
            ('GET  /api/perfis/ (lista)',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            (f'GET  /api/perfis/{perfil_b.id}/ (proprio/oposto)',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            (f'GET  /api/perfis/{perfil_b2.id}/ (mesmo tipo p/ buscando, oposto p/ oferecendo)',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            # Curtidas - mesmo tipo
            ('POST /api/curtidas/ (mesmo tipo)',
             [(anon,   {'perfil_destino': perfil_b2.id, 'tipo': 'curtir'}),
              (cli_b,  {'perfil_destino': perfil_b2.id, 'tipo': 'curtir'}),
              (cli_o,  {'perfil_destino': perfil_o2.id, 'tipo': 'curtir'}),
              (cli_a,  {'perfil_destino': perfil_b.id,  'tipo': 'curtir'})]),
            # Discovery / Matches
            ('GET  /api/descoberta/',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            ('GET  /api/matches/',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            ('GET  /api/conversas/',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            # Chat
            (f'GET  /api/matches/{M}/mensagens/ (participante)',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            (f'GET  /api/matches/{M}/mensagens/ (nao-participante)',
             [(anon, None), (cli_b2, None), (cli_o2, None), (cli_a, None)]),
            (f'POST /api/matches/{M}/mensagens/ (nao-participante)',
             [(anon, None),
              (cli_b2, {'conteudo': 'invasao'}),
              (cli_o2, {'conteudo': 'invasao'}),
              (cli_a,  {'conteudo': 'invasao'})]),
            # Admin
            ('GET  /api/admin/logs/',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            ('GET  /api/admin/logs/exportar/',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            ('GET  /api/admin/dashboard/',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            ('GET  /api/admin/relatorios/',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            ('GET  /api/admin/relatorios/matches/',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            ('GET  /api/admin/usuarios/',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
            ('GET  /api/admin/usuarios/exportar/',
             [(anon, None), (cli_b, None), (cli_o, None), (cli_a, None)]),
        ]

        # ── Impressao da tabela ───────────────────────────────────────────────
        PERFIS   = ['Anonimo', 'Buscando', 'Oferecendo', 'Admin']
        COL_ROTA = 58
        COL_PERF = 12

        header = f"{'Rota':<{COL_ROTA}}" + ''.join(f"{n:^{COL_PERF}}" for n in PERFIS)
        sep = '-' * len(header)

        self.stdout.write('\n' + sep)
        self.stdout.write(header)
        self.stdout.write(sep)

        for rotulo, clientes_data in linhas:
            method = rotulo.split()[0].lower()
            path   = rotulo.split()[1].split('(')[0].strip()
            codes  = []
            for client, data in clientes_data:
                r = _req(client, method, path, data)
                codes.append(r.status_code)

            row = f"{rotulo:<{COL_ROTA}}"
            for code in codes:
                cell = _cor(code, usar_cor)
                row += f"{cell:^{COL_PERF}}"
            self.stdout.write(row)

        self.stdout.write(sep)
        self.stdout.write(
            'Legenda  2xx=OK  400=Bad Request  401=Sem auth  403=Proibido\n'
        )
