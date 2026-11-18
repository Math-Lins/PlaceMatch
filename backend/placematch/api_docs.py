"""Documentação OpenAPI da API (drf-spectacular).

Fonte única das anotações: cada operação tem uma entrada em OPERACOES (grupo, resumo, descrição, quem pode,
parâmetros, corpo, respostas e exemplos reais). As views usam `@extend_schema(**doc('chave'))` e o
`docs/api.md` é gerado a partir daqui (scripts/gerar_docs_api.py markdown), então os dois nunca divergem.

Os exemplos vêm de placematch/exemplos_api.py (respostas REAIS, capturadas por scripts/gerar_exemplos_api.py).
"""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, OpenApiResponse
from rest_framework import serializers as s

from matches.serializers import MatchSerializer, PerfilDescobertoSerializer
from perfis.serializers import PerfilSerializer
from placematch.exemplos_api import EXEMPLOS
from chat.serializers import MensagemSerializer
from usuarios.serializers import RegistrarSerializer, UsuarioSerializer

# ── Esquemas auxiliares ──────────────────────────────────────────────────────────

def _classe(nome, campos):
    """Cria uma classe Serializer (usada só para documentar corpos e respostas)."""
    return type(nome, (s.Serializer,), dict(campos))


ErroDetalhe = _classe('ErroDetalhe', {
    'detail': s.CharField(help_text='Mensagem de erro em português.'),
})
# Erros por campo: objeto {"campo": ["mensagem", ...]} (chaves = nomes dos campos)
ErroCampos = OpenApiTypes.OBJECT

TokensResposta = _classe('TokensResposta', {
    'access': s.CharField(help_text='Token de acesso (JWT), válido por 1 hora.'),
    'refresh': s.CharField(help_text='Token de renovação, válido por 7 dias (rotacionado a cada renovação).'),
})
LoginRequisicao = _classe('LoginRequisicao', {
    'email': s.CharField(help_text='E-mail do usuário (sem diferenciar maiúsculas).'),
    'password': s.CharField(help_text='Senha.'),
})
RefreshRequisicao = _classe('RefreshRequisicao', {
    'refresh': s.CharField(help_text='Token de renovação recebido no login.'),
})
CurtidaRequisicao = _classe('CurtidaRequisicao', {
    'perfil_destino': s.IntegerField(help_text='Id do PERFIL (não do usuário) a avaliar.'),
    'tipo': s.ChoiceField(choices=['curtir', 'recusar'], help_text='Ação.'),
})
CurtidaResposta = _classe('CurtidaResposta', {
    'match': s.BooleanField(help_text='true quando a outra pessoa já tinha curtido (match criado).'),
    'match_data': MatchSerializer(required=False, help_text='Presente só quando `match` é true.'),
})
MensagemRequisicao = _classe('MensagemRequisicao', {
    'conteudo': s.CharField(max_length=1000, help_text='Texto da mensagem (1 a 1000 caracteres; não pode ser só espaços).'),
})
_OutroPerfil = _classe('ConversaOutroPerfil', {
    'id': s.IntegerField(), 'usuario_id': s.IntegerField(), 'nome': s.CharField(), 'idade': s.IntegerField(),
    'regiao': s.CharField(), 'tipo': s.CharField(help_text='Tipo do usuário do outro perfil.'),
    'titulo_anuncio': s.CharField(), 'descricao_imovel': s.CharField(),
    'fotos_imovel': s.ListField(child=s.CharField()), 'foto_perfil_url': s.CharField(),
    'tipo_imovel': s.CharField(), 'qtd_moradores': s.IntegerField(),
    'orcamento_min': s.CharField(help_text='Decimal em texto.'), 'orcamento_max': s.CharField(help_text='Decimal em texto.'),
    'aceita_pets': s.BooleanField(), 'fumante': s.BooleanField(),
})
_UltimaMensagem = _classe('ConversaUltimaMensagem', {
    'conteudo': s.CharField(), 'data_envio': s.DateTimeField(), 'remetente_id': s.IntegerField(help_text='Id do PERFIL remetente.'),
})
ConversaResposta = _classe('Conversa', {
    'match_id': s.IntegerField(), 'outro_perfil': _OutroPerfil(), 'score': s.FloatField(help_text='De 0 a 1.'),
    'ultima_mensagem': _UltimaMensagem(allow_null=True), 'nao_lidas': s.IntegerField(help_text='Mensagens do outro participante ainda não lidas.'),
})
DenunciaRequisicao = _classe('DenunciaRequisicao', {
    'denunciado': s.IntegerField(help_text='Id do USUÁRIO denunciado (não do perfil).'),
    'motivo': s.ChoiceField(choices=['spam', 'ofensivo', 'falso', 'outro']),
    'descricao': s.CharField(required=False, max_length=500, help_text='Detalhes (até 500 caracteres).'),
})
DenunciaCriada = _classe('DenunciaCriada', {
    'id': s.IntegerField(), 'denunciado': s.IntegerField(), 'motivo': s.CharField(),
    'status': s.CharField(help_text='Sempre `pendente` ao criar.'), 'criada_em': s.DateTimeField(),
})
_PessoaResumo = _classe('PessoaResumo', {'id': s.IntegerField(allow_null=True), 'email': s.CharField(allow_null=True)})
DenunciaAdmin = _classe('DenunciaAdmin', {
    'id': s.IntegerField(), 'denunciante': _PessoaResumo(), 'denunciado': _PessoaResumo(),
    'motivo': s.CharField(), 'motivo_display': s.CharField(), 'descricao': s.CharField(),
    'status': s.ChoiceField(choices=['pendente', 'resolvida', 'descartada']),
    'resolvida_por': s.CharField(allow_null=True, help_text='E-mail do administrador que decidiu.'),
    'resolucao': s.CharField(), 'criada_em': s.DateTimeField(), 'atualizada_em': s.DateTimeField(),
})
ResolverRequisicao = _classe('ResolverDenunciaRequisicao', {
    'status': s.ChoiceField(choices=['resolvida', 'descartada']),
    'resolucao': s.CharField(required=False, max_length=500, help_text='Observação (até 500 caracteres).'),
})
ResolverResposta = _classe('ResolverDenunciaResposta', {
    'id': s.IntegerField(), 'status': s.CharField(), 'resolucao': s.CharField(), 'resolvida_por': s.CharField(help_text='E-mail do administrador.'),
})
SuspenderRequisicao = _classe('SuspenderRequisicao', {
    'motivo': s.CharField(required=False, max_length=500, help_text='Motivo (até 500 caracteres).'),
})
ContaResposta = _classe('ContaResposta', {
    'id': s.IntegerField(), 'email': s.CharField(), 'ativo': s.BooleanField(help_text='false = conta suspensa.'),
})
_PontoSerie = _classe('PontoSerie', {'data': s.DateField(), 'total': s.IntegerField()})
DashboardResposta = _classe('Dashboard', {
    'kpis': _classe('DashboardKpis', {
        'usuarios_total': s.IntegerField(), 'usuarios_por_tipo': s.DictField(child=s.IntegerField()),
        'usuarios_suspensos': s.IntegerField(), 'perfis_total': s.IntegerField(), 'curtidas_total': s.IntegerField(),
        'recusas_total': s.IntegerField(), 'matches_total': s.IntegerField(), 'taxa_match': s.FloatField(help_text=(
            'Em %, de 0 a 100: curtidas positivas que fazem parte de um match ÷ curtidas positivas × 100. '
            'As duas contagens usam o mesmo conjunto de curtidas de `curtidas_total` (mesmo filtro de região/tipo, '
            'aplicado ao perfil de origem da curtida). Sem curtidas: 0.')),
        'mensagens_total': s.IntegerField(), 'conversas_ativas': s.IntegerField(), 'score_medio': s.FloatField(allow_null=True, help_text='De 0 a 1.'),
        'denuncias_pendentes': s.IntegerField(),
    })(),
    'series': _classe('DashboardSeries', {
        'matches_por_dia': _PontoSerie(many=True), 'curtidas_por_dia': _PontoSerie(many=True), 'mensagens_por_dia': _PontoSerie(many=True),
    })(),
    'top_regioes': _classe('TopRegiao', {
        'regiao': s.CharField(), 'perfis': s.IntegerField(), 'matches': s.IntegerField(), 'score_medio': s.FloatField(allow_null=True),
    })(many=True),
    'distribuicao_score': _classe('FaixaScore', {'faixa': s.CharField(help_text='Ex.: "0-20".'), 'total': s.IntegerField()})(many=True),
    'filtros_aplicados': s.DictField(child=s.CharField(allow_null=True)),
})
RelatorioCatalogo = _classe('RelatorioCatalogo', {
    'id': s.CharField(), 'titulo': s.CharField(), 'descricao': s.CharField(), 'filtros': s.ListField(child=s.CharField()),
})(many=True)
RelatorioResposta = _classe('RelatorioResposta', {
    'titulo': s.CharField(), 'colunas': s.ListField(child=s.CharField()),
    'linhas': s.ListField(child=s.ListField(child=s.JSONField())), 'totais': s.DictField(child=s.JSONField()),
    'filtros_aplicados': s.DictField(child=s.CharField()), 'gerado_em': s.DateTimeField(),
})
UsuarioAdmin = _classe('UsuarioAdmin', {
    'id': s.IntegerField(), 'nome': s.CharField(), 'email': s.CharField(), 'tipo': s.CharField(),
    'regiao': s.CharField(allow_null=True), 'data_cadastro': s.DateTimeField(), 'tem_perfil': s.BooleanField(), 'ativo': s.BooleanField(),
})
UsuariosPagina = _classe('UsuariosPagina', {'count': s.IntegerField(), 'page': s.IntegerField(), 'results': UsuarioAdmin(many=True)})
_LogUsuario = _classe('LogUsuario', {'id': s.IntegerField(), 'nome': s.CharField(), 'email': s.CharField()})
LogItem = _classe('LogItem', {
    'id': s.IntegerField(), 'data_hora': s.DateTimeField(), 'usuario': _LogUsuario(allow_null=True),
    'acao': s.CharField(), 'acao_label': s.CharField(), 'entidade': s.CharField(), 'entidade_id': s.IntegerField(allow_null=True),
    'detalhes': s.DictField(), 'ip': s.CharField(allow_null=True),
})
LogsPagina = _classe('LogsPagina', {'count': s.IntegerField(), 'page': s.IntegerField(), 'results': LogItem(many=True)})


# ── Parâmetros de consulta ───────────────────────────────────────────────────────

def P(nome, tipo, descricao, enum=None, exemplo=None):
    return OpenApiParameter(nome, tipo, OpenApiParameter.QUERY, description=descricao, enum=enum,
                            examples=[OpenApiExample('Exemplo', value=exemplo)] if exemplo is not None else None)


DATA = 'Formato `AAAA-MM-DD`. Formato inválido ou `data_inicio` maior que `data_fim` → 400.'
P_PAGINA = [
    P('page', OpenApiTypes.INT, 'Página (padrão 1). Valor inválido volta à página 1; página além do fim devolve `results: []`.', exemplo=1),
    P('page_size', OpenApiTypes.INT, 'Itens por página (padrão 20, máximo 100).', exemplo=20),
]
TIPOS_USUARIO = ['buscando_vaga', 'oferecendo_vaga', 'administrador']
ACOES_LOG = ['LOGIN', 'LOGIN_FALHA', 'CADASTRO', 'PERFIL_CRIADO', 'PERFIL_EDITADO', 'PERFIL_EXCLUIDO', 'CURTIDA', 'RECUSA',
             'MATCH_CRIADO', 'MENSAGEM_ENVIADA', 'RELATORIO_EXPORTADO', 'DENUNCIA_CRIADA', 'DENUNCIA_RESOLVIDA',
             'USUARIO_SUSPENSO', 'USUARIO_REATIVADO']
RELATORIOS = ['matches', 'compatibilidade-regiao', 'atividade', 'usuarios', 'denuncias']

COMUM = 'Usuário comum (`buscando_vaga` ou `oferecendo_vaga`); o administrador recebe 403'
LOGADO = 'Qualquer usuário logado'
ADMIN = 'Somente administrador'
PUBLICO = 'Público (sem login)'

# ── Operações ────────────────────────────────────────────────────────────────────
# erros: (status, id do exemplo real, rótulo). ok: (status, serializer, id do exemplo, descrição, [(id, rótulo) extras]).

OPERACOES = {
    # ───────── Autenticação ─────────
    'auth_registrar': dict(
        metodo='POST', rota='/api/auth/registrar/', tag='Autenticação', quem=PUBLICO, publico=True,
        resumo='Cadastrar usuário',
        descricao=('Cria uma conta de usuário comum. O campo `username` recebe o **nome da pessoa** (2 a 150 caracteres; aceita espaços e acentos). '
                   'O e-mail é gravado em minúsculas e é único sem diferenciar maiúsculas. A senha segue os validadores do Django '
                   '(mínimo 8 caracteres, não só números, não muito comum). `administrador` não pode ser escolhido aqui '
                   '(use `python manage.py criar_admin`). Depois do cadastro, faça o login e crie o perfil.'),
        request=RegistrarSerializer, req_ex=[('registrar_ok', 'Cadastro de quem procura vaga'), ('registrar_bruno', 'Cadastro de quem oferece vaga')],
        ok=(201, RegistrarSerializer, 'registrar_ok', 'Usuário criado (a senha nunca é devolvida).', []),
        erros=[(400, 'registrar_email_duplicado', 'E-mail já cadastrado (sem diferenciar maiúsculas)'),
               (400, 'registrar_campos_invalidos', 'Vários campos inválidos'),
               (400, 'registrar_vazio', 'Corpo vazio: campos obrigatórios')],
    ),
    'auth_login': dict(
        metodo='POST', rota='/api/auth/login/', tag='Autenticação', quem=PUBLICO, publico=True,
        resumo='Entrar (login por e-mail)',
        descricao=('Autentica por e-mail e senha (e-mail sem diferenciar maiúsculas) e devolve os tokens JWT. '
                   'Envie o `access` no cabeçalho `Authorization: Bearer <access>` das demais chamadas. '
                   'Contas suspensas recebem 401 com a mensagem "Conta suspensa. Procure o suporte.".'),
        request=LoginRequisicao, req_ex=[('login_ok', 'Login')],
        ok=(200, TokensResposta, 'login_ok', 'Tokens de acesso e de renovação.', []),
        erros=[(400, 'login_vazio', 'E-mail e senha ausentes'),
               (401, 'login_senha_errada', 'Senha incorreta ou usuário inexistente'),
               (401, 'login_suspensa', 'Conta suspensa')],
    ),
    'auth_refresh': dict(
        metodo='POST', rota='/api/auth/login/refresh/', tag='Autenticação', quem=PUBLICO, publico=True,
        resumo='Renovar o token de acesso',
        descricao=('Troca um `refresh` válido por um novo `access` e por um **novo `refresh`** (o refresh é rotacionado: '
                   'guarde o novo). O `access` dura 1 hora; o `refresh`, 7 dias.'),
        request=RefreshRequisicao, req_ex=[('refresh_ok', 'Renovação')],
        ok=(200, TokensResposta, 'refresh_ok', 'Novo access e novo refresh.', []),
        erros=[(401, 'refresh_invalido', 'Refresh inválido, expirado ou de conta suspensa')],
    ),
    'auth_me': dict(
        metodo='GET', rota='/api/auth/me/', tag='Autenticação', quem=LOGADO,
        resumo='Dados do usuário logado',
        descricao='Devolve o usuário do token. `username` e `nome` trazem o nome de exibição (o nome informado no cadastro).',
        ok=(200, UsuarioSerializer, 'me_ok', 'Usuário logado.', []), erros=[],
    ),
    # ───────── Perfis ─────────
    'perfis_listar': dict(
        metodo='GET', rota='/api/perfis/', tag='Perfis', quem=LOGADO,
        resumo='Listar o próprio perfil',
        descricao='Devolve uma lista com o **próprio** perfil do usuário (vazia se ainda não criou). O administrador recebe todos os perfis.',
        ok=(200, PerfilSerializer(many=True), 'perfil_listar', 'Lista de perfis.', []), erros=[],
    ),
    'perfis_criar': dict(
        metodo='POST', rota='/api/perfis/', tag='Perfis', quem=COMUM,
        resumo='Criar o perfil',
        descricao=('Cria o perfil do usuário logado (um por usuário). Quem oferece vaga pode enviar também os campos do anúncio '
                   '(`titulo_anuncio`, `descricao_imovel`, `fotos_imovel`, `foto_perfil_url`). Ao salvar, as compatibilidades com os perfis '
                   'do tipo oposto são recalculadas.'),
        request=PerfilSerializer, req_ex=[('perfil_criar', 'Perfil de quem procura vaga'), ('perfil_criar_anuncio', 'Perfil com anúncio (oferecendo vaga)')],
        ok=(201, PerfilSerializer, 'perfil_criar', 'Perfil criado.', [('perfil_criar_anuncio', 'Perfil com anúncio')]),
        erros=[(400, 'perfil_criar_invalido', 'Campos inválidos'), (400, 'perfil_criar_duplicado', 'Usuário já tem perfil'),
               (403, 'perfil_criar_admin', 'Administrador não cria perfil')],
    ),
    'perfis_consultar': dict(
        metodo='GET', rota='/api/perfis/{id}/', tag='Perfis', quem=LOGADO,
        resumo='Consultar um perfil',
        descricao=('Permitido para: o próprio perfil, perfis do **tipo oposto** (os da Descoberta), perfis de quem tem match com você '
                   'e o administrador. Qualquer outro caso → 403. Perfil de conta suspensa (de outra pessoa) → 404; só o administrador o enxerga.'),
        ok=(200, PerfilSerializer, 'perfil_consultar', 'Perfil.', []),
        erros=[(403, 'perfil_consultar_mesmo_tipo', 'Perfil do mesmo tipo, sem match'), (404, 'perfil_consultar_inexistente', 'Perfil inexistente')],
    ),
    'perfis_atualizar': dict(
        metodo='PUT', rota='/api/perfis/{id}/', tag='Perfis', quem='Dono do perfil',
        resumo='Atualizar o perfil (completo)',
        descricao='Substitui todos os campos do perfil. Somente o dono (outro usuário recebe 403).',
        request=PerfilSerializer, req_ex=[('perfil_atualizar_completo', 'Atualização completa')],
        ok=(200, PerfilSerializer, 'perfil_atualizar_completo', 'Perfil atualizado.', []),
        erros=[(400, 'perfil_atualizar_invalido', 'Campo inválido'), (403, 'perfil_atualizar_de_outro', 'Perfil de outra pessoa'),
               (404, 'perfil_consultar_inexistente', 'Perfil inexistente')],
    ),
    'perfis_atualizar_parcial': dict(
        metodo='PATCH', rota='/api/perfis/{id}/', tag='Perfis', quem='Dono do perfil',
        resumo='Atualizar o perfil (parcial)',
        descricao='Altera só os campos enviados. As regras cruzadas valem com os dados atuais (ex.: `orcamento_min` não pode passar de `orcamento_max`).',
        request=PerfilSerializer, req_ex=[('perfil_atualizar_parcial', 'Alterar bio e orçamento máximo')],
        ok=(200, PerfilSerializer, 'perfil_atualizar_parcial', 'Perfil atualizado.', []),
        erros=[(400, 'perfil_atualizar_invalido', 'Campo inválido'), (403, 'perfil_atualizar_de_outro', 'Perfil de outra pessoa'),
               (404, 'perfil_consultar_inexistente', 'Perfil inexistente')],
    ),
    'perfis_excluir': dict(
        metodo='DELETE', rota='/api/perfis/{id}/', tag='Perfis', quem='Dono do perfil',
        resumo='Excluir o perfil',
        descricao='Exclui o perfil e, em cascata, suas curtidas, compatibilidades, matches e mensagens. Não há desfazer.',
        ok=(204, None, 'perfil_excluir', 'Perfil excluído (sem corpo).', []),
        erros=[(403, 'perfil_excluir_de_outro', 'Perfil de outra pessoa'), (404, 'perfil_consultar_inexistente', 'Perfil inexistente')],
    ),
    # ───────── Descoberta e Matches ─────────
    'descoberta_listar': dict(
        metodo='GET', rota='/api/descoberta/', tag='Descoberta e Matches', quem=COMUM,
        resumo='Descobrir perfis compatíveis',
        descricao=('Lista os perfis do **tipo oposto** com o score de compatibilidade (0 a 1), por score decrescente. Exige perfil criado. '
                   'Não aparecem: o próprio perfil, perfis já avaliados, perfis já em match e contas suspensas.'),
        params=[
            P('q', OpenApiTypes.STR, 'Texto: nome, região ou título do anúncio.', exemplo='praia'),
            P('regiao', OpenApiTypes.STR, 'Região exata. Repetível: `?regiao=A&regiao=B`.', exemplo='Boa Viagem'),
            P('tipo_imovel', OpenApiTypes.STR, 'Tipo de imóvel.', enum=['apartamento', 'casa', 'republica', 'indiferente']),
            P('aceita_pets', OpenApiTypes.STR, 'Só perfis que aceitam (`true`) ou não (`false`) pets.', enum=['true', 'false']),
            P('fumante', OpenApiTypes.STR, 'Só perfis fumantes (`true`) ou não (`false`).', enum=['true', 'false']),
            P('orcamento_min', OpenApiTypes.DECIMAL, 'Orçamento mínimo (0 a 99999999.99; NaN, infinito e negativos → 400). Filtra por interseção de faixas.', exemplo=500),
            P('orcamento_max', OpenApiTypes.DECIMAL, 'Orçamento máximo (mesmas regras).', exemplo=1500),
            P('score_min', OpenApiTypes.FLOAT, 'Compatibilidade mínima em % (0 a 100).', exemplo=50),
            P('ordenar', OpenApiTypes.STR, 'Ordenação.', enum=['score', 'orcamento_asc', 'orcamento_desc']),
        ],
        ok=(200, PerfilDescobertoSerializer(many=True), 'descoberta_ok', 'Perfis compatíveis (`score` de 0 a 1).', [('descoberta_filtros', 'Com filtros')]),
        erros=[(400, 'descoberta_sem_perfil', 'Usuário ainda sem perfil'), (400, 'descoberta_filtro_invalido', 'Filtro inválido'),
               (403, 'descoberta_admin', 'Administrador')],
    ),
    'curtidas_criar': dict(
        metodo='POST', rota='/api/curtidas/', tag='Descoberta e Matches', quem=COMUM,
        resumo='Curtir ou recusar um perfil',
        descricao=('Registra a avaliação. Se a outra pessoa já tinha curtido você, o **match é criado** e a resposta traz `match: true` com `match_data`. '
                   'Só vale para perfis do tipo oposto, uma vez por perfil. Perfil de conta suspensa → 404.'),
        request=CurtidaRequisicao, req_ex=[('curtida_ok', 'Curtir'), ('curtida_recusar', 'Recusar')],
        ok=(201, CurtidaResposta, 'curtida_ok', 'Avaliação registrada (sem match ainda).', [('curtida_match', 'Curtida mútua: match criado')]),
        erros=[(400, 'curtida_inexistente', 'Perfil inexistente'), (400, 'curtida_mesmo_tipo', 'Próprio perfil'),
               (400, 'curtida_duplicada', 'Já avaliado'), (400, 'curtida_vazia', 'Campos ausentes'),
               (403, 'curtida_admin', 'Administrador'), (404, 'curtida_perfil_suspenso', 'Perfil de conta suspensa')],
    ),
    'matches_listar': dict(
        metodo='GET', rota='/api/matches/', tag='Descoberta e Matches', quem=LOGADO,
        resumo='Listar os matches',
        descricao='Matches do usuário logado, por score decrescente. Matches com conta suspensa não aparecem. Sem perfil → lista vazia.',
        ok=(200, MatchSerializer(many=True), 'matches_ok', 'Matches (cada perfil traz os campos públicos).', []), erros=[],
    ),
    # ───────── Chat ─────────
    'chat_conversas': dict(
        metodo='GET', rota='/api/conversas/', tag='Chat', quem=COMUM,
        resumo='Listar conversas',
        descricao='Uma conversa por match, da atividade mais recente para a mais antiga, com a última mensagem e a contagem de não lidas.',
        params=[
            P('q', OpenApiTypes.STR, 'Nome ou título do anúncio do outro perfil (sem diferenciar maiúsculas).', exemplo='bruno'),
            P('nao_lidas', OpenApiTypes.STR, 'Com `true`, só conversas com mensagens não lidas.', enum=['true', 'false']),
        ],
        ok=(200, ConversaResposta(many=True), 'conversas_ok', 'Conversas.', [('conversas_filtros', 'Com filtros')]),
        erros=[(403, 'conversas_admin', 'Administrador')],
    ),
    'chat_mensagens_listar': dict(
        metodo='GET', rota='/api/matches/{match_id}/mensagens/', tag='Chat', quem='Participante do match',
        resumo='Listar mensagens de um match',
        descricao='Mensagens em ordem cronológica. As mensagens do **outro** participante passam a `lida: true`. Contas suspensas continuam legíveis.',
        params=[P('apos', OpenApiTypes.INT, 'Devolve só mensagens com id maior que este (polling). Inteiro ≥ 0; outro valor → 400.', exemplo=1)],
        ok=(200, MensagemSerializer(many=True), 'mensagens_listar', 'Mensagens.', [('mensagens_apos', 'Só as novas (`?apos=1`)')]),
        erros=[(400, 'mensagens_apos_invalido', '`apos` inválido'), (403, 'mensagens_nao_participante', 'Não participa do match'),
               (404, 'mensagens_match_inexistente', 'Match inexistente')],
    ),
    'chat_mensagens_enviar': dict(
        metodo='POST', rota='/api/matches/{match_id}/mensagens/', tag='Chat', quem='Participante do match',
        resumo='Enviar mensagem',
        descricao=('Envia uma mensagem de texto (1 a 1000 caracteres). Recusa conteúdo vazio, só espaços ou que não seja texto. '
                   'Se o outro participante estiver com a conta suspensa → 403.'),
        request=MensagemRequisicao, req_ex=[('mensagem_enviar', 'Mensagem')],
        ok=(201, MensagemSerializer, 'mensagem_enviar', 'Mensagem criada.', [('mensagem_responder', 'Resposta da outra pessoa')]),
        erros=[(400, 'mensagem_vazia', 'Conteúdo vazio ou só espaços'), (400, 'mensagem_longa', 'Mais de 1000 caracteres'),
               (403, 'mensagens_nao_participante', 'Não participa do match'), (404, 'mensagens_match_inexistente', 'Match inexistente')],
    ),
    # ───────── Moderação ─────────
    'moderacao_denunciar': dict(
        metodo='POST', rota='/api/moderacao/denuncias/', tag='Moderação', quem=COMUM,
        resumo='Denunciar um usuário',
        descricao='Cria uma denúncia `pendente`. `denunciado` é o id do **usuário** (campo `usuario_id` dos perfis). Não vale denunciar a si mesmo.',
        request=DenunciaRequisicao, req_ex=[('denuncia_ok', 'Denúncia por spam')],
        ok=(201, DenunciaCriada, 'denuncia_ok', 'Denúncia criada.', []),
        erros=[(400, 'denuncia_invalida', 'Id e motivo inválidos'), (400, 'denuncia_usuario_inexistente', 'Usuário inexistente'),
               (400, 'denuncia_a_si_mesma', 'Autodenúncia')],
    ),
    'moderacao_denuncias_listar': dict(
        metodo='GET', rota='/api/admin/moderacao/denuncias/', tag='Moderação', quem=ADMIN,
        resumo='Listar denúncias',
        descricao='Denúncias da mais recente para a mais antiga. Valores inválidos nos filtros → 400.',
        params=[
            P('status', OpenApiTypes.STR, 'Situação.', enum=['pendente', 'resolvida', 'descartada']),
            P('denunciado', OpenApiTypes.INT, 'Id do usuário denunciado.', exemplo=4),
            P('motivo', OpenApiTypes.STR, 'Motivo.', enum=['spam', 'ofensivo', 'falso', 'outro']),
            P('data_inicio', OpenApiTypes.DATE, 'Criadas a partir desta data (inclusive). ' + DATA, exemplo='2026-11-01'),
            P('data_fim', OpenApiTypes.DATE, 'Criadas até esta data (inclusive). ' + DATA, exemplo='2026-11-30'),
        ],
        ok=(200, DenunciaAdmin(many=True), 'admin_denuncias_listar', 'Denúncias.', []),
        erros=[(400, 'admin_denuncias_filtro_invalido', 'Filtro inválido'), (403, 'admin_denuncias_comum', 'Usuário comum')],
    ),
    'moderacao_denuncia_resolver': dict(
        metodo='PATCH', rota='/api/admin/moderacao/denuncias/{denuncia_id}/', tag='Moderação', quem=ADMIN,
        resumo='Resolver ou descartar uma denúncia',
        descricao='Só denúncias `pendente` podem ser decididas. `resolucao` é opcional (até 500 caracteres). Para suspender o usuário, use a rota de suspensão.',
        request=ResolverRequisicao, req_ex=[('admin_denuncia_resolver', 'Procedente')],
        ok=(200, ResolverResposta, 'admin_denuncia_resolver', 'Denúncia decidida.', []),
        erros=[(400, 'admin_denuncia_resolver_de_novo', 'Denúncia já decidida'), (403, 'admin_denuncias_comum', 'Usuário comum'),
               (404, 'admin_denuncia_inexistente', 'Denúncia inexistente')],
    ),
    'moderacao_usuario_suspender': dict(
        metodo='POST', rota='/api/admin/moderacao/usuarios/{usuario_id}/suspender/', tag='Moderação', quem=ADMIN,
        resumo='Suspender uma conta',
        descricao=('Desativa a conta (`is_active=false`). O usuário não consegue entrar, some da Descoberta, dos matches e do chat, '
                   'e não recebe curtidas nem mensagens. Não é possível suspender um administrador.'),
        request=SuspenderRequisicao, req_ex=[('admin_suspender', 'Suspensão com motivo')],
        ok=(200, ContaResposta, 'admin_suspender', 'Conta suspensa.', []),
        erros=[(400, 'admin_suspender_de_novo', 'Já estava suspensa'), (403, 'admin_denuncias_comum', 'Usuário comum'),
               (404, 'admin_suspender_inexistente', 'Usuário inexistente')],
    ),
    'moderacao_usuario_reativar': dict(
        metodo='POST', rota='/api/admin/moderacao/usuarios/{usuario_id}/reativar/', tag='Moderação', quem=ADMIN,
        resumo='Reativar uma conta',
        descricao='Reativa a conta suspensa (`is_active=true`).',
        ok=(200, ContaResposta, 'admin_reativar', 'Conta reativada.', []),
        erros=[(400, 'admin_reativar_ativo', 'Já estava ativa'), (403, 'admin_denuncias_comum', 'Usuário comum'),
               (404, 'admin_suspender_inexistente', 'Usuário inexistente')],
    ),
    # ───────── Painel administrativo ─────────
    'painel_dashboard': dict(
        metodo='GET', rota='/api/admin/dashboard/', tag='Painel administrativo', quem=ADMIN,
        resumo='Dashboard',
        descricao=('KPIs, séries diárias (matches, curtidas e mensagens), top regiões e distribuição de score. Período padrão: últimos 30 dias '
                   '(aplicado às séries; os KPIs de curtidas e matches são acumulados). '
                   '`taxa_match` = curtidas positivas que fazem parte de um match ÷ curtidas positivas × 100, sempre entre 0 e 100; '
                   'as duas contagens usam o mesmo conjunto de curtidas (filtro de região/tipo aplicado ao perfil de origem da curtida).'),
        params=[
            P('data_inicio', OpenApiTypes.DATE, 'Início do período. ' + DATA, exemplo='2026-11-01'),
            P('data_fim', OpenApiTypes.DATE, 'Fim do período. ' + DATA, exemplo='2026-11-30'),
            P('regiao', OpenApiTypes.STR, 'Filtra pelos perfis desta região.', exemplo='Boa Viagem'),
            P('tipo', OpenApiTypes.STR, 'Filtra pelo tipo de usuário.', enum=TIPOS_USUARIO),
        ],
        ok=(200, DashboardResposta, 'dashboard', 'Indicadores.', [('dashboard_filtros', 'Com filtros')]),
        erros=[(400, 'dashboard_periodo_invertido', 'Período invertido'), (403, 'dashboard_comum', 'Usuário comum')],
    ),
    'painel_relatorios_catalogo': dict(
        metodo='GET', rota='/api/admin/relatorios/', tag='Painel administrativo', quem=ADMIN,
        resumo='Catálogo de relatórios',
        descricao='Os 5 relatórios disponíveis e os filtros que cada um aceita.',
        ok=(200, RelatorioCatalogo, 'relatorios_catalogo', 'Relatórios.', []), erros=[],
    ),
    'painel_relatorio_detalhe': dict(
        metodo='GET', rota='/api/admin/relatorios/{rel_id}/', tag='Painel administrativo', quem=ADMIN,
        resumo='Gerar um relatório (JSON ou CSV)',
        descricao=('Filtros por relatório — `matches` e `atividade`: data_inicio, data_fim, regiao, tipo; `compatibilidade-regiao`: regiao, tipo; '
                   '`usuarios`: data_inicio, data_fim, tipo; `denuncias`: data_inicio, data_fim. Com `formato=csv` devolve o arquivo '
                   '(UTF-8 com BOM, separador `;`) e registra o log `RELATORIO_EXPORTADO`.'),
        params=[
            OpenApiParameter('rel_id', OpenApiTypes.STR, OpenApiParameter.PATH, enum=RELATORIOS, description='Identificador do relatório.'),
            P('formato', OpenApiTypes.STR, 'Formato de saída (padrão `json`).', enum=['json', 'csv']),
            P('data_inicio', OpenApiTypes.DATE, 'Início do período. ' + DATA, exemplo='2026-11-01'),
            P('data_fim', OpenApiTypes.DATE, 'Fim do período. ' + DATA, exemplo='2026-11-30'),
            P('regiao', OpenApiTypes.STR, 'Região do perfil.', exemplo='Boa Viagem'),
            P('tipo', OpenApiTypes.STR, 'Tipo de usuário.', enum=TIPOS_USUARIO),
        ],
        ok=(200, RelatorioResposta, 'relatorio_json', 'Relatório em JSON (ou CSV com `formato=csv`).', []),
        csv=('relatorio_csv', 'Relatório de usuários em CSV'),
        erros=[(400, 'relatorio_invalido', 'Filtro ou formato inválido'), (404, 'relatorio_inexistente', 'Relatório inexistente')],
    ),
    'painel_usuarios_listar': dict(
        metodo='GET', rota='/api/admin/usuarios/', tag='Painel administrativo', quem=ADMIN,
        resumo='Listar usuários',
        descricao='Usuários paginados, do mais recente para o mais antigo.',
        params=[
            P('q', OpenApiTypes.STR, 'Nome, e-mail ou username.', exemplo='ana'),
            P('tipo', OpenApiTypes.STR, 'Tipo de usuário.', enum=TIPOS_USUARIO),
            P('regiao', OpenApiTypes.STR, 'Região do perfil.', exemplo='Boa Viagem'),
            P('ativo', OpenApiTypes.STR, '`true` = contas ativas; `false` = suspensas.', enum=['true', 'false']),
            P('data_inicio', OpenApiTypes.DATE, 'Cadastro a partir desta data. ' + DATA, exemplo='2026-11-01'),
            P('data_fim', OpenApiTypes.DATE, 'Cadastro até esta data. ' + DATA, exemplo='2026-11-30'),
        ] + P_PAGINA,
        ok=(200, UsuariosPagina, 'usuarios_listar', 'Página de usuários.', []),
        erros=[(400, 'usuarios_filtro_invalido', 'Filtro inválido')],
    ),
    'painel_usuarios_exportar': dict(
        metodo='GET', rota='/api/admin/usuarios/exportar/', tag='Painel administrativo', quem=ADMIN,
        resumo='Exportar usuários (CSV)',
        descricao='Mesmos filtros da listagem (sem paginação). CSV com BOM e separador `;`. Registra o log `RELATORIO_EXPORTADO`.',
        params=[
            P('q', OpenApiTypes.STR, 'Nome, e-mail ou username.', exemplo='ana'),
            P('tipo', OpenApiTypes.STR, 'Tipo de usuário.', enum=TIPOS_USUARIO),
            P('regiao', OpenApiTypes.STR, 'Região do perfil.', exemplo='Boa Viagem'),
            P('ativo', OpenApiTypes.STR, '`true` = ativas; `false` = suspensas.', enum=['true', 'false']),
            P('data_inicio', OpenApiTypes.DATE, 'Cadastro a partir desta data. ' + DATA, exemplo='2026-11-01'),
            P('data_fim', OpenApiTypes.DATE, 'Cadastro até esta data. ' + DATA, exemplo='2026-11-30'),
        ],
        csv_ok=('usuarios_exportar', 'Arquivo CSV de usuários.'), erros=[],
    ),
    # ───────── Logs ─────────
    'logs_listar': dict(
        metodo='GET', rota='/api/admin/logs/', tag='Logs', quem=ADMIN,
        resumo='Listar logs de operações',
        descricao=('Histórico de operações, do mais recente para o mais antigo. O texto das mensagens e as senhas nunca são gravados; '
                   'o log de falha de login guarda só o motivo (`credenciais` ou `conta_inativa`).'),
        params=[
            P('acao', OpenApiTypes.STR, 'Ação registrada.', enum=ACOES_LOG),
            P('usuario', OpenApiTypes.STR, 'Id, e-mail ou parte do nome do usuário.', exemplo='ana.souza@exemplo.com'),
            P('entidade', OpenApiTypes.STR, 'Tipo de objeto afetado (`usuario`, `perfil`, `match`...).', exemplo='perfil'),
            P('q', OpenApiTypes.STR, 'Busca em e-mail, nome, username ou entidade.', exemplo='ana'),
            P('data_inicio', OpenApiTypes.DATE, 'A partir desta data. ' + DATA, exemplo='2026-11-01'),
            P('data_fim', OpenApiTypes.DATE, 'Até esta data. ' + DATA, exemplo='2026-11-30'),
        ] + P_PAGINA,
        ok=(200, LogsPagina, 'logs_listar', 'Página de logs.', [('logs_por_usuario', 'Filtrado por e-mail do usuário')]),
        erros=[(400, 'logs_filtro_invalido', 'Ação inválida')],
    ),
    'logs_exportar': dict(
        metodo='GET', rota='/api/admin/logs/exportar/', tag='Logs', quem=ADMIN,
        resumo='Exportar logs (CSV)',
        descricao='Mesmos filtros da listagem (sem paginação). CSV com BOM e separador `;`. Registra o log `RELATORIO_EXPORTADO`.',
        params=[
            P('acao', OpenApiTypes.STR, 'Ação registrada.', enum=ACOES_LOG),
            P('usuario', OpenApiTypes.STR, 'Id, e-mail ou parte do nome do usuário.', exemplo='ana.souza@exemplo.com'),
            P('entidade', OpenApiTypes.STR, 'Tipo de objeto afetado.', exemplo='perfil'),
            P('q', OpenApiTypes.STR, 'Busca em e-mail, nome, username ou entidade.', exemplo='ana'),
            P('data_inicio', OpenApiTypes.DATE, 'A partir desta data. ' + DATA, exemplo='2026-11-01'),
            P('data_fim', OpenApiTypes.DATE, 'Até esta data. ' + DATA, exemplo='2026-11-30'),
        ],
        csv_ok=('logs_exportar', 'Arquivo CSV de logs.'),
        erros=[(400, 'logs_filtro_invalido', 'Ação inválida')],
    ),
}

DESCRICAO_STATUS = {
    400: 'Dados inválidos (mensagem em português, por campo ou em `detail`).',
    401: 'Não autenticado: token ausente, inválido ou expirado (ou credenciais inválidas no login).',
    403: 'Sem permissão para este recurso.',
    404: 'Recurso não encontrado.',
}
# Exemplos de 401 reaproveitados em todas as rotas autenticadas
ERROS_401 = [('me_sem_token', 'Sem token'), ('me_token_invalido', 'Token inválido ou expirado')]


def _ex_resp(id_, rotulo):
    e = EXEMPLOS[id_]
    return OpenApiExample(rotulo, value=e['resposta'], response_only=True, status_codes=[str(e['status'])])


def _tipo_erro(ids):
    corpos = [EXEMPLOS[i]['resposta'] for i in ids]
    com_detail = ['detail' in c for c in corpos if isinstance(c, dict)]
    if all(com_detail):
        return ErroDetalhe
    if not any(com_detail):
        return ErroCampos
    return OpenApiTypes.OBJECT


def erros_da_operacao(chave):
    """Lista (status, [(id, rótulo)...]) incluindo os 401 automáticos das rotas autenticadas."""
    o = OPERACOES[chave]
    por_status = {}
    for st, id_, rotulo in o.get('erros', []):
        por_status.setdefault(st, []).append((id_, rotulo))
    if not o.get('publico'):
        por_status.setdefault(401, []).extend(ERROS_401)
    return dict(sorted(por_status.items()))


def doc(chave):
    """Argumentos do @extend_schema da operação `chave`."""
    o = OPERACOES[chave]
    respostas = {}
    if 'ok' in o:
        st, ser, id_, desc, extras = o['ok']
        exemplos = [_ex_resp(id_, 'Exemplo real')] + [_ex_resp(i, r) for i, r in extras]
        resp = OpenApiResponse(response=ser, description=desc, examples=exemplos) if ser is not None else OpenApiResponse(description=desc)
        if 'csv' in o:
            respostas[(st, 'application/json')] = resp
            csv_id, csv_rotulo = o['csv']
            respostas[(st, 'text/csv')] = OpenApiResponse(
                response=OpenApiTypes.STR, description='Arquivo CSV (com `formato=csv`).',
                examples=[OpenApiExample(csv_rotulo, value=EXEMPLOS[csv_id]['resposta'], response_only=True, status_codes=['200'])])
        else:
            respostas[st] = resp
    else:  # só CSV
        csv_id, csv_desc = o['csv_ok']
        respostas[(200, 'text/csv')] = OpenApiResponse(
            response=OpenApiTypes.STR, description=csv_desc,
            examples=[OpenApiExample('Exemplo real (primeiras linhas)', value=EXEMPLOS[csv_id]['resposta'], response_only=True, status_codes=['200'])])
    for st, itens in erros_da_operacao(chave).items():
        respostas[st] = OpenApiResponse(
            response=_tipo_erro([i for i, _ in itens]), description=DESCRICAO_STATUS[st],
            examples=[_ex_resp(i, r) for i, r in itens])
    args = dict(
        operation_id=chave, tags=[o['tag']], summary=o['resumo'], description=o['descricao'],
        responses=respostas, extensions={'x-quem-pode': o['quem']},
    )
    if o.get('request') is not None:
        args['request'] = o['request']
        if o.get('req_ex'):
            args['examples'] = [OpenApiExample(r, value=EXEMPLOS[i]['corpo'], request_only=True) for i, r in o['req_ex']]
    else:
        args['request'] = None  # sem corpo de entrada
    if o.get('params'):
        args['parameters'] = o['params']
    if o.get('publico'):
        args['auth'] = []
    return args
