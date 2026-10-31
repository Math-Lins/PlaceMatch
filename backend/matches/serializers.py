from rest_framework import serializers
from perfis.models import Perfil
from .models import Curtida, Match


class PerfilDescobertoSerializer(serializers.ModelSerializer):
    score = serializers.SerializerMethodField()
    tipo = serializers.CharField(source='usuario.tipo', read_only=True)
    usuario_id = serializers.IntegerField(source='usuario.id', read_only=True)

    class Meta:
        model = Perfil
        fields = [
            'id', 'nome', 'idade', 'regiao', 'bio',
            'orcamento_min', 'orcamento_max',
            'fumante', 'aceita_pets',
            'tolerancia_bagunca', 'nivel_organizacao',
            'perfil_horario', 'nivel_ruido', 'nivel_social',
            'aceita_visitas', 'tipo_imovel', 'qtd_moradores',
            'titulo_anuncio', 'descricao_imovel', 'fotos_imovel', 'foto_perfil_url',
            'tipo', 'score', 'usuario_id',
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
    tipo = serializers.CharField(source='usuario.tipo', read_only=True)
    usuario_id = serializers.IntegerField(source='usuario.id', read_only=True)

    class Meta:
        model = Perfil
        fields = [
            'id', 'nome', 'idade', 'regiao', 'bio',
            'fumante', 'aceita_pets', 'tolerancia_bagunca', 'nivel_organizacao',
            'orcamento_min', 'orcamento_max',
            'perfil_horario', 'nivel_ruido', 'nivel_social',
            'aceita_visitas', 'tipo_imovel', 'qtd_moradores',
            'titulo_anuncio', 'descricao_imovel', 'fotos_imovel', 'foto_perfil_url',
            'tipo', 'usuario_id',
        ]


class MatchSerializer(serializers.ModelSerializer):
    perfil_a = PerfilBasicoSerializer(read_only=True)
    perfil_b = PerfilBasicoSerializer(read_only=True)

    class Meta:
        model = Match
        fields = ['id', 'perfil_a', 'perfil_b', 'score', 'data_match']
