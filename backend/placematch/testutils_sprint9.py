"""Utilitários compartilhados pelos testes funcionais/validação da Sprint 9.

`reg()` imprime uma linha `[CT-Vxx] status=... body=...` que é usada para montar
a tabela "resultado obtido" do relatório (rodar com `-v 2` e filtrar por `[CT-`).
"""
import json

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from perfis.models import Perfil

User = get_user_model()

PERFIL_OK = dict(
    nome='Pessoa Teste', idade=25, regiao='Recife', bio='Bio.',
    orcamento_min=800, orcamento_max=1500,
    fumante=False, aceita_pets=True,
    tolerancia_bagunca=3, nivel_organizacao=3,
    perfil_horario='flexivel', nivel_ruido=3, nivel_social=3,
    aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
)

SENHA = 'Senha@Forte123'


def reg(ct_id, res):
    """Registra no stdout o resultado real de uma chamada."""
    try:
        corpo = json.dumps(res.json(), ensure_ascii=False)
    except (ValueError, TypeError):  # corpo não é JSON ou resposta sem Content-Type (ex.: 204)
        corpo = (res.content or b'')[:200].decode('utf-8', 'replace')
    import sys
    linha = f'\n[{ct_id}] status={res.status_code} body={corpo[:300]}'
    enc = getattr(sys.stdout, 'encoding', None) or 'utf-8'
    print(linha.encode(enc, 'replace').decode(enc, 'replace'))


def corpo_texto(res):
    """Texto do corpo da resposta (para checar idioma/menção ao campo)."""
    try:
        return json.dumps(res.json(), ensure_ascii=False)
    except (ValueError, TypeError):  # corpo não é JSON ou resposta sem Content-Type (ex.: 204)
        return (res.content or b'').decode('utf-8', 'replace')


PALAVRAS_INGLES = (
    'This field', 'is required', 'may not be', 'Invalid', 'invalid token',
    'Not found', 'not valid', 'expected a number', 'Authentication credentials',
    'Given token', 'No active account', 'Ensure this',
)


def tem_ingles(texto):
    return any(p.lower() in texto.lower() for p in PALAVRAS_INGLES)


def criar_usuario(email, tipo='buscando_vaga', senha=SENHA, **extra):
    return User.objects.create_user(
        username=email.split('@')[0], email=email, password=senha, tipo=tipo, **extra,
    )


def criar_perfil(usuario, **extra):
    dados = {**PERFIL_OK, **extra}
    return Perfil.objects.create(usuario=usuario, **dados)


class BaseSprint9(APITestCase):
    """Cria 1 buscando, 1 oferecendo e 1 admin, cada um com perfil (exceto admin)."""

    def setUp(self):
        self.ub = criar_usuario('buscando@t.com', 'buscando_vaga')
        self.uo = criar_usuario('oferece@t.com', 'oferecendo_vaga')
        self.adm = criar_usuario('adm@t.com', 'administrador')
        self.pb = criar_perfil(self.ub, nome='Buscando', regiao='Recife')
        self.po = criar_perfil(self.uo, nome='Oferece', regiao='Recife')

    def como(self, usuario):
        self.client.force_authenticate(user=usuario)
        return self.client
