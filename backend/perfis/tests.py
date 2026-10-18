from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Perfil

User = get_user_model()

FOTOS_VALIDAS = [
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
]

PERFIL_BASE = dict(
    nome='Carlos Teste', idade=25, regiao='Pinheiros',
    bio='Teste.',
    orcamento_min=800, orcamento_max=1500,
    fumante=False, aceita_pets=False,
    tolerancia_bagunca=3, nivel_organizacao=3,
    perfil_horario='flexivel', nivel_ruido=3, nivel_social=3,
    aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
)


def _criar_usuario(email='u@test.com', tipo='oferecendo_vaga'):
    return User.objects.create_user(
        username=email.split('@')[0],
        email=email,
        password='Test@1234',
        tipo=tipo,
    )


class CriarPerfilAnuncioTest(APITestCase):
    """Perfil oferecendo_vaga com dados de anúncio completos."""

    def setUp(self):
        self.user = _criar_usuario()
        self.client.force_authenticate(user=self.user)

    def test_criar_com_anuncio_retorna_201_e_campos(self):
        payload = {
            **PERFIL_BASE,
            'titulo_anuncio': 'Quarto amplo próximo ao metrô',
            'descricao_imovel': 'Apartamento reformado com 2 quartos e varanda.',
            'fotos_imovel': FOTOS_VALIDAS,
            'foto_perfil_url': 'https://i.pravatar.cc/150?img=10',
        }
        res = self.client.post('/api/perfis/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertEqual(data['titulo_anuncio'], 'Quarto amplo próximo ao metrô')
        self.assertEqual(data['descricao_imovel'], 'Apartamento reformado com 2 quartos e varanda.')
        self.assertEqual(data['fotos_imovel'], FOTOS_VALIDAS)
        self.assertEqual(data['foto_perfil_url'], 'https://i.pravatar.cc/150?img=10')


class ValidacaoFotosImovelTest(APITestCase):
    """Validações de fotos_imovel."""

    def setUp(self):
        self.user = _criar_usuario('v@test.com')
        self.client.force_authenticate(user=self.user)

    def _post(self, fotos):
        payload = {**PERFIL_BASE, 'fotos_imovel': fotos}
        return self.client.post('/api/perfis/', payload, format='json')

    def test_seis_fotos_retorna_400(self):
        fotos = [f'https://example.com/foto{i}.jpg' for i in range(6)]
        res = self._post(fotos)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('fotos_imovel', res.json())

    def test_url_invalida_retorna_400(self):
        res = self._post(['nao-e-uma-url'])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('fotos_imovel', res.json())

    def test_cinco_fotos_validas_aceita(self):
        fotos = [f'https://example.com/foto{i}.jpg' for i in range(5)]
        res = self._post(fotos)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)


class ValidacaoTituloAnuncioTest(APITestCase):
    """Validação do comprimento do título."""

    def setUp(self):
        self.user = _criar_usuario('t@test.com')
        self.client.force_authenticate(user=self.user)

    def test_titulo_121_caracteres_retorna_400(self):
        payload = {**PERFIL_BASE, 'titulo_anuncio': 'A' * 121}
        res = self.client.post('/api/perfis/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('titulo_anuncio', res.json())

    def test_titulo_120_caracteres_aceita(self):
        payload = {**PERFIL_BASE, 'titulo_anuncio': 'A' * 120}
        res = self.client.post('/api/perfis/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)


class ValidacaoFotoPerfilUrlTest(APITestCase):
    """Validação da URL do avatar."""

    def setUp(self):
        self.user = _criar_usuario('fp@test.com')
        self.client.force_authenticate(user=self.user)

    def test_url_invalida_retorna_400(self):
        payload = {**PERFIL_BASE, 'foto_perfil_url': 'nao-e-uma-url'}
        res = self.client.post('/api/perfis/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('foto_perfil_url', res.json())


class PatchTituloSemPerderFotosTest(APITestCase):
    """PATCH só no título não apaga as fotos."""

    def setUp(self):
        self.user = _criar_usuario('patch@test.com')
        self.client.force_authenticate(user=self.user)
        payload = {
            **PERFIL_BASE,
            'titulo_anuncio': 'Título original',
            'fotos_imovel': FOTOS_VALIDAS,
        }
        res = self.client.post('/api/perfis/', payload, format='json')
        self.perfil_id = res.json()['id']

    def test_patch_titulo_mantem_fotos(self):
        res = self.client.patch(
            f'/api/perfis/{self.perfil_id}/',
            {'titulo_anuncio': 'Novo título'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data['titulo_anuncio'], 'Novo título')
        self.assertEqual(data['fotos_imovel'], FOTOS_VALIDAS)


class PerfilBuscandoVagaSemAnuncioTest(APITestCase):
    """Perfil buscando_vaga sem campos de anúncio continua funcionando."""

    def setUp(self):
        self.user = _criar_usuario('buscando@test.com', tipo='buscando_vaga')
        self.client.force_authenticate(user=self.user)

    def test_criar_sem_anuncio_retorna_201_e_defaults(self):
        res = self.client.post('/api/perfis/', PERFIL_BASE, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertEqual(data['titulo_anuncio'], '')
        self.assertEqual(data['descricao_imovel'], '')
        self.assertEqual(data['fotos_imovel'], [])
        self.assertEqual(data['foto_perfil_url'], '')


class DescobertaCamposAnuncioTest(APITestCase):
    """
    /api/descoberta/ devolve titulo_anuncio, fotos_imovel, foto_perfil_url e tipo do outro perfil.
    """

    def setUp(self):
        # usuário buscando
        self.user_b = _criar_usuario('busca@test.com', tipo='buscando_vaga')
        self.user_b.save()
        Perfil.objects.create(usuario=self.user_b, **PERFIL_BASE)

        # usuário oferecendo
        self.user_o = _criar_usuario('oferta@test.com', tipo='oferecendo_vaga')
        self.user_o.save()
        Perfil.objects.create(
            usuario=self.user_o,
            **{
                **PERFIL_BASE,
                'titulo_anuncio': 'Quarto em SP',
                'fotos_imovel': ['https://example.com/f.jpg'],
                'foto_perfil_url': 'https://i.pravatar.cc/150?img=1',
            },
        )

    def test_descoberta_inclui_campos_anuncio_e_tipo(self):
        self.client.force_authenticate(user=self.user_b)
        res = self.client.get('/api/descoberta/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        perfis = res.json()
        self.assertEqual(len(perfis), 1)
        p = perfis[0]
        self.assertEqual(p['titulo_anuncio'], 'Quarto em SP')
        self.assertEqual(p['fotos_imovel'], ['https://example.com/f.jpg'])
        self.assertEqual(p['foto_perfil_url'], 'https://i.pravatar.cc/150?img=1')
        self.assertEqual(p['tipo'], 'oferecendo_vaga')
