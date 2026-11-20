"""Apoio aos testes da Afinidade por IA (embedder falso, sem baixar modelo)."""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from ia import servico
from perfis.models import Perfil

User = get_user_model()

BIO_CULINARIA = 'Adoro cozinhar receitas caseiras e preparar jantares para os amigos na cozinha.'
BIO_CULINARIA_2 = 'Cozinhar jantares caseiros e testar receitas novas na cozinha é o que eu mais gosto.'
BIO_FESTAS = 'Vivo em festas e baladas, saio para dançar e curtir a noite com a turma.'
BIO_CURTA = 'Oi, tudo bem?'  # 11 letras: não gera embedding

PERFIL_BASE = dict(
    idade=25, regiao='Recife', orcamento_min=800, orcamento_max=1500,
    fumante=False, aceita_pets=True, tolerancia_bagunca=3, nivel_organizacao=3,
    perfil_horario='flexivel', nivel_ruido=3, nivel_social=3,
    aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
)

_n = [0]


def criar(tipo='buscando_vaga', bio=BIO_CULINARIA, email=None, **extra):
    _n[0] += 1
    email = email or f'ia{_n[0]}@t.com'
    u = User.objects.create_user(username=email.split('@')[0], email=email, password='Senha@Forte123', tipo=tipo)
    p = Perfil.objects.create(usuario=u, nome=extra.pop('nome', f'Pessoa {_n[0]}'), bio=bio, **{**PERFIL_BASE, **extra})
    return u, p


def admin(email='adm-ia@t.com'):
    return User.objects.create_user(username='adm-ia', email=email, password='Senha@Forte123', tipo='administrador')


class BaseIA(APITestCase):
    def setUp(self):
        servico.reiniciar()

    def tearDown(self):
        servico.reiniciar()

    def como(self, usuario):
        self.client.force_authenticate(user=usuario)
        return self.client
