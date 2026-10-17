from rest_framework import serializers
from .models import Mensagem


class MensagemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mensagem
        fields = ['id', 'match_id', 'remetente_id', 'conteudo', 'data_envio', 'lida']
        read_only_fields = ['id', 'match_id', 'remetente_id', 'data_envio', 'lida']
