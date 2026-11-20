# Algoritmo de Compatibilidade — PlaceMatch

Documento gerado a partir do código-fonte em `backend/matches/algoritmo/`.
Toda alteração de peso ou regra deve ser feita em `config.py` — os demais módulos apenas lêem as constantes definidas ali.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Direção do match e convenção de IDs](#2-direção-do-match-e-convenção-de-ids)
3. [Os 7 critérios e seus pesos](#3-os-7-critérios-e-seus-pesos)
4. [Fórmula de cada critério](#4-fórmula-de-cada-critério)
5. [Tabelas de similaridade categórica](#5-tabelas-de-similaridade-categórica)
6. [Score final](#6-score-final)
7. [Pré-cálculo e armazenamento](#7-pré-cálculo-e-armazenamento)
8. [Implementação vetorial (NumPy)](#8-implementação-vetorial-numpy)
9. [Resultados do benchmark](#9-resultados-do-benchmark)
10. [Limitações conhecidas](#10-limitações-conhecidas)
11. [Afinidade por IA (7º critério)](#11-afinidade-por-ia-7º-critério)

---

## 1. Visão geral

O algoritmo calcula um **score de compatibilidade** entre dois perfis, retornando um valor entre **0,0** (incompatível) e **1,0** (compatível perfeito). O score é arredondado em 4 casas decimais e clampado ao intervalo [0, 1].

Existem duas implementações do mesmo cálculo, matematicamente equivalentes:

| Módulo | Função | Uso |
|---|---|---|
| `algoritmo/escalar.py` | `calcular_score(perfil_a, perfil_b)` | Cálculo individual; base de referência |
| `algoritmo/vetorial.py` | `calcular_scores_lote(base, outros, pesos=None)` | Cálculo em lote via NumPy; usado em produção |
| `algoritmo/afinidade.py` | `calibrar`, `combinar`, `vetor_do_perfil` | 7º critério (Afinidade por IA) e soma ponderada com renormalização, usados pelas duas implementações |

`escalar.detalhar_score(a, b)` devolve também o valor de cada critério (usado por `GET /api/compatibilidade/{perfil_id}/`).

---

## 2. Direção do match e convenção de IDs

Somente perfis de **tipos opostos** são comparados:

- `buscando_vaga` ↔ `oferecendo_vaga`
- Perfis do tipo `administrador` são ignorados pelo algoritmo.

O registro `Compatibilidade` no banco sempre segue a convenção:

```
perfil_a_id < perfil_b_id
```

Isso garante unicidade sem duplicatas simétricas. A restrição `unique_together = ('perfil_a', 'perfil_b')` no model `Compatibilidade` reforça essa invariante no banco.

---

## 3. Os 7 critérios e seus pesos

Definidos em `algoritmo/config.py` (devem somar 1,0). Até a versão 1.0.0-rc2 eram 6 critérios (25/25/15/15/10/10); o 7º, a Afinidade por IA, entrou com 10% e os outros foram reduzidos:

| Critério | Peso | Sem a afinidade por IA (renormalizado) | Campo(s) do perfil |
|---|---|---|---|
| `orcamento` | **0,23** | 0,2556 | `orcamento_min`, `orcamento_max` |
| `habitos` | **0,22** | 0,2444 | `fumante`, `aceita_pets`, `aceita_visitas`, `tolerancia_bagunca`, `nivel_organizacao`, `nivel_social` |
| `regiao` | **0,14** | 0,1556 | `regiao` |
| `rotina` | **0,14** | 0,1556 | `perfil_horario`, `nivel_ruido` |
| `moradia` | **0,09** | 0,1000 | `tipo_imovel`, `qtd_moradores` |
| `idade` | **0,08** | 0,0889 | `idade` |
| `afinidade_ia` | **0,10** | — | `bio` (+ `titulo_anuncio` e `descricao_imovel` de quem oferece vaga), via embedding (seção 11) |

```python
PESOS = {
    'orcamento':    0.23,
    'regiao':       0.14,
    'rotina':       0.14,
    'habitos':      0.22,
    'moradia':      0.09,
    'idade':        0.08,
    'afinidade_ia': 0.10,
}
```

---

## 4. Fórmula de cada critério

### 4.1 Orçamento (`sim_orcamento`)

Mede a sobreposição dos intervalos `[min, max]` de cada perfil.

```
overlap   = max(0, min(max_a, max_b) - max(min_a, min_b))
max_range = max(max_a - min_a, max_b - min_b, 1.0)
sim_orcamento = min(1.0, overlap / max_range)
```

Resultado: 1,0 se os intervalos são idênticos; 0,0 se não se sobrepõem.

---

### 4.2 Região (`sim_regiao`)

Comparação exata (após `strip().lower()`):

```
sim_regiao = 1.0 se perfil_a.regiao == perfil_b.regiao, senão 0.0
```

---

### 4.3 Rotina (`sim_rotina`)

Média de duas sub-dimensões:

```
sim_horario = HORARIO_MATRIX[i][j]        # tabela 3×3, ver seção 5
sim_ruido   = 1.0 - |nivel_ruido_a - nivel_ruido_b| / 4.0
sim_rotina  = (sim_horario + sim_ruido) / 2.0
```

`nivel_ruido` é uma escala 1–5 (divisor = 4,0 = diferença máxima possível).

---

### 4.4 Hábitos de convivência (`sim_habitos`)

Média de 6 sub-dimensões:

```
sim_fumante = 1.0 se fumante_a == fumante_b, senão 0.0
sim_pets    = 1.0 se aceita_pets_a == aceita_pets_b, senão 0.0
sim_visitas = VISITAS_MATRIX[i][j]        # tabela 3×3, ver seção 5
sim_bagunca = 1.0 - |tolerancia_bagunca_a - tolerancia_bagunca_b| / 4.0
sim_org     = 1.0 - |nivel_organizacao_a  - nivel_organizacao_b|  / 4.0
sim_social  = 1.0 - |nivel_social_a       - nivel_social_b|       / 4.0

sim_habitos = (sim_fumante + sim_pets + sim_visitas +
               sim_bagunca + sim_org + sim_social) / 6.0
```

Campos de escala 1–5: divisor = 4,0.

---

### 4.5 Estilo de moradia (`sim_moradia`)

Média de duas sub-dimensões:

```
sim_tipo = IMOVEL_MATRIX[i][j]            # tabela 4×4, ver seção 5
sim_qtd  = 1.0 - |qtd_moradores_a - qtd_moradores_b| / 3.0

sim_moradia = (sim_tipo + sim_qtd) / 2.0
```

`qtd_moradores` varia de 1–4 (divisor = 3,0 = diferença máxima possível).

---

### 4.6 Faixa etária (`sim_idade`)

```
diff_idade = |idade_a - idade_b|
sim_idade  = max(0.0, 1.0 - diff_idade / 20.0)
```

Diferença >= 20 anos resulta em sim_idade = 0,0.

---

## 5. Tabelas de similaridade categórica

Definidas em `algoritmo/config.py`. Todas as tabelas são simétricas.

### 5.1 Horário (`HORARIO_MATRIX`)

Índices: `madrugador=0`, `noturno=1`, `flexivel=2`

|  | madrugador | noturno | flexivel |
|---|---|---|---|
| **madrugador** | 1,0 | 0,0 | 0,6 |
| **noturno** | 0,0 | 1,0 | 0,6 |
| **flexivel** | 0,6 | 0,6 | 1,0 |

### 5.2 Visitas (`VISITAS_MATRIX`)

Índices: `raramente=0`, `as_vezes=1`, `frequentemente=2`

|  | raramente | as_vezes | frequentemente |
|---|---|---|---|
| **raramente** | 1,0 | 0,5 | 0,0 |
| **as_vezes** | 0,5 | 1,0 | 0,5 |
| **frequentemente** | 0,0 | 0,5 | 1,0 |

### 5.3 Tipo de imóvel (`IMOVEL_MATRIX`)

Índices: `apartamento=0`, `casa=1`, `republica=2`, `indiferente=3`

|  | apartamento | casa | republica | indiferente |
|---|---|---|---|---|
| **apartamento** | 1,0 | 0,0 | 0,0 | 0,7 |
| **casa** | 0,0 | 1,0 | 0,0 | 0,7 |
| **republica** | 0,0 | 0,0 | 1,0 | 0,7 |
| **indiferente** | 0,7 | 0,7 | 0,7 | 1,0 |

---

## 6. Score final

```
soma  = Σ PESOS[c] * sim_c          # c = os 6 critérios estruturados + afinidade_ia (se houver)
total = Σ PESOS[c]                  # 1,0 com a afinidade; 0,90 sem ela (renormalização)
score_final = round(max(0.0, min(1.0, soma / total)), 4)
```

A soma é feita em Python `float` (não em NumPy), sempre na mesma ordem, pela mesma função (`afinidade.combinar`) nas duas implementações, para garantir resultado idêntico entre escalar e vetorial. A afinidade por IA fica de fora quando um dos perfis não tem embedding (bio com menos de 20 letras) ou com `IA_HABILITADA=False` (seção 11.3).

---

## 7. Pré-cálculo e armazenamento

### Model `Compatibilidade`

```python
class Compatibilidade(models.Model):
    perfil_a    = ForeignKey(Perfil, ...)   # sempre perfil_a.id < perfil_b.id
    perfil_b    = ForeignKey(Perfil, ...)
    score       = FloatField()
    atualizado_em = DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('perfil_a', 'perfil_b')
```

### Quando é recalculado

O signal `post_save` em `Perfil` dispara automaticamente a cada criação ou atualização de perfil:

```python
# matches/signals.py
@receiver(post_save, sender=Perfil)
def recalcular_compatibilidade(sender, instance, **kwargs):
    atualizar_embedding_perfil(instance)   # Afinidade por IA: só se o texto mudou; nunca levanta exceção
    recalcular_lote(instance)
```

### Como é recalculado (`recalcular_lote`)

1. Identifica o tipo oposto (`buscando_vaga` ↔ `oferecendo_vaga`).
2. Busca todos os perfis do tipo oposto em **1 query** (`select_related('usuario', 'embedding_ia')`: os embeddings vêm junto).
3. Calcula os scores em lote via `calcular_scores_lote` (NumPy).
4. Persiste todos os resultados em **1 upsert** (`bulk_create` com `update_conflicts=True`, `batch_size=1000`).

Total: **2 queries ao banco**, independentemente do número de perfis.

---

## 8. Implementação vetorial (NumPy)

### Estratégia

As matrizes de similaridade categórica são convertidas para `np.ndarray` **uma única vez** no import de `vetorial.py`:

```python
_NP_HORARIO = np.array(HORARIO_MATRIX, dtype=np.float64)
_NP_VISITAS = np.array(VISITAS_MATRIX, dtype=np.float64)
_NP_IMOVEL  = np.array(IMOVEL_MATRIX,  dtype=np.float64)
```

Para cada dimensão, os atributos de todos os perfis em `outros` são extraídos em arrays e as operações são feitas em paralelo:

```python
# Exemplo: horário
hi_a = HORARIO_IDX.get(base.perfil_horario, 2)
hi_b = np.array([HORARIO_IDX.get(p.perfil_horario, 2) for p in outros_list])
sim_hor = _NP_HORARIO[hi_a, hi_b]   # indexação vetorial: retorna array de N floats
```

### Garantia de equivalência

A soma ponderada final é calculada em Python `float` (não em operação NumPy pura) para que o arredondamento em 4 casas seja bit-a-bit idêntico ao da versão escalar:

```python
scores = np.array([
    round(max(0.0, min(1.0,
        pesos['orcamento'] * float(sim_orc[i]) + ...
    )), 4)
    for i in range(n)
], dtype=np.float64)
```

### Teste de equivalência

`EquivalenciaVetorialEscalarReforcoTest` em `matches/tests.py` cobre ~318 perfis sintéticos em memória (SimpleNamespace), incluindo:
- todas as 36 combinações categóricas (`perfil_horario × aceita_visitas × tipo_imovel`);
- extremos e intermediários de todos os campos numéricos;
- seis casos de sobreposição de orçamento;
- oito variações de caixa/espaço na região.

Desde a Afinidade por IA, os perfis do teste também têm vetores de 384 dimensões (1 em cada 4 sem vetor) e o teste exige igualdade **exata**: 50.562 pares comparados, 28.560 com a afinidade, diferença máxima 0,0. O benchmark confirmou `MaxDiff = 0.0` em todos os tamanhos de lote testados.

### Complexidade

| Etapa | Complexidade |
|---|---|
| Cálculo matemático (vetorial) | O(N) no tamanho de `outros` |
| Queries ao banco | O(1) — sempre 2, independente de N |

---

## 9. Resultados do benchmark

Medido em `2026-11-20` com `python manage.py benchmark_compatibilidade --repeticoes 3`, **já com o 7º critério** (perfis sintéticos com vetores de 384 dimensões; 1 em cada 5 sem vetor), em PostgreSQL 16 descartável. CSVs em `docs/benchmark/`.

**Ambiente:** Python 3.12.4 · NumPy 2.5.4 · Django 6.1.1 · Windows 10 · Intel64 Family 6 Model 78.

### Seção A — Cálculo em memória (sem banco), rep=3

| N | Loop mediana (s) | NumPy mediana (s) | Speedup | MaxDiff |
|---|---|---|---|---|
| 100 | 0,004038 | 0,004936 | 0,82x | 0,00e+00 |
| 1.000 | 0,042899 | 0,023889 | 1,80x | 0,00e+00 |
| 10.000 | 0,437900 | 0,395129 | 1,11x | 0,00e+00 |
| 50.000 | 2,650556 | 1,244552 | 2,13x | 0,00e+00 |
| 100.000 | 5,472426 | 2,838790 | 1,93x | 0,00e+00 |

Com o 7º critério o lote ficou cerca de 3x mais caro em memória que na versão de 6 critérios (100.000 pares: 2,8 s × 0,96 s), por causa da leitura dos vetores e da calibração por par; continua 2x mais rápido que o loop e com resultado idêntico.

### Seção B — Ponta a ponta com banco, rep=3

| N | Loop mediana (s) | NumPy mediana (s) | Speedup | Queries Loop | Queries NumPy |
|---|---|---|---|---|---|
| 100 | 1,4505 | 0,0649 | **22x** | 601 | 2 |
| 1.000 | 16,9797 | 3,3485 (mín. 0,97) | 5x | >9.000 | 2 |
| 5.000 | 116,0015 | 45,9531 | 2,5x | — | 2 (+ upsert em lotes) |

**Atenção ao ler a seção B:** o benchmark faz todas as repetições dentro de UMA transação que é desfeita no final (para não deixar rastro). Cada repetição apaga e regrava milhares de linhas de `matches_compatibilidade`; dentro da transação o PostgreSQL não pode limpar as versões mortas, e as repetições seguintes ficam cada vez mais lentas (o mínimo de N=1.000 é 0,97 s, a mediana 3,3 s). Sob o profiler, a primeira chamada com 2.000 perfis levou 1,5 s com só 2 consultas (nenhum N+1). A medição do recálculo em dados gravados, sem essa distorção, está na seção 11.8: **1.000 perfis em 0,40 s e 5.000 em 2,4 s**.

O ganho real em produção continua vindo do **padrão de acesso ao banco**: a versão loop faz N+1 queries, a versão em lote faz sempre 2.

### Seção C — Sensibilidade dos pesos (20 bases × 1.000 outros, top-10 em comum com ±5 pp)

| Critério | Peso | +5 pp | −5 pp |
|---|---|---|---|
| orcamento | 0,23 | 0,875 | 0,880 |
| regiao | 0,14 | 0,980 | 0,825 |
| rotina | 0,14 | 0,880 | 0,870 |
| habitos | 0,22 | 0,905 | 0,895 |
| moradia | 0,09 | 0,835 | 0,850 |
| idade | 0,08 | 0,830 | 0,785 |
| afinidade_ia | 0,10 | 0,895 | 0,885 |

Mudar a afinidade por IA em 5 pontos troca em média 1 dos 10 primeiros da lista: o critério influencia a ordem sem dominar o score.

---

## 10. Limitações conhecidas

- **Score não é recalculado em cascata:** ao atualizar o perfil A, recalcula-se A ↔ todos os opostos, mas não os pares que não envolvem A.
- **Região é binária:** qualquer diferença de grafia (maiúsculas, acentos, espaços extras) resulta em `sim_regiao = 0,0`. Normalização básica (`strip().lower()`) já é aplicada, mas variações como "sp" vs "São Paulo" não são tratadas.
- **Campos categóricos sem valor reconhecido** usam o default definido em `config.py` (`flexivel`, `as_vezes`, `indiferente`) — o valor inválido não gera erro, mas pode distorcer silenciosamente o score.
- **Benchmark rodado em máquina de desenvolvimento (Windows 10, sem Docker):** os números absolutos não refletem o ambiente de produção; os speedups relativos entre loop e lote são comparáveis.
- **N=5.000 no benchmark com banco** teve as repetições reduzidas de 3 para 2 (warmup > 30s), e a seção B é distorcida pela transação única (veja a seção 9).
- **Afinidade por IA mede assunto, não posição** ("durmo de madrugada" × "acordo às cinco" dá cosseno 0,78): por isso tem só 10% e a posição fica com os critérios estruturados (seção 11.4).
- **Temas de frases muito curtas** são pouco confiáveis; a margem foi calibrada com bios completas (seção 11.5).
- **Modelo ocupa ~560 MB de RAM** por processo do servidor (cada worker do gunicorn carrega o seu). Com `IA_HABILITADA=False` nada é carregado.

---

## 11. Afinidade por IA (7º critério)

Evolução prevista no documento de abertura: "similaridade vetorial usando embeddings de texto da biografia". Um modelo de linguagem **local** transforma o texto de cada perfil num vetor (embedding) e o cosseno entre dois vetores mede o quanto as bios **falam das mesmas coisas**, mesmo com palavras diferentes ("adoro cozinhar para os amigos" × "faço jantares em casa no fim de semana").

### 11.1 Modelo

| | |
|---|---|
| Modelo | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (multilíngue, treinado para paráfrases; cópia ONNX publicada pela Qdrant) |
| Dimensões | 384 |
| Execução | `fastembed` 0.9.1 + ONNX Runtime 1.32.0, só CPU, **sem PyTorch** |
| Tamanho em disco | 241 MB em `IA_MODELO_DIR` (padrão `backend/.modelos/`, fora do git; o `.onnx` tem 235 MB) |
| Configuração | `IA_HABILITADA` (padrão `True`), `IA_MODELO_DIR`; `IA_EMBEDDER=falso` só nos testes |
| Código | `ia/servico.py` (carga e embeddings), `ia/embeddings.py` (persistência), `ia/temas.py`, `matches/algoritmo/afinidade.py` (cosseno, calibração e combinação) |

O fastembed 0.9.1 suporta exatamente o modelo pedido (`TextEmbedding.list_supported_models()`), então não foi preciso trocar. Alternativas avaliadas na mesma lista: `paraphrase-multilingual-mpnet-base-v2` (768 dimensões, 1 GB) e `multilingual-e5-large` (1024, 2,2 GB) — mais pesadas sem necessidade para bios de 500 caracteres.

**Carga:** uma única vez por processo, sob demanda (primeiro uso), protegida por trava (`threading.RLock`): 8 threads pedindo o modelo ao mesmo tempo geram uma só carga (teste `test_carrega_uma_unica_vez_mesmo_com_varias_threads`). Com os arquivos já baixados, o modelo é aberto com `local_files_only=True` (nenhum acesso à rede). Se a carga falhar (sem internet na primeira vez, arquivo corrompido, falta de memória), o erro vai para o logger `ia.servico`, o serviço fica `indisponivel` e uma nova tentativa só acontece depois de 5 minutos (ou com `baixar_modelo_ia`). **Nenhuma rota devolve 500 por causa da IA.**

### 11.2 Embeddings dos perfis (`ia_embeddingperfil`)

- **Texto de origem:** "Sobre você" (`bio`) + título e descrição do anúncio para quem oferece vaga.
- **Mínimo:** 20 caracteres úteis (letras e dígitos). Abaixo disso não há embedding (e um embedding antigo é apagado).
- **Quando:** no mesmo signal `post_save` do perfil, **antes** do recálculo da compatibilidade. Só gera de novo se o SHA-256 do texto (ou o modelo) mudou: salvar o perfil mudando idade ou orçamento não chama o modelo.
- **Armazenamento compacto:** 384 × float32 normalizados (norma 1) = 1536 bytes em `bytea` (restrição `embedding_vetor_384_ck`). Como o vetor é normalizado, o cosseno é só o produto escalar.
- **Modelo fora do ar ao editar:** o perfil é salvo normalmente; se o texto mudou, o vetor antigo é apagado (não representa mais a bio) e o par fica sem o 7º critério até `gerar_embeddings`.
- **Comando:** `python manage.py gerar_embeddings [--forcar] [--lote 32] [--sem-recalcular]` processa todos os perfis com progresso e tempo e roda `recalcular_compatibilidades` no final.

### 11.3 Cosseno, calibração e renormalização

```
cos        = round(v_a · v_b, 4)                       # vetores normalizados
afinidade  = clamp((cos - 0,20) / (0,65 - 0,20), 0, 1) # IA_COSSENO_PISO, IA_COSSENO_TETO
```

**Pesos** (somam 100%): orçamento 23% · hábitos 22% · região 14% · rotina 14% · moradia 9% · idade 8% · **afinidade IA 10%**.

**Renormalização:** se um dos dois perfis não tem embedding (bio curta) ou a IA está desligada, a afinidade fica de fora e o score é a soma dos outros 6 divididos pela soma dos pesos deles (0,90):

```
score = Σ peso_i · sim_i / Σ peso_i      (i = critérios presentes)
```

Assim, dois perfis idênticos nos 6 critérios têm score 1,0 com ou sem bio — **ninguém é penalizado por ter bio curta**. O peso efetivo de cada critério aparece em `GET /api/compatibilidade/{perfil_id}/` (ex.: orçamento 0,2556 quando a IA não entra).

**Equivalência escalar × vetorial:** as duas implementações chamam as mesmas funções `calibrar` e `combinar` (`afinidade.py`); o lote calcula todos os cossenos num único produto matriz × vetor (m × 384 · 384). O cosseno é arredondado em 4 casas antes da calibração, então uma diferença de último bit entre `np.dot` e o produto matricial não muda o resultado. O teste `EquivalenciaVetorialEscalarReforcoTest` agora tem vetores (1 em cada 4 perfis sem embedding) e exige igualdade **exata**: 50.562 pares, 28.560 com afinidade por IA, diferença máxima 0,0. `EquivalenciaComIATest` repete com 3.200 pares aleatórios.

### 11.4 Calibração (tabela)

Medida com o modelo real (`python` + `ia.servico.gerar_vetores`) em 24 pares de frases e nas 104 combinações buscando × oferecendo do `seed_demo`. Valores finais em `matches/algoritmo/config.py`.

| # | Grupo | Texto A | Texto B | Cosseno | Afinidade | Temas A / B |
|---|---|---|---|---|---|---|
| 1 | parecidas | Adoro cozinhar para os amigos. | Faço jantares em casa no fim de semana. | 0.467 | 0.59 | Culinária / Culinária, Trabalho remoto |
| 2 | parecidas | Passo o dia estudando para concursos. | Minha rotina é de muita leitura e preparação para provas. | 0.669 | 1.00 | Estudos / Estudos |
| 3 | parecidas | Trabalho de casa, em home office, o dia inteiro. | Sou programador remoto e fico no computador em casa. | 0.569 | 0.82 | Trabalho remoto, Organização e limpeza / Trabalho remoto, Organização e limpeza, Games |
| 4 | parecidas | Corro todas as manhãs e vou à academia. | Treino musculação cedo e gosto de correr no parque. | 0.480 | 0.62 | Esportes e academia / Esportes e academia, Natureza e trilhas |
| 5 | parecidas | Tenho um gato e amo animais. | Sou apaixonada por bichos, tenho uma cachorrinha. | 0.760 | 1.00 | Pets / Pets |
| 6 | parecidas | Gosto de casa silenciosa, durmo cedo. | Prefiro ambientes tranquilos e sem barulho à noite. | 0.702 | 1.00 | Silêncio e tranquilidade, Leitura / Silêncio e tranquilidade |
| 7 | parecidas | Toco violão e escuto música o tempo todo. | Sou músico, ensaio guitarra e vou a shows. | 0.723 | 1.00 | Música, Festas e vida social / Música, Festas e vida social |
| 8 | parecidas | Nos fins de semana faço trilhas e acampo. | Adoro natureza, cachoeiras e caminhadas no mato. | 0.606 | 0.90 | Natureza e trilhas / Natureza e trilhas, Organização e limpeza |
| 9 | neutras | Adoro cozinhar para os amigos. | Estudo engenharia civil na faculdade. | 0.070 | 0.00 | Culinária / Estudos, Arte |
| 10 | neutras | Tenho um gato e amo animais. | Trabalho como enfermeira em plantões. | 0.240 | 0.09 | Pets / Sustentabilidade, Organização e limpeza |
| 11 | neutras | Toco violão nas horas vagas. | Sou organizada e mantenho tudo limpo. | 0.276 | 0.17 | Música, Games, Festas e vida social / Organização e limpeza, Sustentabilidade |
| 12 | neutras | Faço trilhas nos fins de semana. | Jogo videogame à noite com amigos online. | 0.235 | 0.08 | Natureza e trilhas / Games, Festas e vida social |
| 13 | neutras | Sou estudante de direito. | Gosto de séries de comédia. | 0.163 | 0.00 | Estudos, Música / Festas e vida social, Cinema e séries, Música |
| 14 | neutras | Trabalho de casa com design gráfico. | Vou à igreja aos domingos. | 0.036 | 0.00 | Arte, Trabalho remoto, Organização e limpeza, Estudos / Religião e espiritualidade |
| 15 | neutras | Leio muitos livros de ficção. | Corro todas as manhãs. | 0.038 | 0.00 | Leitura, Estudos / Esportes e academia |
| 16 | neutras | Cuido de plantas na varanda. | Sou de Recife e estudo medicina. | 0.086 | 0.00 | — / Estudos |
| 17 | opostas | Adoro festas e receber gente em casa toda semana. | Preciso de silêncio absoluto, odeio barulho e visitas. | 0.117 | 0.00 | Culinária, Festas e vida social, Cinema e séries / Silêncio e tranquilidade |
| 18 | opostas | Vivo em festas e baladas. | Sou caseira, fico em casa lendo em silêncio. | 0.345 | 0.32 | Festas e vida social, Música / Silêncio e tranquilidade, Leitura, Trabalho remoto, Organização e limpeza |
| 19 | opostas | Sou muito bagunceiro e não ligo para limpeza. | Sou extremamente organizada, tudo tem que estar limpo. | 0.603 | 0.90 | Sustentabilidade, Organização e limpeza / Organização e limpeza, Sustentabilidade |
| 20 | opostas | Fumo e bebo bastante nas baladas. | Não suporto cigarro nem bebida, levo vida saudável. | 0.512 | 0.69 | Festas e vida social / — |
| 21 | opostas | Tenho três cachorros grandes. | Tenho alergia a animais e não quero pets. | 0.471 | 0.60 | Pets / Pets, Sustentabilidade |
| 22 | opostas | Durmo de madrugada e acordo ao meio-dia. | Acordo às cinco da manhã e durmo às nove da noite. | 0.776 | 1.00 | Silêncio e tranquilidade, Esportes e academia / Silêncio e tranquilidade, Esportes e academia |
| 23 | idênticas | Adoro cozinhar para os amigos. | Adoro cozinhar para os amigos. | 1.000 | 1.00 | Culinária / Culinária |
| 24 | idênticas | Sou estudante tranquila e organizada. | Sou uma estudante tranquila e bem organizada. | 0.986 | 1.00 | Estudos, Silêncio e tranquilidade / Estudos, Silêncio e tranquilidade |

Os temas de frases soltas (uma linha) são menos confiáveis que os de bios completas: a margem compara o tema com a média do próprio texto, e um texto de 5 palavras tem pouca informação (ex.: "Organização e limpeza" no par 3). Na tela, os temas aparecem só para bios, e só os temas EM COMUM.

**Como o piso e o teto foram escolhidos:**

- Frases sem relação ficam entre 0,04 e 0,28; frases com o mesmo interesse em palavras diferentes, entre 0,47 e 0,76.
- Bios completas (2 a 4 frases, várias ideias) têm cossenos mais altos entre si: nas 104 combinações do seed, mínimo 0,128, mediana 0,396 e máximo 0,679. Com piso 0,20 e teto 0,65, a bio "sem relação" típica (0,30 a 0,45) cai **perto do meio** (afinidade 0,22 a 0,55, mediana 0,44). Isso evita que ter bio seja pior do que não ter: sem bio o critério sai e os outros 6 são renormalizados; com bio neutra, a afinidade fica próxima da média dos outros critérios.
- O teto 0,65 dá afinidade 1,0 a pares claramente parecidos (Isabela × Henrique: 0,679).

**Limitação medida (importante):** o modelo mede **assunto**, não **posição**. Frases opostas sobre o mesmo assunto ficam com cosseno alto: "durmo de madrugada" × "acordo às cinco" (par 22) e "bagunceiro" × "organizada" (par 19). Por isso a afinidade tem só 10% e a posição continua com os critérios estruturados (rotina, hábitos, visitas, fumante, pets), que já separam esses casos. Opostos de assunto diferente (festas × silêncio, pares 17 e 18) ficam baixos, como esperado.

### 11.5 Temas em comum (explicação visível)

`ia/temas.py` tem 16 temas de convivência (culinária, estudos, trabalho remoto, música, festas e vida social, silêncio e tranquilidade, esportes e academia, games, leitura, pets, natureza e trilhas, arte, religião e espiritualidade, cinema e séries, sustentabilidade, organização e limpeza), cada um com 2 ou 3 frases. Classificação **zero-shot** (nada é treinado):

1. As 43 frases dos temas viram embeddings uma vez por processo (memória).
2. Nota do tema = maior cosseno entre o texto e as frases do tema.
3. O texto tem o tema quando **nota ≥ 0,45** (`LIMIAR_TEMA`) **e nota ≥ média das 16 notas do texto + 0,13** (`MARGEM_TEMA`), no máximo 5 temas (`MAX_TEMAS`).
4. Os ids ficam em `ia_embeddingperfil.temas`; temas em comum = interseção dos dois perfis.

A margem relativa foi necessária: bios longas "parecem" um pouco com tudo (média 0,30 a 0,46), e só o limiar absoluto marcava "festas" em bios que só citam amigos. Com as notas reais do seed, a margem 0,13 recuperou 4 temas corretos que 0,14 perdia (Ana/pets 0,137; Lucas/natureza 0,135; Vitória/esportes 0,136 e natureza 0,130) ao custo de 1 falso positivo (Elizabete/sustentabilidade, 0,131). Mudou a lista de temas? Rode `gerar_embeddings --forcar`.

### 11.6 Pares do `seed_demo` (banco descartável, modelo real)

| Par (buscando × oferecendo) | Relação | Cosseno | Afinidade IA | Temas em comum | Score total |
|---|---|---|---|---|---|
| Isabela Nunes × Henrique Moura | mesmo interesse, palavras diferentes ("adoro cozinhar para os amigos" × "faço jantares em casa no fim de semana") | 0,679 | **1,00** | Culinária | 60% |
| Pedro Henrique × Thiago Santos | "toco guitarra e escuto rock" × "sou músico, toco em bares, ensaio com a banda" | 0,614 | **0,92** | Música | 67% |
| Ana Luísa × Beatriz Almeida | "tenho uma gata" × "divido o apê com dois cachorros resgatados" | 0,575 | **0,83** | Pets | 81% |
| Rafael Costa × Clara Freitas | "valorizo uma casa quieta" × "valorizo muito o silêncio" | 0,527 | **0,73** | Silêncio e tranquilidade | 71% |
| Mariana Oliveira × João Vitor | "livros, plantões e provas" × "corrijo provas e preparo aulas" | 0,491 | **0,65** | Estudos | 56% |
| Lucas Mendes × Júlia Prado | "cachoeiras e trilhas" × "trilha, acampamento e mar" | 0,486 | **0,63** | Natureza e trilhas | 54% |
| Guilherme Alves × Marcos Vinícius | festas × festas (bios com outros assuntos misturados) | 0,357 | 0,35 | Festas e vida social | 54% |
| Patrícia Gomes × Thiago Santos | OPOSTOS: silêncio × casa cheia de amigos | 0,326 | 0,28 | — | 12% |
| Rafael Costa × Marcos Vinícius | OPOSTOS: casa quieta × música alta até de madrugada | 0,151 | **0,00** | — | 32% |
| Mariana Oliveira × Marcos Vinícius | OPOSTOS: rotina de estudos × festa na piscina | 0,128 | **0,00** | — | 35% |

Nas 104 combinações buscando × oferecendo: cosseno mínimo 0,128, mediana 0,396, máximo 0,679; afinidade mínima 0,00, mediana 0,44, máxima 1,00.

Temas detectados por perfil:

| Perfil | Temas | Perfil | Temas |
|---|---|---|---|
| Ana Luísa | Pets, Arte | Beatriz Almeida | Pets |
| Camila Souza | Pets | Clara Freitas | Silêncio e tranquilidade |
| Diego Ferreira | Cinema e séries | Henrique Moura | Culinária, Sustentabilidade |
| Elizabete Ramos | Arte, Sustentabilidade (falso positivo) | João Vitor | Estudos, Silêncio e tranquilidade, Leitura |
| Fernanda Lima | Silêncio e tranquilidade, Leitura | Júlia Prado | Pets, Natureza e trilhas |
| Guilherme Alves | Festas e vida social | Marcos Vinícius | Festas e vida social |
| Isabela Nunes | Culinária | Renato Barbosa | Trabalho remoto |
| Lucas Mendes | Trabalho remoto, Natureza e trilhas, Arte | Thiago Santos | Música, Festas e vida social |
| Mariana Oliveira | Estudos | | |
| Patrícia Gomes | Trabalho remoto, Silêncio e tranquilidade, Organização e limpeza | | |
| Pedro Henrique | Música, Games | | |
| Rafael Costa | Silêncio e tranquilidade | | |
| Vitória Cardoso | Esportes e academia, Natureza e trilhas | | |

O score total continua dominado pelos critérios estruturados: Isabela × Henrique têm afinidade 1,0 mas score 60% (horário, visitas e moradia diferentes); Ana × Beatriz têm 81%.

### 11.7 API

| Rota | Quem | O que traz |
|---|---|---|
| `GET /api/descoberta/` | usuário comum | `afinidade_ia` (0 a 1 ou `null`) e `temas_em_comum` em cada item; embeddings via `select_related` (o número de consultas não cresce com o número de cards — teste `test_sem_consultas_n_mais_1`) |
| `GET /api/perfis/{id}/` | logado | os mesmos dois campos em relação ao usuário (`null`/`[]` no próprio perfil e para o admin) |
| `GET /api/compatibilidade/{perfil_id}/` | usuário comum, perfil do tipo oposto ativo | score, os 7 critérios (peso, peso efetivo, valor, contribuição), afinidade, cosseno, temas de cada um e em comum, `ia_disponivel`, `motivo_sem_ia` |
| `GET /api/admin/ia/status/` | administrador | modelo, dimensões, disponível, perfis com embedding × total, temas (com contagem), tempo médio de geração, última atualização, calibração |
| `POST /api/admin/ia/testar/` | administrador | `{texto_a, texto_b}` (até 1000 caracteres) → cosseno, afinidade, temas, tempo; 503 sem o modelo; log `IA_TESTE` **sem os textos** |

Nada nas três primeiras rotas chama o modelo: os vetores já estão gravados, então elas funcionam mesmo com o modelo fora do ar.

### 11.8 Desempenho medido

Medido em 20/11/2026 na máquina de desenvolvimento (Windows 10, Intel64 Family 6 Model 78, Python 3.12.4, fastembed 0.9.1,
onnxruntime 1.32.0, só CPU). Scripts das medições: carga e embeddings num processo novo; recálculo em banco PostgreSQL 16 descartável.

**Modelo**

| Medida | Resultado |
|---|---|
| Download + primeira carga (`baixar_modelo_ia`, 1ª vez) | ~35 s (download de 241 MB) |
| Import do fastembed/onnxruntime | 2,0 a 3,1 s (uma vez por processo) |
| Carga do modelo + aquecimento (arquivos já baixados) | 3,0 a 3,3 s (uma vez por processo; dentro do `runserver`, com o import, 9,3 s no 1º uso) |
| Embeddings das 43 frases dos temas | ~0,9 s (uma vez por processo) |
| **Memória** | +561 MB ao carregar (69 → 630 MB), pico de 645 MB depois de 105 embeddings |
| **Embedding de uma bio + temas** (fluxo do signal, 105 textos) | média **88 ms**, mediana 79 ms, p95 157 ms |
| Lotes de textos (63 bios) | 72 ms/texto com `batch_size=1`; 103 (4), 114 (8), 121 (16) e 136 ms (32): **lote maior é mais lento** neste CPU, porque todos os textos são preenchidos até o tamanho do mais longo. Por isso o serviço usa `batch_size=1`. |
| `gerar_embeddings --forcar` no seed (21 perfis) | 3,2 s (inclui as frases dos temas) |

**Recálculo em lote com o novo critério** (`recalcular_lote`: 1 perfil × N do tipo oposto, todos com embedding — pior caso; 7 repetições, dados gravados):

| N (perfis do tipo oposto) | Com o 7º critério (mediana / mín.) | Só 6 critérios (`IA_HABILITADA=False`) | Consultas |
|---|---|---|---|
| 100 | 45 ms / 35 ms | 38 ms / 32 ms | 2 |
| 1.000 | 400 ms / 331 ms | 468 ms / 332 ms | 2 |
| 5.000 | 2,38 s / 2,05 s | 1,99 s / 1,78 s | 8 (upsert em lotes de 1.000) |

O custo do 7º critério no recálculo é de 0 a 20%: os vetores vêm na mesma consulta (`select_related('embedding_ia')`) e os cossenos saem de um único produto matricial. Em memória (benchmark, seção A), 100.000 pares levam 2,8 s no lote.

### 11.9 Privacidade

- O modelo roda **no próprio servidor**: as bios não são enviadas para nenhum serviço externo (nem de IA, nem de nuvem).
- A internet só é usada uma vez, para baixar os arquivos do modelo (`baixar_modelo_ia`). Depois disso o servidor abre o modelo com `local_files_only=True` e a telemetria do Hugging Face fica desligada (`HF_HUB_DISABLE_TELEMETRY=1`).
- O banco guarda só o vetor e o SHA-256 do texto (o texto já está no perfil). O teste do painel registra no log apenas o tamanho dos textos e o resultado.
- O vetor não é exposto pela API; só a afinidade (um número) e os temas.

### 11.10 Testes

`ia/tests/` (87 testes) usa o **embedder falso determinístico** (`IA_EMBEDDER=falso`: cada radical de palavra vira um vetor pseudoaleatório fixo), sem baixar nem carregar modelo. Cobre: serviço (carga única com threads, falha de carga, nova tentativa, arquivo corrompido, IA desligada), calibração, pesos e renormalização, sem embedding, equivalência escalar × vetorial, signal (só regera quando o texto muda, bio curta, anúncio, modelo antigo, falhas), rotas (permissões, validações, N+1, 503, log sem textos, **nenhum 500 com o modelo fora do ar**), comandos e temas. Só `test_integracao_modelo.py` usa o modelo real e é **pulado** se ele não estiver baixado.
