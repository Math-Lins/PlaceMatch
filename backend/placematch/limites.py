"""Limite de tentativas de login (força bruta).

Duas travas independentes, ambas contando só tentativas que FALHARAM:
  - por IP:      `LOGIN_LIMITE_IP`    (padrão 5/min)
  - por e-mail:  `LOGIN_LIMITE_EMAIL` (padrão 10/hora; e-mail normalizado em minúsculas, mesmo que não exista,
                 para a resposta não revelar quais e-mails têm conta)
Passou do limite → 429 com `Retry-After` e mensagem em português. Login correto zera o contador do e-mail.
Valor vazio/`off` desliga a trava (usado nos testes comuns e no e2e).

O contador usa o cache do Django. O padrão (LocMem) é por processo: com vários processos/servidores,
configure um cache compartilhado (Redis, banco…). O IP é o `REMOTE_ADDR`; atrás de proxy confiável defina
`PROXIES_CONFIAVEIS` (quantidade de proxies) para usar o `X-Forwarded-For` — sem isso o cabeçalho é ignorado,
senão qualquer cliente trocaria o IP e escaparia do limite.
"""
from django.conf import settings
from rest_framework.exceptions import ErrorDetail, Throttled
from rest_framework.throttling import SimpleRateThrottle

MENSAGEM_LIMITE = 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'


def _ip_do_cliente(request):
    remoto = request.META.get('REMOTE_ADDR', '')
    proxies = int(getattr(settings, 'PROXIES_CONFIAVEIS', 0) or 0)
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if proxies > 0 and xff:
        partes = [p.strip() for p in xff.split(',') if p.strip()]
        if len(partes) >= proxies:
            return partes[-proxies]
    return remoto


class _LimitePorFalhas(SimpleRateThrottle):
    """Como o SimpleRateThrottle, mas só `registrar_falha()` consome o limite (a checagem não)."""
    nome_da_taxa = ''  # nome da variável de settings com a taxa

    def get_rate(self):
        taxa = getattr(settings, self.nome_da_taxa, None)
        return taxa if taxa and str(taxa).lower() != 'off' else None

    def chave(self, request):
        raise NotImplementedError

    def get_cache_key(self, request, view):
        return self.chave(request)

    def allow_request(self, request, view):
        self.key = self.get_cache_key(request, view)
        if self.rate is None or self.key is None:
            return True
        self.history = self.cache.get(self.key, [])
        self.now = self.timer()
        while self.history and self.history[-1] <= self.now - self.duration:
            self.history.pop()
        return len(self.history) < self.num_requests

    def registrar_falha(self):
        if self.rate is None or self.key is None:
            return
        self.history = self.cache.get(self.key, [])
        self.history.insert(0, self.timer())
        self.cache.set(self.key, self.history, self.duration)

    def zerar(self):
        if self.key is not None:
            self.cache.delete(self.key)


class LimiteLoginPorIp(_LimitePorFalhas):
    scope = 'login_ip'
    nome_da_taxa = 'LOGIN_LIMITE_IP'

    def chave(self, request):
        return self.cache_format % {'scope': self.scope, 'ident': _ip_do_cliente(request)}


class LimiteLoginPorEmail(_LimitePorFalhas):
    scope = 'login_email'
    nome_da_taxa = 'LOGIN_LIMITE_EMAIL'

    def chave(self, request):
        dados = request.data if hasattr(request.data, 'get') else {}
        email = dados.get('email')
        if not isinstance(email, str) or not email.strip():
            return None
        return self.cache_format % {'scope': self.scope, 'ident': email.strip().lower()}


class LimitesDeLogin:
    """Agrupa as duas travas para a LoginView."""

    def __init__(self, request):
        self.request = request
        self.travas = [LimiteLoginPorIp(), LimiteLoginPorEmail()]

    def verificar(self, view=None):
        for t in self.travas:
            if not t.allow_request(self.request, view):
                erro = Throttled(wait=t.wait())
                # sem o complemento em inglês que o DRF acrescenta ("Expected available in N seconds")
                erro.detail = ErrorDetail(MENSAGEM_LIMITE, code='throttled')
                raise erro

    def falhou(self):
        for t in self.travas:
            t.registrar_falha()

    def acertou(self):
        # só o contador do e-mail: o do IP expira sozinho (1 minuto)
        self.travas[1].zerar()
