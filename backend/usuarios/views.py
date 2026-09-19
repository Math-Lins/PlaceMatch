from rest_framework import generics, permissions
from .models import Usuario
from .serializers import RegistrarSerializer, UsuarioSerializer


class RegistrarView(generics.CreateAPIView):
    queryset = Usuario.objects.all()
    serializer_class = RegistrarSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveAPIView):
    serializer_class = UsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
