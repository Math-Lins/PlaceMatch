from rest_framework import generics, permissions
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
            # sucesso: tenta identificar o usuário pelo e-mail enviado
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
            registrar(
                'LOGIN_FALHA',
                usuario=None,
                entidade='usuario',
                detalhes={'motivo': 'Credenciais inválidas'},
                request=request,
            )
            raise


class MeView(generics.RetrieveAPIView):
    serializer_class = UsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
