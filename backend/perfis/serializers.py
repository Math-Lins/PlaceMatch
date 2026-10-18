from rest_framework import serializers
from .models import Perfil


class PerfilSerializer(serializers.ModelSerializer):
    class Meta:
        model = Perfil
        fields = [
            'id', 'usuario', 'nome', 'idade', 'regiao', 'bio',
            'orcamento_min', 'orcamento_max', 'fumante', 'aceita_pets',
            'tolerancia_bagunca', 'nivel_organizacao',
            'perfil_horario', 'nivel_ruido', 'nivel_social',
            'aceita_visitas', 'tipo_imovel', 'qtd_moradores',
            'titulo_anuncio', 'descricao_imovel', 'fotos_imovel', 'foto_perfil_url',
        ]
        read_only_fields = ['id', 'usuario']

    def validate_nome(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('O nome é obrigatório.')
        if len(value.strip()) < 2:
            raise serializers.ValidationError('O nome deve ter pelo menos 2 caracteres.')
        return value.strip()

    def validate_idade(self, value):
        if value < 18:
            raise serializers.ValidationError('A idade mínima permitida é 18 anos.')
        if value > 100:
            raise serializers.ValidationError('Informe uma idade válida (máximo 100 anos).')
        return value

    def validate_regiao(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('A região é obrigatória.')
        if len(value.strip()) < 2:
            raise serializers.ValidationError('A região deve ter pelo menos 2 caracteres.')
        return value.strip()

    def validate_bio(self, value):
        if value and len(value) > 500:
            raise serializers.ValidationError(
                f'A bio deve ter no máximo 500 caracteres (enviados: {len(value)}).'
            )
        return value

    def validate_orcamento_min(self, value):
        if value <= 0:
            raise serializers.ValidationError('O orçamento mínimo deve ser maior que zero.')
        return value

    def validate_orcamento_max(self, value):
        if value <= 0:
            raise serializers.ValidationError('O orçamento máximo deve ser maior que zero.')
        return value

    def validate_tolerancia_bagunca(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError(
                'A tolerância à bagunça deve ser um valor entre 1 e 5.'
            )
        return value

    def validate_nivel_organizacao(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError(
                'O nível de organização deve ser um valor entre 1 e 5.'
            )
        return value

    def validate_nivel_ruido(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError('O nível de ruído deve ser entre 1 e 5.')
        return value

    def validate_nivel_social(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError('O nível social deve ser entre 1 e 5.')
        return value

    def validate_qtd_moradores(self, value):
        if value < 1 or value > 4:
            raise serializers.ValidationError('A quantidade de moradores deve ser entre 1 e 4.')
        return value

    def validate_perfil_horario(self, value):
        validos = [c[0] for c in Perfil.HORARIO_CHOICES]
        if value not in validos:
            raise serializers.ValidationError(f'Escolha um dos valores: {validos}.')
        return value

    def validate_aceita_visitas(self, value):
        validos = [c[0] for c in Perfil.VISITAS_CHOICES]
        if value not in validos:
            raise serializers.ValidationError(f'Escolha um dos valores: {validos}.')
        return value

    def validate_tipo_imovel(self, value):
        validos = [c[0] for c in Perfil.IMOVEL_CHOICES]
        if value not in validos:
            raise serializers.ValidationError(f'Escolha um dos valores: {validos}.')
        return value

    def validate_titulo_anuncio(self, value):
        if value and len(value) > 120:
            raise serializers.ValidationError(
                f'O título do anúncio deve ter no máximo 120 caracteres (enviados: {len(value)}).'
            )
        return value

    def validate_foto_perfil_url(self, value):
        if value and not (value.startswith('http://') or value.startswith('https://')):
            raise serializers.ValidationError(
                'A URL da foto de perfil deve começar com http:// ou https://.'
            )
        return value

    def validate_fotos_imovel(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('fotos_imovel deve ser uma lista de URLs.')
        if len(value) > 5:
            raise serializers.ValidationError(
                f'fotos_imovel aceita no máximo 5 URLs (enviadas: {len(value)}).'
            )
        for i, url in enumerate(value):
            if not isinstance(url, str):
                raise serializers.ValidationError(
                    f'O item {i + 1} de fotos_imovel deve ser uma string.'
                )
            if not (url.startswith('http://') or url.startswith('https://')):
                raise serializers.ValidationError(
                    f'O item {i + 1} de fotos_imovel deve ser uma URL http/https válida.'
                )
            if len(url) > 500:
                raise serializers.ValidationError(
                    f'O item {i + 1} de fotos_imovel excede 500 caracteres.'
                )
        return value

    def validate(self, attrs):
        minimo = attrs.get('orcamento_min', getattr(self.instance, 'orcamento_min', None))
        maximo = attrs.get('orcamento_max', getattr(self.instance, 'orcamento_max', None))

        if minimo is not None and maximo is not None and minimo > maximo:
            raise serializers.ValidationError({
                'orcamento_max': 'O orçamento máximo deve ser maior ou igual ao mínimo.'
            })
        return attrs
