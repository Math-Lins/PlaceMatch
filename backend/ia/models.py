import numpy as np
from django.db import models
from django.db.models import CheckConstraint, Q
from django.db.models.functions import Length
from django.db.models.lookups import Exact

from perfis.models import Perfil

DIMENSOES = 384
BYTES_VETOR = DIMENSOES * 4  # float32


class EmbeddingPerfil(models.Model):
    """
    Embedding (vetor de 384 números) do texto do perfil, gerado pelo modelo de linguagem local.

    O vetor é guardado normalizado (norma 1), em float32 little-endian (1536 bytes), então o cosseno
    entre dois perfis é só o produto escalar. Só é regerado quando o hash do texto de origem ou o
    modelo mudam (veja ia/embeddings.py).
    """

    perfil = models.OneToOneField(Perfil, on_delete=models.CASCADE, related_name='embedding_ia')
    vetor = models.BinaryField(help_text='384 floats (float32, little-endian), vetor normalizado.')
    modelo = models.CharField(max_length=200, help_text='Modelo que gerou o vetor.')
    hash_texto = models.CharField(max_length=64, help_text='SHA-256 do texto de origem (bio + anúncio).')
    temas = models.JSONField(default=list, blank=True, help_text='Ids dos temas detectados (ia/temas.py).')
    tempo_ms = models.FloatField(default=0.0, help_text='Tempo de geração do embedding, em milissegundos.')
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'embedding de perfil'
        verbose_name_plural = 'embeddings de perfis'
        constraints = [
            CheckConstraint(condition=Exact(Length('vetor'), BYTES_VETOR), name='embedding_vetor_384_ck'),
            CheckConstraint(condition=Q(tempo_ms__gte=0), name='embedding_tempo_positivo_ck'),
        ]

    def __str__(self):
        return f'Embedding do perfil {self.perfil_id} ({self.modelo})'

    # ── conversão ────────────────────────────────────────────────────────────

    @staticmethod
    def empacotar(vetor) -> bytes:
        v = np.asarray(vetor, dtype='<f4').reshape(-1)
        if v.shape[0] != DIMENSOES:
            raise ValueError(f'O vetor deve ter {DIMENSOES} dimensões (recebido: {v.shape[0]}).')
        return v.tobytes()

    def vetor_np(self) -> np.ndarray:
        """Vetor em float64 (cache na instância)."""
        cache = getattr(self, '_vetor_cache', None)
        if cache is None:
            cache = np.frombuffer(bytes(self.vetor), dtype='<f4').astype(np.float64)
            self._vetor_cache = cache
        return cache

    def vetor_valido(self):
        """O vetor, se foi gerado pelo modelo em uso; senão None (precisa ser regerado)."""
        from .servico import nome_modelo
        if self.modelo != nome_modelo():
            return None
        return self.vetor_np()
