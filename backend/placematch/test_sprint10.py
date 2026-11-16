"""Sprint 10 — release candidate: limite da descrição, filtro de datas das denúncias,
restrições do banco (CheckConstraint/UniqueConstraint) e o comando `verificar_banco`."""
from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.utils import timezone

from chat.models import Mensagem
from matches.models import Compatibilidade, Curtida, Match
from moderacao.models import Denuncia
from perfis.models import Perfil
from placematch.testutils_sprint9 import PERFIL_OK, SENHA, BaseSprint9, criar_perfil, criar_usuario, corpo_texto
from usuarios.models import Usuario


class DescricaoDoImovelTest(BaseSprint9):
    def test_ate_1000_caracteres_e_aceito(self):
        r = self.como(self.uo).patch(f'/api/perfis/{self.po.id}/', {'descricao_imovel': 'd' * 1000}, format='json')
        self.assertEqual(r.status_code, 200, corpo_texto(r))

    def test_acima_de_1000_da_400_com_mensagem(self):
        r = self.como(self.uo).patch(f'/api/perfis/{self.po.id}/', {'descricao_imovel': 'd' * 1001}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('A descrição do imóvel deve ter no máximo 1000 caracteres', r.json()['descricao_imovel'][0])

    def test_criacao_tambem_valida(self):
        novo = criar_usuario('novo@t.com', 'oferecendo_vaga')
        r = self.como(novo).post('/api/perfis/', {**PERFIL_OK, 'descricao_imovel': 'x' * 1001}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('descricao_imovel', r.json())


class FiltroDeDatasDasDenunciasTest(BaseSprint9):
    URL = '/api/admin/moderacao/denuncias/'

    def setUp(self):
        super().setUp()
        hoje = timezone.now()
        self.antiga = Denuncia.objects.create(denunciante=self.ub, denunciado=self.uo, motivo='spam')
        self.recente = Denuncia.objects.create(denunciante=self.ub, denunciado=self.uo, motivo='falso')
        Denuncia.objects.filter(pk=self.antiga.pk).update(criada_em=hoje - timedelta(days=40))
        self.hoje = timezone.localdate().isoformat()
        self.ha_30_dias = (timezone.localdate() - timedelta(days=30)).isoformat()
        self.ha_50_dias = (timezone.localdate() - timedelta(days=50)).isoformat()

    def _ids(self, **params):
        r = self.como(self.adm).get(self.URL, params)
        self.assertEqual(r.status_code, 200, corpo_texto(r))
        return {d['id'] for d in r.json()}

    def test_sem_filtro_lista_as_duas(self):
        self.assertEqual(self._ids(), {self.antiga.id, self.recente.id})

    def test_data_inicio_exclui_a_antiga(self):
        self.assertEqual(self._ids(data_inicio=self.ha_30_dias), {self.recente.id})

    def test_data_fim_exclui_a_recente(self):
        self.assertEqual(self._ids(data_fim=self.ha_30_dias), {self.antiga.id})

    def test_periodo_que_contem_so_a_antiga(self):
        self.assertEqual(self._ids(data_inicio=self.ha_50_dias, data_fim=self.ha_30_dias), {self.antiga.id})

    def test_data_inicio_no_futuro_nao_traz_nada(self):
        amanha = (timezone.localdate() + timedelta(days=2)).isoformat()
        self.assertEqual(self._ids(data_inicio=amanha), set())

    def test_formato_invalido_e_periodo_invertido_dao_400_em_portugues(self):
        for params in ({'data_inicio': '31/12/2025'}, {'data_fim': '2025-13-45'},
                       {'data_inicio': self.hoje, 'data_fim': self.ha_50_dias}):
            r = self.como(self.adm).get(self.URL, params)
            self.assertEqual(r.status_code, 400, params)
            self.assertIn('data_', r.json()['detail'])

    def test_combina_com_os_outros_filtros(self):
        self.assertEqual(self._ids(data_inicio=self.ha_30_dias, motivo='spam'), set())
        self.assertEqual(self._ids(data_inicio=self.ha_30_dias, motivo='falso'), {self.recente.id})


class RestricoesDoBancoTest(BaseSprint9):
    """Cada regra de negócio também é recusada pelo banco (IntegrityError), mesmo sem passar pela API."""

    def _recusa(self, acao):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                acao()

    def _perfil_invalido(self, **campos):
        outro = criar_usuario(f'p{Usuario.objects.count()}@t.com', 'buscando_vaga')
        self._recusa(lambda: criar_perfil(outro, **campos))

    # ── perfil ──
    def test_perfil_idade_fora_de_18_a_100(self):
        for idade in (17, 101):
            self._perfil_invalido(idade=idade)

    def test_perfil_orcamento(self):
        self._perfil_invalido(orcamento_min=0)
        self._perfil_invalido(orcamento_min=2000, orcamento_max=1000)

    def test_perfil_moradores_fora_de_1_a_4(self):
        for n in (0, 5):
            self._perfil_invalido(qtd_moradores=n)

    def test_perfil_escalas_fora_de_1_a_5(self):
        for campo in ('tolerancia_bagunca', 'nivel_organizacao', 'nivel_ruido', 'nivel_social'):
            for valor in (0, 6):
                self._perfil_invalido(**{campo: valor})

    def test_perfil_valores_de_escolha_invalidos(self):
        self._perfil_invalido(perfil_horario='x')
        self._perfil_invalido(aceita_visitas='x')
        self._perfil_invalido(tipo_imovel='x')

    def test_perfil_textos(self):
        self._perfil_invalido(nome='A')
        self._perfil_invalido(bio='b' * 501)
        self._perfil_invalido(descricao_imovel='d' * 1001)

    def test_perfil_update_tambem_e_recusado(self):
        self._recusa(lambda: Perfil.objects.filter(pk=self.pb.pk).update(idade=17))
        self._recusa(lambda: Perfil.objects.filter(pk=self.pb.pk).update(orcamento_min=99999))

    def test_perfil_valido_continua_aceito(self):
        outro = criar_usuario('ok@t.com', 'buscando_vaga')
        criar_perfil(outro, idade=18, qtd_moradores=1, nivel_ruido=1, nivel_social=5, orcamento_min=1, orcamento_max=1)
        criar_perfil(criar_usuario('ok2@t.com', 'buscando_vaga'), idade=100, qtd_moradores=4, bio='b' * 500)

    # ── compatibilidade, curtida e match ──
    def test_compatibilidade(self):
        Compatibilidade.objects.all().delete()
        for score in (-0.01, 1.01):
            self._recusa(lambda s=score: Compatibilidade.objects.create(perfil_a=self.pb, perfil_b=self.po, score=s))
        self._recusa(lambda: Compatibilidade.objects.create(perfil_a=self.pb, perfil_b=self.pb, score=0.5))
        Compatibilidade.objects.create(perfil_a=self.pb, perfil_b=self.po, score=0.0)
        Compatibilidade.objects.filter(perfil_a=self.pb).delete()
        Compatibilidade.objects.create(perfil_a=self.pb, perfil_b=self.po, score=1.0)

    def test_curtida(self):
        self._recusa(lambda: Curtida.objects.create(perfil_origem=self.pb, perfil_destino=self.pb, tipo='curtir'))
        self._recusa(lambda: Curtida.objects.create(perfil_origem=self.pb, perfil_destino=self.po, tipo='talvez'))
        Curtida.objects.create(perfil_origem=self.pb, perfil_destino=self.po, tipo='recusar')

    def test_match(self):
        for score in (-1, 2):
            self._recusa(lambda s=score: Match.objects.create(perfil_a=self.pb, perfil_b=self.po, score=s))
        self._recusa(lambda: Match.objects.create(perfil_a=self.pb, perfil_b=self.pb, score=0.5))

    # ── mensagem ──
    def test_mensagem_conteudo_de_1_a_1000(self):
        a, b = sorted([self.pb.id, self.po.id])
        m = Match.objects.create(perfil_a_id=a, perfil_b_id=b, score=0.5)
        for texto in ('', 'x' * 1001):
            self._recusa(lambda t=texto: Mensagem.objects.create(match=m, remetente=self.pb, conteudo=t))
        Mensagem.objects.create(match=m, remetente=self.pb, conteudo='x')
        Mensagem.objects.create(match=m, remetente=self.pb, conteudo='é' * 1000)

    # ── denúncia ──
    def test_denuncia(self):
        base = dict(denunciante=self.ub, denunciado=self.uo, motivo='spam')
        self._recusa(lambda: Denuncia.objects.create(**{**base, 'motivo': 'chato'}))
        self._recusa(lambda: Denuncia.objects.create(**{**base, 'status': 'aberta'}))
        self._recusa(lambda: Denuncia.objects.create(**{**base, 'descricao': 'd' * 501}))
        self._recusa(lambda: Denuncia.objects.create(**{**base, 'resolucao': 'r' * 501}))
        self._recusa(lambda: Denuncia.objects.create(denunciante=self.ub, denunciado=self.ub, motivo='spam'))
        Denuncia.objects.create(denunciante=None, denunciado=self.uo, motivo='outro', descricao='d' * 500)

    # ── usuário ──
    def test_usuario_tipo_invalido(self):
        self._recusa(lambda: criar_usuario('t@t.com', 'rei'))

    def test_email_unico_sem_diferenciar_maiusculas(self):
        criar_usuario('Maria@T.com')
        self._recusa(lambda: criar_usuario('maria@t.COM'))


class VerificarBancoTest(BaseSprint9):
    def _rodar(self, *args):
        out = StringIO()
        call_command('verificar_banco', *args, stdout=out)
        return out.getvalue()

    def _linha(self, saida, trecho):
        return next(linha for linha in saida.splitlines() if trecho in linha)

    def test_banco_consistente(self):
        # curtidas mútuas + match + mensagem coerentes
        Curtida.objects.create(perfil_origem=self.pb, perfil_destino=self.po, tipo='curtir')
        Curtida.objects.create(perfil_origem=self.po, perfil_destino=self.pb, tipo='curtir')
        a, b = sorted([self.pb.id, self.po.id])
        m = Match.objects.create(perfil_a_id=a, perfil_b_id=b, score=0.7)
        Mensagem.objects.create(match=m, remetente=self.pb, conteudo='oi')
        saida = self._rodar('--falhar')
        self.assertIn('0 erro(s)', saida)
        self.assertIn('[OK   ]', saida)
        self.assertNotIn('[ERRO ]', saida)

    def test_detecta_inconsistencias(self):
        # match sem curtida mútua
        a, b = sorted([self.pb.id, self.po.id])
        m = Match.objects.create(perfil_a_id=a, perfil_b_id=b, score=0.7)
        # mensagem de quem não participa do match
        intruso = criar_perfil(criar_usuario('intruso@t.com', 'buscando_vaga'))
        Mensagem.objects.create(match=m, remetente=intruso, conteudo='oi')
        # compatibilidade faltando
        Compatibilidade.objects.filter(perfil_a_id=a, perfil_b_id=b).delete()
        # administrador com perfil e usuário comum sem perfil
        criar_perfil(self.adm)
        criar_usuario('semperfil@t.com', 'oferecendo_vaga')
        # par invertido (A,B) e (B,A) duplicados
        Match.objects.create(perfil_a_id=b, perfil_b_id=a, score=0.7)

        saida = self._rodar('--detalhes')
        self.assertIn('[ERRO ]', self._linha(saida, 'Matches sem curtida mútua'))
        self.assertIn(': 2', self._linha(saida, 'Matches sem curtida mútua'))
        self.assertIn(': 1', self._linha(saida, 'Mensagens enviadas por quem não participa'))
        self.assertIn('[ERRO ]', self._linha(saida, 'Compatibilidade faltando'))
        self.assertIn('[ERRO ]', self._linha(saida, 'Administradores com perfil'))
        self.assertIn('[AVISO]', self._linha(saida, 'Usuários comuns sem perfil'))
        self.assertIn(': 1', self._linha(saida, 'Match: pares duplicados'))
        self.assertIn('[AVISO]', self._linha(saida, 'Match: pares invertidos'))
        self.assertIn('ids/itens', saida)

    def test_falhar_sai_com_erro_quando_ha_problema(self):
        a, b = sorted([self.pb.id, self.po.id])
        Match.objects.create(perfil_a_id=a, perfil_b_id=b, score=0.5)  # sem curtidas
        with self.assertRaises(CommandError):
            self._rodar('--falhar')
        self._rodar()  # sem --falhar apenas relata

    def test_somente_leitura(self):
        antes = (Usuario.objects.count(), Perfil.objects.count(), Compatibilidade.objects.count())
        self._rodar('--detalhes')
        self.assertEqual(antes, (Usuario.objects.count(), Perfil.objects.count(), Compatibilidade.objects.count()))
        self.assertTrue(Usuario.objects.get(email='buscando@t.com').check_password(SENHA))
