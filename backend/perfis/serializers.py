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

    # Valida o intervalo de orçamento ao criar ou atualizar um perfil.
    def validate(self, attrs):
        minimo = attrs.get('orcamento_min', getattr(self.instance, 'orcamento_min', None))
        maximo = attrs.get('orcamento_max', getattr(self.instance, 'orcamento_max', None))

        if minimo is not None and maximo is not None and minimo > maximo:
            raise serializers.ValidationError({
                'orcamento_max': 'O orçamento máximo deve ser maior ou igual ao mínimo.'
            })
        return attrs
