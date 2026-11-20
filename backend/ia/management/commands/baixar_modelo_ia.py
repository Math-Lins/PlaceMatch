"""
python manage.py baixar_modelo_ia

Baixa (na primeira vez) e aquece o modelo de linguagem da Afinidade por IA na pasta IA_MODELO_DIR.
Rode antes da apresentação: depois disso o servidor carrega o modelo só do disco e funciona offline.
Também serve para conferir se o modelo está íntegro (carrega e gera um embedding de teste).
"""

import os
import time

from django.core.management.base import BaseCommand, CommandError

from ia import servico


def _tamanho_pasta(caminho: str) -> int:
    total = 0
    for raiz, _, arquivos in os.walk(caminho):
        for nome in arquivos:
            arq = os.path.join(raiz, nome)
            if not os.path.islink(arq):
                total += os.path.getsize(arq)
    return total


class Command(BaseCommand):
    help = 'Baixa e aquece o modelo de IA (multilíngue, 384 dimensões) para uso offline.'

    def handle(self, *args, **options):
        if not servico.habilitada():
            raise CommandError('A IA está desligada (IA_HABILITADA=False). Ligue-a no .env para baixar o modelo.')
        if servico.usando_falso():
            self.stdout.write(self.style.WARNING('IA_EMBEDDER=falso: embedder de testes, nada a baixar.'))
            return
        pasta = servico.pasta_modelo()
        ja_baixado = servico.modelo_baixado()
        self.stdout.write(f'Modelo: {servico.MODELO}')
        self.stdout.write(f'Pasta:  {pasta}')
        self.stdout.write('Arquivos já baixados: carregando do disco…' if ja_baixado
                          else 'Baixando o modelo (cerca de 230 MB, só na primeira vez)…')
        os.makedirs(pasta, exist_ok=True)

        servico.reiniciar()
        inicio = time.perf_counter()
        embedder = servico.obter_embedder(forcar=True, baixar=not ja_baixado)
        if embedder is None:
            raise CommandError(f"Não foi possível carregar o modelo: {servico.estado()['erro']}. "
                               'Confira a conexão com a internet (só na primeira vez) e o espaço em disco.')
        total_s = time.perf_counter() - inicio

        inicio = time.perf_counter()
        vetores = servico.gerar_vetores(['Adoro cozinhar para os amigos.', 'Faço jantares em casa no fim de semana.'])
        teste_ms = (time.perf_counter() - inicio) * 1000
        temas = servico.temas_de_vetores(vetores)
        cos = float(vetores[0] @ vetores[1])

        self.stdout.write(f"{'Download + carga' if not ja_baixado else 'Carga'}: {total_s:.1f} s "
                          f"(carga do modelo: {servico.estado()['tempo_carregamento_ms']:.0f} ms)")
        self.stdout.write(f'Tamanho em disco: {_tamanho_pasta(pasta) / 2**20:.0f} MB')
        self.stdout.write(f'Teste: "Adoro cozinhar para os amigos." × "Faço jantares em casa no fim de semana." '
                          f'→ cosseno {cos:.3f}, temas {temas} ({teste_ms:.0f} ms)')
        self.stdout.write(self.style.SUCCESS('Modelo pronto: o servidor passa a usá-lo sem acessar a internet.'))
