from rest_framework import generics, permissions
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import Usuario
from .serializers import RegistrarSerializer, UsuarioSerializer


class RegistrarView(generics.CreateAPIView):
    queryset = Usuario.objects.all()
    serializer_class = RegistrarSerializer
    permission_classes = [permissions.AllowAny]

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


class LoginView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        from logs.servicos import registrar
        try:
            response = super().post(request, *args, **kwargs)
            # Sucesso: identifica o usuário pelo e-mail para o log.
            email = request.data.get('email', '')
            try:
                usuario = Usuario.objects.get(email__iexact=email)
            except Usuario.DoesNotExist:
                usuario = None
            registrar(
                'LOGIN',
                usuario=usuario,
                entidade='usuario',
                entidade_id=usuario.id if usuario else None,
                request=request,
            )
            return response
        except Exception:
            # Distingue conta inativa (senha certa, is_active=False) de credenciais erradas.
            # Não grava o e-mail digitado no log — apenas o motivo.
            motivo = 'credenciais'
            usuario_log = None
            email = request.data.get('email', '')
            try:
                u = Usuario.objects.get(email__iexact=email)
                if u.check_password(request.data.get('password', '')):
                    motivo = 'conta_inativa'
                    usuario_log = u
            except Usuario.DoesNotExist:
                pass
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


class MeView(generics.RetrieveAPIView):
    serializer_class = UsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
