from rest_framework import serializers
from .models import Perfil


class PerfilSerializer(serializers.ModelSerializer):
    class Meta:
        model = Perfil
        fields = [
            'id', 'usuario', 'nome', 'idade', 'regiao', 'bio',
            'orcamento_min', 'orcamento_max', 'fumante', 'aceita_pets',
            'tolerancia_bagunca', 'nivel_organizacao',
        ]
        read_only_fields = ['id', 'usuario']
