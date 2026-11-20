from rest_framework import serializers

LIMITE_TEXTO = 1000


class IATestarSerializer(serializers.Serializer):
    texto_a = serializers.CharField(max_length=LIMITE_TEXTO, help_text='Primeiro texto (1 a 1000 caracteres; não pode ser só espaços).')
    texto_b = serializers.CharField(max_length=LIMITE_TEXTO, help_text='Segundo texto (1 a 1000 caracteres; não pode ser só espaços).')
