"""Executa chamadas REAIS contra uma API em execução e grava requisição + resposta em JSON.

Os exemplos de docs/api.md e do schema OpenAPI (/api/docs/) saem destas respostas: nada é inventado.
Use SOMENTE um banco descartável (nunca o de desenvolvimento): o script cria usuários, perfis, matches,
mensagens e uma denúncia.

Uso (API em http://127.0.0.1:8001, administrador já criado com `criar_admin`):
    ADMIN_EMAIL=admin@exemplo.com ADMIN_SENHA=... python scripts/gerar_exemplos_api.py saida.json [http://127.0.0.1:8001]

Afinidade por IA: a API principal precisa do modelo baixado (`baixar_modelo_ia`). Para capturar o 503 de
POST /api/admin/ia/testar/, suba uma SEGUNDA API no MESMO banco com IA_HABILITADA=False e informe-a em
BASE_SEM_IA (ex.: http://127.0.0.1:8002); sem ela, esse exemplo não é gerado.

Segredos: tokens saem como <TOKEN>/<REFRESH> e senhas como <SENHA>.
"""
import email
import glob
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = (sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:8001').rstrip('/')
BASE_SEM_IA = os.environ.get('BASE_SEM_IA', '').rstrip('/')
SAIDA = sys.argv[1] if len(sys.argv) > 1 else 'exemplos_api.json'
SENHA = 'SenhaExemplo123'  # só existe no banco descartável; nos exemplos aparece como <SENHA>
ADMIN_EMAIL = os.environ['ADMIN_EMAIL']
ADMIN_SENHA = os.environ['ADMIN_SENHA']

registros = []
ctx = {}


def link_do_ultimo_email():
    """Lê o e-mail de redefinição gravado pelo backend de arquivo (EMAIL_FILE_PATH) e devolve (uid, token)."""
    pasta = os.environ['EMAIL_FILE_PATH']
    arquivos = sorted(glob.glob(os.path.join(pasta, '*.log')), key=os.path.getmtime)
    msg = email.message_from_bytes(open(arquivos[-1], 'rb').read())
    for parte in msg.walk():
        if parte.get_content_type() == 'text/plain':
            texto = parte.get_payload(decode=True).decode('utf-8')
            achou = re.search(r'uid=([^&\s]+)&token=([^\s]+)', texto)
            return achou.group(1), achou.group(2)
    raise RuntimeError('e-mail de redefinição não encontrado')


def mascarar(valor, requisicao=False):
    """Troca tokens (e, na requisição, senhas) por marcadores, em qualquer profundidade."""
    if isinstance(valor, dict):
        saida = {}
        for k, v in valor.items():
            if k == 'access' and isinstance(v, str):
                saida[k] = '<TOKEN>'
            elif k == 'refresh' and isinstance(v, str):
                saida[k] = '<REFRESH>'
            elif k in ('password', 'nova_senha') and requisicao:
                saida[k] = '<SENHA>'
            elif k == 'uid' and requisicao:
                saida[k] = '<UID>'
            elif k == 'token' and requisicao:
                saida[k] = '<TOKEN_DO_LINK>'
            else:
                saida[k] = mascarar(v, requisicao)
        return saida
    if isinstance(valor, list):
        return [mascarar(v, requisicao) for v in valor]
    return valor


def chamar(id_, metodo, rota, corpo=None, token=None, papel='publico', nota='', base=None):
    """Faz a chamada, guarda o registro e devolve (status, corpo JSON ou texto)."""
    url = (base or BASE) + rota
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
    chamar('registrar_fabio', 'POST', '/api/auth/registrar/',
           {'username': 'Fábio Rocha', 'email': 'fabio.rocha@exemplo.com', 'password': SENHA, 'tipo': 'oferecendo_vaga'})
    chamar('registrar_email_duplicado', 'POST', '/api/auth/registrar/',
           {'username': 'Ana Souza', 'email': 'ANA.SOUZA@exemplo.com', 'password': SENHA, 'tipo': 'buscando_vaga'})
    chamar('registrar_campos_invalidos', 'POST', '/api/auth/registrar/',
           {'username': 'A', 'email': 'isso-nao-e-email', 'password': '123', 'tipo': 'dono'})
    chamar('registrar_vazio', 'POST', '/api/auth/registrar/', {})

    chamar('login_senha_errada', 'POST', '/api/auth/login/', {'email': 'ana.souza@exemplo.com', 'password': 'errada'})
    chamar('login_vazio', 'POST', '/api/auth/login/', {})
    # Limite de tentativas: suba a API com LOGIN_LIMITE_EMAIL=3/hour (e LOGIN_LIMITE_IP alto). E-mail inexistente de propósito.
    for n in (1, 2, 3):
        chamar(f'login_tentativa_{n}', 'POST', '/api/auth/login/', {'email': 'limite@exemplo.com', 'password': 'errada'})
    chamar('login_limite', 'POST', '/api/auth/login/', {'email': 'LIMITE@exemplo.com', 'password': 'errada'})
    ana, ana_ref = login('login_ok', 'Ana.Souza@exemplo.com', SENHA)
    bruno, _ = login('login_bruno', 'bruno.lima@exemplo.com', SENHA)
    carla, _ = login('login_carla', 'carla.dias@exemplo.com', SENHA)
    diego, _ = login('login_diego', 'diego.alves@exemplo.com', SENHA)
    fabio, _ = login('login_fabio', 'fabio.rocha@exemplo.com', SENHA)
    admin, _ = login('login_admin', ADMIN_EMAIL, ADMIN_SENHA)

    chamar('refresh_ok', 'POST', '/api/auth/login/refresh/', {'refresh': ana_ref})
    chamar('refresh_invalido', 'POST', '/api/auth/login/refresh/', {'refresh': 'token-invalido'})
    _, ana_sair = login('login_ana_logout', 'ana.souza@exemplo.com', SENHA)
    chamar('logout_ok', 'POST', '/api/auth/logout/', {'refresh': ana_sair})
    chamar('logout_invalido', 'POST', '/api/auth/logout/', {'refresh': ana_sair})
    chamar('logout_vazio', 'POST', '/api/auth/logout/', {})

    # ── Recuperação de senha (use a API com EMAIL_BACKEND de arquivo e EMAIL_FILE_PATH igual ao do ambiente deste script) ──
    chamar('registrar_eva', 'POST', '/api/auth/registrar/',
           {'username': 'Eva Martins', 'email': 'eva.martins@exemplo.com', 'password': SENHA, 'tipo': 'buscando_vaga'})
    chamar('senha_solicitar_ok', 'POST', '/api/auth/senha/solicitar/', {'email': 'eva.martins@exemplo.com'})
    chamar('senha_solicitar_inexistente', 'POST', '/api/auth/senha/solicitar/', {'email': 'ninguem@exemplo.com'})
    chamar('senha_solicitar_vazio', 'POST', '/api/auth/senha/solicitar/', {})
    chamar('senha_solicitar_invalido', 'POST', '/api/auth/senha/solicitar/', {'email': 'isso-nao-e-email'})
    uid_eva, token_eva = link_do_ultimo_email()
    chamar('senha_redefinir_vazio', 'POST', '/api/auth/senha/redefinir/', {})
    chamar('senha_redefinir_fraca', 'POST', '/api/auth/senha/redefinir/', {'uid': uid_eva, 'token': token_eva, 'nova_senha': '123'})
    chamar('senha_redefinir_ok', 'POST', '/api/auth/senha/redefinir/', {'uid': uid_eva, 'token': token_eva, 'nova_senha': 'NovaSenhaExemplo123'})
    chamar('senha_redefinir_invalido', 'POST', '/api/auth/senha/redefinir/', {'uid': uid_eva, 'token': token_eva, 'nova_senha': 'OutraSenhaExemplo123'},
           nota='O mesmo link usado uma segunda vez.')
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
    # Fábio: bio curta e sem anúncio → sem embedding (o critério de IA é ignorado nos scores dele)
    s, r = chamar('perfil_criar_fabio', 'POST', '/api/perfis/', {**PERFIL_BRUNO, 'nome': 'Fábio Rocha', 'bio': 'Oi!',
                  'titulo_anuncio': '', 'descricao_imovel': '', 'fotos_imovel': [], 'foto_perfil_url': ''},
                  token=fabio, papel='comum')
    ctx['perfil_fabio'] = r['id']
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

    # ── Detalhamento da compatibilidade (7 critérios, com a Afinidade por IA) ──
    chamar('compatibilidade_ok', 'GET', f"/api/compatibilidade/{ctx['perfil_bruno']}/", token=ana, papel='comum',
           nota='Ana (buscando vaga) e Bruno (oferecendo vaga): as duas bios têm embedding.')
    chamar('compatibilidade_sem_ia', 'GET', f"/api/compatibilidade/{ctx['perfil_fabio']}/", token=ana, papel='comum',
           nota='A bio de Fábio tem menos de 20 letras: o critério de IA fica de fora e os 6 pesos são renormalizados.')
    chamar('compatibilidade_sem_perfil', 'GET', f"/api/compatibilidade/{ctx['perfil_bruno']}/", token=diego, papel='comum',
           nota='Diego ainda não criou o perfil.')
    chamar('compatibilidade_mesmo_tipo', 'GET', f"/api/compatibilidade/{ctx['perfil_carla']}/", token=bruno, papel='comum',
           nota='Bruno e Carla oferecem vaga (mesmo tipo).')
    chamar('compatibilidade_admin', 'GET', f"/api/compatibilidade/{ctx['perfil_bruno']}/", token=admin, papel='admin')
    chamar('compatibilidade_inexistente', 'GET', '/api/compatibilidade/999999/', token=ana, papel='comum')

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
    chamar('denuncia_duplicada', 'POST', '/api/moderacao/denuncias/',
           {'denunciado': ctx['usuario_carla'], 'motivo': 'spam', 'descricao': 'Denúncia repetida.'}, token=ana, papel='comum')
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

    # ── Afinidade por IA (administrador) ──
    chamar('ia_status', 'GET', '/api/admin/ia/status/', token=admin, papel='admin')
    chamar('ia_status_comum', 'GET', '/api/admin/ia/status/', token=ana, papel='comum')
    chamar('ia_testar_ok', 'POST', '/api/admin/ia/testar/',
           {'texto_a': 'Adoro cozinhar para os amigos e testar receitas novas.',
            'texto_b': 'Faço jantares em casa no fim de semana e sempre sobra comida.'}, token=admin, papel='admin',
           nota='Mesmo interesse (culinária) escrito com palavras diferentes.')
    chamar('ia_testar_opostos', 'POST', '/api/admin/ia/testar/',
           {'texto_a': 'Adoro festas e baladas, minha casa vive cheia de gente com música alta.',
            'texto_b': 'Preciso de silêncio e de uma casa tranquila; durmo cedo e evito barulho.'}, token=admin, papel='admin')
    chamar('ia_testar_invalido', 'POST', '/api/admin/ia/testar/', {'texto_a': '   ', 'texto_b': 'x' * 1001}, token=admin, papel='admin')
    chamar('ia_testar_comum', 'POST', '/api/admin/ia/testar/', {'texto_a': 'Adoro cozinhar.', 'texto_b': 'Faço jantares.'},
           token=ana, papel='comum')
    if BASE_SEM_IA:
        chamar('ia_testar_indisponivel', 'POST', '/api/admin/ia/testar/',
               {'texto_a': 'Adoro cozinhar para os amigos.', 'texto_b': 'Faço jantares em casa.'}, token=admin, papel='admin',
               nota='Servidor com IA_HABILITADA=False (o mesmo vale para o modelo indisponível).', base=BASE_SEM_IA)

    # ── Painel e logs ──
    chamar('dashboard', 'GET', '/api/admin/dashboard/', token=admin, papel='admin')
    chamar('dashboard_periodo_longo', 'GET', '/api/admin/dashboard/?data_inicio=2020-01-01&data_fim=2026-11-30', token=admin, papel='admin')
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
