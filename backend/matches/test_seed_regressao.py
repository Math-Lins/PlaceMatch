"""Regressão: backend/seed.py criava match sem curtida mútua quando rodava pela segunda vez.

Causa: na 2ª execução, uma RECUSA buscando → oferecendo deixada pela 1ª era tratada como curtida;
a outra pessoa "retribuía" e o match era criado (matches 52, 55, 56, 58, 59, 60, 63, 65, 67 e 71
do banco de desenvolvimento, apontados pelo `verificar_banco`).
"""
import random

from django.db.models import Q
from django.test import TestCase

from matches.models import Curtida, Match
from perfis.models import Perfil
from usuarios.models import Usuario

import seed  # backend/seed.py (o seed só roda com `python seed.py`; importar não executa nada)


def _perfil(email, tipo):
    u = Usuario.objects.create_user(username=email, email=email, password='x-senha-teste-1', tipo=tipo)
    return Perfil.objects.create(usuario=u, nome=email.split('@')[0], idade=25, regiao='Recife',
                                 orcamento_min=500, orcamento_max=1500)


def _matches_sem_curtida_mutua():
    ruins = []
    for m in Match.objects.all():
        a, b = m.perfil_a_id, m.perfil_b_id
        mutua = (Curtida.objects.filter(perfil_origem_id=a, perfil_destino_id=b, tipo='curtir').exists()
                 and Curtida.objects.filter(perfil_origem_id=b, perfil_destino_id=a, tipo='curtir').exists())
        if not mutua:
            ruins.append(m.id)
    return ruins


class SeedCurtidasEMatchesTest(TestCase):
    def test_recusa_anterior_nao_vira_match(self):
        """Cenário exato do banco local: busca recusou; na nova execução a oferta 'retribui'."""
        pb = _perfil('busca@t.com', 'buscando_vaga')
        po = _perfil('oferece@t.com', 'oferecendo_vaga')
        Curtida.objects.create(perfil_origem=pb, perfil_destino=po, tipo='recusar')

        com_match, _ = seed.criar_curtidas_e_matches([pb], [po], rnd=random.Random(0))

        self.assertEqual(com_match, 0)
        self.assertFalse(Match.objects.filter(Q(perfil_a=pb, perfil_b=po) | Q(perfil_a=po, perfil_b=pb)).exists())
        self.assertEqual(Curtida.objects.get(perfil_origem=pb, perfil_destino=po).tipo, 'recusar',
                         'a recusa existente não pode ser trocada')

    def test_curtida_mutua_cria_match(self):
        pb = _perfil('busca@t.com', 'buscando_vaga')
        po = _perfil('oferece@t.com', 'oferecendo_vaga')

        com_match, _ = seed.criar_curtidas_e_matches([pb], [po], rnd=random.Random(0))

        self.assertEqual(com_match, 1)
        self.assertEqual(Match.objects.count(), 1)
        self.assertEqual(_matches_sem_curtida_mutua(), [])

    def test_oferta_que_ja_recusou_nao_vira_match(self):
        pb = _perfil('busca@t.com', 'buscando_vaga')
        po = _perfil('oferece@t.com', 'oferecendo_vaga')
        Curtida.objects.create(perfil_origem=po, perfil_destino=pb, tipo='recusar')

        seed.criar_curtidas_e_matches([pb], [po], rnd=random.Random(0))

        self.assertEqual(Match.objects.count(), 0)

    def test_duas_execucoes_com_sorteios_diferentes_nunca_criam_match_sem_curtida_mutua(self):
        """Reproduz as duas execuções (sorteios diferentes) que geraram os 10 matches inconsistentes."""
        buscando = [_perfil(f'b{i}@t.com', 'buscando_vaga') for i in range(6)]
        oferecendo = [_perfil(f'o{i}@t.com', 'oferecendo_vaga') for i in range(10)]

        seed.criar_curtidas_e_matches(buscando, oferecendo, rnd=random.Random(42))
        self.assertTrue(Curtida.objects.filter(tipo='recusar').exists(), 'a 1ª execução deve deixar recusas')
        seed.criar_curtidas_e_matches(buscando, oferecendo, rnd=random.Random(7))

        self.assertGreater(Match.objects.count(), 0)
        self.assertEqual(_matches_sem_curtida_mutua(), [])


class AdminDjangoNaoOfereceAdministradorComoDonoDePerfilTest(TestCase):
    """O perfil do administrador (id 1) no banco local veio da API antes do bloqueio de 14/11
    (`NaoAdministradorNaCriacao`, testado em placematch/test_correcoes_sprint9.py). Aqui fica fechado
    o outro caminho: o formulário de Perfil do Django admin (/admin/)."""

    def test_campo_usuario_exclui_administradores(self):
        from django.contrib.admin.sites import site
        from django.test import RequestFactory

        adm = Usuario.objects.create_superuser(username='adm', email='adm@t.com', password='x-senha-teste-1',
                                               tipo='administrador')
        comum = Usuario.objects.create_user(username='c', email='c@t.com', password='x-senha-teste-1',
                                            tipo='buscando_vaga')
        request = RequestFactory().get('/admin/perfis/perfil/add/')
        request.user = adm
        form = site._registry[Perfil].get_form(request)()
        opcoes = form.fields['usuario'].queryset
        self.assertIn(comum, opcoes)
        self.assertNotIn(adm, opcoes)


class SeedMatchesComandoTest(TestCase):
    """`manage.py seed_matches` (usado pelo seed_demo) também não pode criar match se já houver recusa."""

    def test_recusa_existente_impede_o_match_do_par(self):
        from io import StringIO
        from django.core.management import call_command
        from matches.management.commands.seed_matches import PARES_CURTIDA, _get_perfil

        call_command('seed_perfis', stdout=StringIO())
        email_a, email_b = PARES_CURTIDA[0]
        pa, pb = _get_perfil(email_a), _get_perfil(email_b)
        Curtida.objects.create(perfil_origem=pa, perfil_destino=pb, tipo='recusar')

        saida = StringIO()
        call_command('seed_matches', stdout=saida)

        self.assertFalse(Match.objects.filter(Q(perfil_a=pa, perfil_b=pb) | Q(perfil_a=pb, perfil_b=pa)).exists())
        self.assertIn('Sem curtida mútua', saida.getvalue())
        self.assertGreater(Match.objects.count(), 0, 'os outros pares continuam virando match')
        self.assertEqual(_matches_sem_curtida_mutua(), [])
