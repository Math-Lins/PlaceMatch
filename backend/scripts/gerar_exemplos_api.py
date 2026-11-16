"""Executa chamadas REAIS contra uma API em execução e grava requisição + resposta em JSON.

Os exemplos de docs/api.md e do schema OpenAPI (/api/docs/) saem destas respostas: nada é inventado.
Use SOMENTE um banco descartável (nunca o de desenvolvimento): o script cria usuários, perfis, matches,
mensagens e uma denúncia.

Uso (API em http://127.0.0.1:8001, administrador já criado com `criar_admin`):
    ADMIN_EMAIL=admin@exemplo.com ADMIN_SENHA=... python scripts/gerar_exemplos_api.py saida.json [http://127.0.0.1:8001]

Segredos: tokens saem como <TOKEN>/<REFRESH> e senhas como <SENHA>.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = (sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:8001').rstrip('/')
SAIDA = sys.argv[1] if len(sys.argv) > 1 else 'exemplos_api.json'
SENHA = 'SenhaExemplo123'  # só existe no banco descartável; nos exemplos aparece como <SENHA>
ADMIN_EMAIL = os.environ['ADMIN_EMAIL']
ADMIN_SENHA = os.environ['ADMIN_SENHA']

registros = []
ctx = {}


def mascarar(valor, requisicao=False):
    """Troca tokens (e, na requisição, senhas) por marcadores, em qualquer profundidade."""
    if isinstance(valor, dict):
        saida = {}
        for k, v in valor.items():
            if k == 'access' and isinstance(v, str):
                saida[k] = '<TOKEN>'
            elif k == 'refresh' and isinstance(v, str):
                saida[k] = '<REFRESH>'
            elif k == 'password' and requisicao:
                saida[k] = '<SENHA>'
            else:
                saida[k] = mascarar(v, requisicao)
        return saida
    if isinstance(valor, list):
        return [mascarar(v, requisicao) for v in valor]
    return valor


def chamar(id_, metodo, rota, corpo=None, token=None, papel='publico', nota=''):
    """Faz a chamada, guarda o registro e devolve (status, corpo JSON ou texto)."""
    url = BASE + rota
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(url, data=dados, method=metodo)
    if dados is not None:
        req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        resp = urllib.request.urlopen(req, timeout=60)
    except urllib.error.HTTPError as e:
        resp = e
    status = resp.status if hasattr(resp, 'status') else resp.code
    bruto = resp.read()
    tipo = resp.headers.get('Content-Type', '')
    if 'json' in tipo:
        retorno = json.loads(bruto.decode('utf-8')) if bruto else None
    else:
        retorno = bruto.decode('utf-8-sig')
    registros.append({
        'id': id_, 'metodo': metodo, 'rota': rota, 'papel': papel, 'nota': nota,
        'corpo': mascarar(corpo, requisicao=True) if corpo is not None else None,
        'status': status, 'content_type': tipo.split(';')[0],
        'resposta': mascarar(retorno) if isinstance(retorno, (dict, list)) else retorno,
    })
    return status, retorno


def login(id_, email, senha, **kw):
    s, r = chamar(id_, 'POST', '/api/auth/login/', {'email': email, 'password': senha}, **kw)
    return r.get('access') if s == 200 else None, (r.get('refresh') if s == 200 else None)


PERFIL_ANA = {
    'nome': 'Ana Souza', 'idade': 24, 'regiao': 'Boa Viagem', 'bio': 'Estudante de Computação, rotina tranquila.',
    'orcamento_min': 700, 'orcamento_max': 1200, 'fumante': False, 'aceita_pets': True,
    'tolerancia_bagunca': 2, 'nivel_organizacao': 4, 'perfil_horario': 'flexivel', 'nivel_ruido': 2, 'nivel_social': 3,
    'aceita_visitas': 'as_vezes', 'tipo_imovel': 'apartamento', 'qtd_moradores': 2,
}
PERFIL_BRUNO = {
    'nome': 'Bruno Lima', 'idade': 29, 'regiao': 'Boa Viagem', 'bio': 'Dono do apartamento, trabalho em home office.',
    'orcamento_min': 800, 'orcamento_max': 1300, 'fumante': False, 'aceita_pets': True,
    'tolerancia_bagunca': 2, 'nivel_organizacao': 4, 'perfil_horario': 'flexivel', 'nivel_ruido': 2, 'nivel_social': 3,
    'aceita_visitas': 'as_vezes', 'tipo_imovel': 'apartamento', 'qtd_moradores': 2,
    'titulo_anuncio': 'Quarto amplo a 5 minutos da praia',
    'descricao_imovel': 'Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.',
    'fotos_imovel': ['https://exemplo.com/fotos/quarto.jpg', 'https://exemplo.com/fotos/sala.jpg'],
    'foto_perfil_url': 'https://exemplo.com/fotos/bruno.jpg',
}


def main():
    # ── Autenticação ──
    chamar('registrar_ok', 'POST', '/api/auth/registrar/',
           {'username': 'Ana Souza', 'email': 'ana.souza@exemplo.com', 'password': SENHA, 'tipo': 'buscando_vaga'})
    chamar('registrar_bruno', 'POST', '/api/auth/registrar/',
           {'username': 'Bruno Lima', 'email': 'bruno.lima@exemplo.com', 'password': SENHA, 'tipo': 'oferecendo_vaga'})
    chamar('registrar_carla', 'POST', '/api/auth/registrar/',
           {'username': 'Carla Dias', 'email': 'carla.dias@exemplo.com', 'password': SENHA, 'tipo': 'oferecendo_vaga'})
    chamar('registrar_diego', 'POST', '/api/auth/registrar/',
           {'username': 'Diego Alves', 'email': 'diego.alves@exemplo.com', 'password': SENHA, 'tipo': 'buscando_vaga'})
    chamar('registrar_email_duplicado', 'POST', '/api/auth/registrar/',
           {'username': 'Ana Souza', 'email': 'ANA.SOUZA@exemplo.com', 'password': SENHA, 'tipo': 'buscando_vaga'})
    chamar('registrar_campos_invalidos', 'POST', '/api/auth/registrar/',
           {'username': 'A', 'email': 'isso-nao-e-email', 'password': '123', 'tipo': 'dono'})
    chamar('registrar_vazio', 'POST', '/api/auth/registrar/', {})

    chamar('login_senha_errada', 'POST', '/api/auth/login/', {'email': 'ana.souza@exemplo.com', 'password': 'errada'})
    chamar('login_vazio', 'POST', '/api/auth/login/', {})
    ana, ana_ref = login('login_ok', 'Ana.Souza@exemplo.com', SENHA)
    bruno, _ = login('login_bruno', 'bruno.lima@exemplo.com', SENHA)
    carla, _ = login('login_carla', 'carla.dias@exemplo.com', SENHA)
    diego, _ = login('login_diego', 'diego.alves@exemplo.com', SENHA)
    admin, _ = login('login_admin', ADMIN_EMAIL, ADMIN_SENHA)

    chamar('refresh_ok', 'POST', '/api/auth/login/refresh/', {'refresh': ana_ref})
    chamar('refresh_invalido', 'POST', '/api/auth/login/refresh/', {'refresh': 'token-invalido'})
    chamar('me_ok', 'GET', '/api/auth/me/', token=ana, papel='logado')
    chamar('me_sem_token', 'GET', '/api/auth/me/')
    chamar('me_token_invalido', 'GET', '/api/auth/me/', token='token.invalido', papel='logado')

    # ── Perfis ──
    chamar('descoberta_sem_perfil', 'GET', '/api/descoberta/', token=diego, papel='comum',
           nota='Diego ainda não criou o perfil.')
    s, r = chamar('perfil_criar', 'POST', '/api/perfis/', PERFIL_ANA, token=ana, papel='comum')
    ctx['perfil_ana'] = r['id']
    s, r = chamar('perfil_criar_anuncio', 'POST', '/api/perfis/', PERFIL_BRUNO, token=bruno, papel='comum')
    ctx['perfil_bruno'] = r['id']
    s, r = chamar('perfil_criar_carla', 'POST', '/api/perfis/', {**PERFIL_BRUNO, 'nome': 'Carla Dias', 'regiao': 'Casa Forte',
                  'titulo_anuncio': 'Casa com quintal', 'tipo_imovel': 'casa', 'fotos_imovel': [], 'foto_perfil_url': ''},
                  token=carla, papel='comum')
    ctx['perfil_carla'] = r['id']
    chamar('perfil_criar_invalido', 'POST', '/api/perfis/', {**PERFIL_ANA, 'idade': 17, 'orcamento_min': 2000, 'orcamento_max': 1000,
           'nivel_ruido': 9, 'bio': 'b' * 501}, token=diego, papel='comum')
    chamar('perfil_criar_duplicado', 'POST', '/api/perfis/', PERFIL_ANA, token=ana, papel='comum')
    chamar('perfil_criar_admin', 'POST', '/api/perfis/', PERFIL_ANA, token=admin, papel='admin')
    chamar('perfil_listar', 'GET', '/api/perfis/', token=ana, papel='logado')
    chamar('perfil_consultar', 'GET', f"/api/perfis/{ctx['perfil_bruno']}/", token=ana, papel='logado',
           nota='Ana (buscando vaga) consulta o anúncio de Bruno (tipo oposto).')
    chamar('perfil_consultar_inexistente', 'GET', '/api/perfis/999999/', token=ana, papel='logado')
    chamar('perfil_consultar_mesmo_tipo', 'GET', f"/api/perfis/{ctx['perfil_carla']}/", token=bruno, papel='logado',
           nota='Bruno (oferecendo vaga) tenta ver o perfil de Carla (mesmo tipo, sem match).')
    chamar('perfil_atualizar_parcial', 'PATCH', f"/api/perfis/{ctx['perfil_ana']}/",
           {'bio': 'Estudante de Computação, rotina tranquila e gosta de cozinhar.', 'orcamento_max': 1250},
           token=ana, papel='dono')
    chamar('perfil_atualizar_invalido', 'PATCH', f"/api/perfis/{ctx['perfil_ana']}/", {'idade': 15}, token=ana, papel='dono')
    chamar('perfil_atualizar_completo', 'PUT', f"/api/perfis/{ctx['perfil_ana']}/",
           {**PERFIL_ANA, 'bio': 'Estudante de Computação, rotina tranquila e gosta de cozinhar.', 'orcamento_max': 1250},
           token=ana, papel='dono')
    chamar('perfil_atualizar_de_outro', 'PATCH', f"/api/perfis/{ctx['perfil_bruno']}/", {'bio': 'x'}, token=ana, papel='dono')

    # ── Descoberta, curtidas e matches ──
    chamar('descoberta_ok', 'GET', '/api/descoberta/', token=ana, papel='comum')
    chamar('descoberta_filtros', 'GET', '/api/descoberta/?q=praia&regiao=Boa%20Viagem&aceita_pets=true&orcamento_max=1500&score_min=50&ordenar=orcamento_asc',
           token=ana, papel='comum')
    chamar('descoberta_filtro_invalido', 'GET', '/api/descoberta/?score_min=150&aceita_pets=talvez', token=ana, papel='comum')
    chamar('descoberta_admin', 'GET', '/api/descoberta/', token=admin, papel='admin')
    chamar('curtida_inexistente', 'POST', '/api/curtidas/', {'perfil_destino': 999999, 'tipo': 'curtir'}, token=ana, papel='comum')
    chamar('curtida_mesmo_tipo', 'POST', '/api/curtidas/', {'perfil_destino': ctx['perfil_ana'], 'tipo': 'curtir'}, token=ana, papel='comum')
    chamar('curtida_recusar', 'POST', '/api/curtidas/', {'perfil_destino': ctx['perfil_carla'], 'tipo': 'recusar'}, token=ana, papel='comum')
    chamar('curtida_ok', 'POST', '/api/curtidas/', {'perfil_destino': ctx['perfil_bruno'], 'tipo': 'curtir'}, token=ana, papel='comum')
    chamar('curtida_duplicada', 'POST', '/api/curtidas/', {'perfil_destino': ctx['perfil_bruno'], 'tipo': 'curtir'}, token=ana, papel='comum')
    s, r = chamar('curtida_match', 'POST', '/api/curtidas/', {'perfil_destino': ctx['perfil_ana'], 'tipo': 'curtir'}, token=bruno, papel='comum')
    ctx['match'] = r['match_data']['id']
    chamar('curtida_vazia', 'POST', '/api/curtidas/', {}, token=ana, papel='comum')
    chamar('curtida_admin', 'POST', '/api/curtidas/', {'perfil_destino': ctx['perfil_ana'], 'tipo': 'curtir'}, token=admin, papel='admin')
    chamar('matches_ok', 'GET', '/api/matches/', token=ana, papel='logado')

    # ── Chat ──
    chamar('conversas_antes', 'GET', '/api/conversas/', token=ana, papel='comum')
    chamar('mensagem_enviar', 'POST', f"/api/matches/{ctx['match']}/mensagens/", {'conteudo': 'Oi, Bruno! O quarto ainda está disponível?'},
           token=ana, papel='participante')
    chamar('mensagem_responder', 'POST', f"/api/matches/{ctx['match']}/mensagens/", {'conteudo': 'Oi, Ana! Está sim. Quer visitar amanhã?'},
           token=bruno, papel='participante')
    chamar('mensagem_vazia', 'POST', f"/api/matches/{ctx['match']}/mensagens/", {'conteudo': '   '}, token=ana, papel='participante')
    chamar('mensagem_longa', 'POST', f"/api/matches/{ctx['match']}/mensagens/", {'conteudo': 'x' * 1001}, token=ana, papel='participante')
    chamar('conversas_ok', 'GET', '/api/conversas/', token=ana, papel='comum')
    chamar('conversas_admin', 'GET', '/api/conversas/', token=admin, papel='admin')
    chamar('conversas_filtros', 'GET', '/api/conversas/?q=bruno&nao_lidas=true', token=ana, papel='comum')
    chamar('mensagens_listar', 'GET', f"/api/matches/{ctx['match']}/mensagens/", token=ana, papel='participante')
    chamar('mensagens_apos', 'GET', f"/api/matches/{ctx['match']}/mensagens/?apos=1", token=bruno, papel='participante')
    chamar('mensagens_apos_invalido', 'GET', f"/api/matches/{ctx['match']}/mensagens/?apos=abc", token=ana, papel='participante')
    chamar('mensagens_nao_participante', 'GET', f"/api/matches/{ctx['match']}/mensagens/", token=carla, papel='participante')
    chamar('mensagens_match_inexistente', 'GET', '/api/matches/999999/mensagens/', token=ana, papel='participante')

    # ── Moderação ──
    chamar('denuncia_invalida', 'POST', '/api/moderacao/denuncias/', {'denunciado': 'abc', 'motivo': 'chato'}, token=ana, papel='comum')
    chamar('denuncia_usuario_inexistente', 'POST', '/api/moderacao/denuncias/',
           {'denunciado': 1000000, 'motivo': 'spam'}, token=ana, papel='comum')
    # id do usuário Carla (denunciada) via /me
    s, me_carla = chamar('me_carla', 'GET', '/api/auth/me/', token=carla, papel='logado')
    ctx['usuario_carla'] = me_carla['id']
    chamar('denuncia_a_si_mesma', 'POST', '/api/moderacao/denuncias/',
           {'denunciado': chamar('me_ana', 'GET', '/api/auth/me/', token=ana, papel='logado')[1]['id'], 'motivo': 'spam'},
           token=ana, papel='comum')
    s, r = chamar('denuncia_ok', 'POST', '/api/moderacao/denuncias/',
                  {'denunciado': ctx['usuario_carla'], 'motivo': 'spam', 'descricao': 'Anúncio repetido várias vezes.'},
                  token=ana, papel='comum')
    ctx['denuncia'] = r['id']
    chamar('admin_denuncias_listar', 'GET', '/api/admin/moderacao/denuncias/?status=pendente', token=admin, papel='admin')
    chamar('admin_denuncias_filtro_invalido', 'GET', '/api/admin/moderacao/denuncias/?status=aberta&data_inicio=31/12/2025', token=admin, papel='admin')
    chamar('admin_denuncias_comum', 'GET', '/api/admin/moderacao/denuncias/', token=ana, papel='comum')
    chamar('admin_denuncia_resolver', 'PATCH', f"/api/admin/moderacao/denuncias/{ctx['denuncia']}/",
           {'status': 'resolvida', 'resolucao': 'Anúncio duplicado; conta suspensa.'}, token=admin, papel='admin')
    chamar('admin_denuncia_resolver_de_novo', 'PATCH', f"/api/admin/moderacao/denuncias/{ctx['denuncia']}/",
           {'status': 'descartada'}, token=admin, papel='admin')
    chamar('admin_denuncia_inexistente', 'PATCH', '/api/admin/moderacao/denuncias/999999/', {'status': 'resolvida'}, token=admin, papel='admin')
    chamar('admin_suspender', 'POST', f"/api/admin/moderacao/usuarios/{ctx['usuario_carla']}/suspender/",
           {'motivo': 'Anúncios duplicados (denúncia procedente).'}, token=admin, papel='admin')
    chamar('admin_suspender_de_novo', 'POST', f"/api/admin/moderacao/usuarios/{ctx['usuario_carla']}/suspender/", {}, token=admin, papel='admin')
    chamar('login_suspensa', 'POST', '/api/auth/login/', {'email': 'carla.dias@exemplo.com', 'password': SENHA})
    chamar('curtida_perfil_suspenso', 'POST', '/api/curtidas/', {'perfil_destino': ctx['perfil_carla'], 'tipo': 'curtir'}, token=ana, papel='comum')
    chamar('admin_reativar', 'POST', f"/api/admin/moderacao/usuarios/{ctx['usuario_carla']}/reativar/", token=admin, papel='admin')
    chamar('admin_reativar_ativo', 'POST', f"/api/admin/moderacao/usuarios/{ctx['usuario_carla']}/reativar/", token=admin, papel='admin')
    chamar('admin_suspender_inexistente', 'POST', '/api/admin/moderacao/usuarios/999999/suspender/', {}, token=admin, papel='admin')

    # ── Painel e logs ──
    chamar('dashboard', 'GET', '/api/admin/dashboard/', token=admin, papel='admin')
    chamar('dashboard_filtros', 'GET', '/api/admin/dashboard/?regiao=Boa%20Viagem&tipo=oferecendo_vaga', token=admin, papel='admin')
    chamar('dashboard_periodo_invertido', 'GET', '/api/admin/dashboard/?data_inicio=2025-12-31&data_fim=2025-01-01', token=admin, papel='admin')
    chamar('dashboard_comum', 'GET', '/api/admin/dashboard/', token=ana, papel='comum')
    chamar('relatorios_catalogo', 'GET', '/api/admin/relatorios/', token=admin, papel='admin')
    chamar('relatorio_json', 'GET', '/api/admin/relatorios/matches/', token=admin, papel='admin')
    chamar('relatorio_csv', 'GET', '/api/admin/relatorios/usuarios/?formato=csv', token=admin, papel='admin')
    chamar('relatorio_inexistente', 'GET', '/api/admin/relatorios/nao-existe/', token=admin, papel='admin')
    chamar('relatorio_invalido', 'GET', '/api/admin/relatorios/atividade/?tipo=rei&formato=pdf', token=admin, papel='admin')
    chamar('usuarios_listar', 'GET', '/api/admin/usuarios/?tipo=buscando_vaga&page_size=2', token=admin, papel='admin')
    chamar('usuarios_filtro_invalido', 'GET', '/api/admin/usuarios/?ativo=talvez&tipo=rei', token=admin, papel='admin')
    chamar('usuarios_exportar', 'GET', '/api/admin/usuarios/exportar/?ativo=true', token=admin, papel='admin')
    chamar('logs_listar', 'GET', '/api/admin/logs/?acao=MATCH_CRIADO&page_size=2', token=admin, papel='admin')
    chamar('logs_filtro_invalido', 'GET', '/api/admin/logs/?acao=XYZ', token=admin, papel='admin')
    chamar('logs_por_usuario', 'GET', '/api/admin/logs/?usuario=ana.souza@exemplo.com&page_size=1', token=admin, papel='admin')
    chamar('logs_exportar', 'GET', '/api/admin/logs/exportar/?acao=LOGIN', token=admin, papel='admin')

    # ── Exclusão de perfil (por último: remove o perfil de Diego, que nem chegou a criar um; usa Carla) ──
    chamar('perfil_excluir_de_outro', 'DELETE', f"/api/perfis/{ctx['perfil_bruno']}/", token=carla, papel='dono')
    chamar('perfil_excluir', 'DELETE', f"/api/perfis/{ctx['perfil_carla']}/", token=carla, papel='dono')

    json.dump({'base': BASE, 'registros': registros}, open(SAIDA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(registros)} chamadas gravadas em {SAIDA}')


main()
