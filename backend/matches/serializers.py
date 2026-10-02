from rest_framework import serializers
from perfis.models import Perfil
from .models import Curtida, Match


class PerfilDescobertoSerializer(serializers.ModelSerializer):
    score = serializers.SerializerMethodField()

    class Meta:
        model = Perfil
        fields = [
            'id', 'nome', 'idade', 'regiao', 'bio',
            'orcamento_min', 'orcamento_max',
            'fumante', 'aceita_pets',
            'tolerancia_bagunca', 'nivel_organizacao',
            'score',
        ]

    def get_score(self, obj) -> float:
        return self.context.get('scores', {}).get(obj.id, 0.0)


class CurtidaSerializer(serializers.ModelSerializer):
    perfil_destino = serializers.PrimaryKeyRelatedField(queryset=Perfil.objects.all())
    tipo = serializers.ChoiceField(choices=['curtir', 'recusar'])

    class Meta:
        model = Curtida
        fields = ['id', 'perfil_destino', 'tipo', 'data']
        read_only_fields = ['id', 'data']


class PerfilBasicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Perfil
        fields = ['id', 'nome', 'idade', 'regiao', 'bio',
                  'fumante', 'aceita_pets', 'tolerancia_bagunca', 'nivel_organizacao',
                  'orcamento_min', 'orcamento_max']


class MatchSerializer(serializers.ModelSerializer):
    perfil_a = PerfilBasicoSerializer(read_only=True)
    perfil_b = PerfilBasicoSerializer(read_only=True)

    class Meta:
        model = Match
        fields = ['id', 'perfil_a', 'perfil_b', 'score', 'data_match']
