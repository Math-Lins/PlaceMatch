from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .models import Usuario
from .serializers import RegistrarSerializer, UsuarioSerializer
from drf_spectacular.utils import extend_schema
from placematch.api_docs import doc
from placematch.limites import LimitesDeLogin


class RegistrarView(generics.CreateAPIView):
    queryset = Usuario.objects.all()
    serializer_class = RegistrarSerializer
    permission_classes = [permissions.AllowAny]

    @extend_schema(**doc('auth_registrar'))
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

    def perform_create(self, serializer):
        from logs.servicos import registrar
        usuario = serializer.save()
        registrar(
            'CADASTRO',
            usuario=usuario,
            entidade='usuario',
            entidade_id=usuario.id,
            request=self.request,
        )


def _validar_corpo_login(data):
    """Retorna (email, senha, erros). `erros` é dict campo -> mensagem (vazio se ok)."""
    if not hasattr(data, 'get'):
        return None, None, {'detail': 'O corpo da requisição deve ser um objeto JSON com e-mail e senha.'}
    email, senha = data.get('email'), data.get('password')
    erros = {}
    if email is None or (isinstance(email, str) and not email.strip()):
        erros['email'] = ['Informe o e-mail.']
    elif not isinstance(email, str):
        erros['email'] = ['O e-mail deve ser um texto.']
    if senha is None or (isinstance(senha, str) and not senha):
        erros['password'] = ['Informe a senha.']
    elif not isinstance(senha, str):
        erros['password'] = ['A senha deve ser um texto.']
    return email, senha, erros


class LoginView(TokenObtainPairView):
    @extend_schema(**doc('auth_login'))
    def post(self, request, *args, **kwargs):
        from logs.servicos import registrar

        email, senha, erros = _validar_corpo_login(request.data)
        if erros:
            return Response(erros, status=status.HTTP_400_BAD_REQUEST)
        email = email.strip()

        # Força bruta: bloqueia (429) quando há tentativas falhas demais deste IP ou para este e-mail.
        limites = LimitesDeLogin(request)
        limites.verificar(self)

        try:
            response = super().post(request, *args, **kwargs)
        except (AuthenticationFailed, TokenError):
            limites.falhou()
            # Distingue conta suspensa (existe, senha confere, is_active=False) de
            # credenciais erradas. Não grava o e-mail digitado no log — só o motivo.
            motivo = 'credenciais'
            usuario_log = None
            u = Usuario.objects.filter(email__iexact=email).first()
            if u is not None and not u.is_active and u.check_password(senha):
                motivo = 'conta_inativa'
                usuario_log = u
            registrar(
                'LOGIN_FALHA',
                usuario=usuario_log,
                entidade='usuario',
                detalhes={'motivo': motivo},
                request=request,
            )
            if motivo == 'conta_inativa':
                raise AuthenticationFailed('Conta suspensa. Procure o suporte.')
            raise AuthenticationFailed('E-mail ou senha incorretos.')

        limites.acertou()
        # Sucesso: identifica o usuário pelo e-mail para o log.
        usuario = Usuario.objects.filter(email__iexact=email).first()
        registrar(
            'LOGIN',
            usuario=usuario,
            entidade='usuario',
            entidade_id=usuario.id if usuario else None,
            request=request,
        )
        return response


class RenovarTokenView(TokenRefreshView):
    """Renovação do access (SimpleJWT) com a documentação da API."""

    @extend_schema(**doc('auth_refresh'))
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class LogoutView(APIView):
    """Encerra a sessão: coloca o refresh na lista de bloqueio (não vale mais para renovar)."""
    permission_classes = [permissions.AllowAny]  # a credencial é o próprio refresh
    authentication_classes: list = []

    @extend_schema(**doc('auth_logout'))
    def post(self, request):
        refresh = request.data.get('refresh') if hasattr(request.data, 'get') else None
        if not isinstance(refresh, str) or not refresh.strip():
            return Response({'refresh': ['Informe o refresh.']}, status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(refresh.strip()).blacklist()
        except TokenError:
            return Response({'detail': 'O token é inválido ou já foi encerrado.'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveAPIView):
    serializer_class = UsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(**doc('auth_me'))
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_object(self):
        return self.request.user
