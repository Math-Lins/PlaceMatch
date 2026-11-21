from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from perfis.models import Perfil
from .models import Curtida, Match


class TemaSerializer(serializers.Serializer):
    id = serializers.CharField(help_text='Identificador do tema (ex.: `culinaria`).')
    nome = serializers.CharField(help_text='Nome do tema (ex.: "Culinária").')


class CamposIAMixin(serializers.Serializer):
    """afinidade_ia e temas_em_comum lidos de context['ia'] = {perfil_id: {...}} (ia.explicacao.afinidades_para)."""

    afinidade_ia = serializers.SerializerMethodField()
    temas_em_comum = serializers.SerializerMethodField()

    def _ia(self, obj) -> dict:
        return self.context.get('ia', {}).get(obj.id, {})

    @extend_schema_field(serializers.FloatField(
        allow_null=True,
        help_text='Afinidade entre as bios calculada pelo ThoLuk, a IA do PlaceMatch (0 a 1). `null` quando um dos '
                  'dois perfis não tem bio suficiente (20+ letras) ou o ThoLuk está desligado.'))
    def get_afinidade_ia(self, obj):
        return self._ia(obj).get('afinidade_ia')

    @extend_schema_field(TemaSerializer(many=True, help_text='Temas de convivência que o ThoLuk identificou nas duas bios.'))
    def get_temas_em_comum(self, obj):
        return self._ia(obj).get('temas_em_comum', [])


class PerfilDescobertoSerializer(CamposIAMixin, serializers.ModelSerializer):
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
            'tipo', 'score', 'usuario_id', 'afinidade_ia', 'temas_em_comum',
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
