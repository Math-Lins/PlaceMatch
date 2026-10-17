# Algoritmo de Compatibilidade — PlaceMatch

Documento gerado a partir do código-fonte em `backend/matches/algoritmo/`.
Toda alteração de peso ou regra deve ser feita em `config.py` — os demais módulos apenas lêem as constantes definidas ali.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Direção do match e convenção de IDs](#2-direção-do-match-e-convenção-de-ids)
3. [Os 6 critérios e seus pesos](#3-os-6-critérios-e-seus-pesos)
4. [Fórmula de cada critério](#4-fórmula-de-cada-critério)
5. [Tabelas de similaridade categórica](#5-tabelas-de-similaridade-categórica)
6. [Score final](#6-score-final)
7. [Pré-cálculo e armazenamento](#7-pré-cálculo-e-armazenamento)
8. [Implementação vetorial (NumPy)](#8-implementação-vetorial-numpy)
9. [Resultados do benchmark](#9-resultados-do-benchmark)
10. [Limitações conhecidas](#10-limitações-conhecidas)

---

## 1. Visão geral

O algoritmo calcula um **score de compatibilidade** entre dois perfis, retornando um valor entre **0,0** (incompatível) e **1,0** (compatível perfeito). O score é arredondado em 4 casas decimais e clampado ao intervalo [0, 1].

Existem duas implementações do mesmo cálculo, matematicamente equivalentes:

| Módulo | Função | Uso |
|---|---|---|
| `algoritmo/escalar.py` | `calcular_score(perfil_a, perfil_b)` | Cálculo individual; base de referência |
| `algoritmo/vetorial.py` | `calcular_scores_lote(base, outros, pesos=None)` | Cálculo em lote via NumPy; usado em produção |

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

## 3. Os 6 critérios e seus pesos

Definidos em `algoritmo/config.py` (devem somar 1,0):

| Critério | Peso | Campo(s) do perfil |
|---|---|---|
| `orcamento` | **0,25** | `orcamento_min`, `orcamento_max` |
| `habitos` | **0,25** | `fumante`, `aceita_pets`, `aceita_visitas`, `tolerancia_bagunca`, `nivel_organizacao`, `nivel_social` |
| `regiao` | **0,15** | `regiao` |
| `rotina` | **0,15** | `perfil_horario`, `nivel_ruido` |
| `moradia` | **0,10** | `tipo_imovel`, `qtd_moradores` |
| `idade` | **0,10** | `idade` |

```python
PESOS = {
    'orcamento': 0.25,
    'habitos':   0.25,
    'regiao':    0.15,
    'rotina':    0.15,
    'moradia':   0.10,
    'idade':     0.10,
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
score = (
    PESOS['orcamento'] * sim_orcamento
  + PESOS['regiao']    * sim_regiao
  + PESOS['rotina']    * sim_rotina
  + PESOS['habitos']   * sim_habitos
  + PESOS['moradia']   * sim_moradia
  + PESOS['idade']     * sim_idade
)

score_final = round(max(0.0, min(1.0, score)), 4)
```

O arredondamento é feito em Python `float` (não em NumPy) para garantir precisão idêntica entre as implementações escalar e vetorial.

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
    recalcular_lote(instance)
```

### Como é recalculado (`recalcular_lote`)

1. Identifica o tipo oposto (`buscando_vaga` ↔ `oferecendo_vaga`).
2. Busca todos os perfis do tipo oposto em **1 query** (`select_related`).
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

A diferença máxima tolerada entre os dois modos é `1e-4`. O benchmark confirmou `MaxDiff = 0.0` em todos os tamanhos de lote testados.

### Complexidade

| Etapa | Complexidade |
|---|---|
| Cálculo matemático (vetorial) | O(N) no tamanho de `outros` |
| Queries ao banco | O(1) — sempre 2, independente de N |

---

## 9. Resultados do benchmark

Medido em `2026-10-17` com `python manage.py benchmark_compatibilidade`.

**Ambiente:**

| | |
|---|---|
| Python | 3.12.4 [MSC v.1940 64 bit (AMD64)] |
| NumPy | 2.5.4 |
| Django | 6.1.1 |
| Sistema | Windows 10 |
| CPU | Intel64 Family 6 Model 78 Stepping 3, GenuineIntel |
| Banco | PostgreSQL — db=placematch |

### Seção A — Cálculo em memória (sem banco), rep=5

| N | Loop mediana (s) | NumPy mediana (s) | Speedup | MaxDiff |
|---|---|---|---|---|
| 100 | 0,002553 | 0,003876 | 0,66x | 0,00e+00 |
| 1.000 | 0,022388 | 0,016405 | 1,36x | 0,00e+00 |
| 10.000 | 0,305483 | 0,266742 | 1,15x | 0,00e+00 |
| 50.000 | 0,610897 | 0,412539 | 1,48x | 0,00e+00 |
| 100.000 | 1,193900 | 0,958178 | 1,25x | 0,00e+00 |

O NumPy tem overhead de setup que penaliza lotes pequenos (N < ~1.000). O ganho de velocidade no cálculo puro é modesto (1,2–1,5x).

### Seção B — Ponta a ponta com banco, rep=5

| N | Loop mediana (s) | NumPy mediana (s) | Speedup | Queries Loop | Queries NumPy |
|---|---|---|---|---|---|
| 100 | 0,9271 | 0,0272 | **34x** | 601 | 2 |
| 1.000 | 11,5067 | 0,2538 | **45x** | >9.000 | 2 |
| 5.000 | 73,7997 | 1,2169 | **61x** | — | 2 |

O ganho real em produção não vem do NumPy em si, mas do **padrão de acesso ao banco**: a versão loop fazia N+1 queries (uma por `update_or_create`), enquanto a versão em lote faz sempre 2 queries. O speedup aumenta com N — para 5.000 perfis, a diferença é de ~73s vs ~1,2s.

---

## 10. Limitações conhecidas

- **Score não é recalculado em cascata:** ao atualizar o perfil A, recalcula-se A ↔ todos os opostos, mas não os pares que não envolvem A.
- **Região é binária:** qualquer diferença de grafia (maiúsculas, acentos, espaços extras) resulta em `sim_regiao = 0,0`. Normalização básica (`strip().lower()`) já é aplicada, mas variações como "sp" vs "São Paulo" não são tratadas.
- **Campos categóricos sem valor reconhecido** usam o default definido em `config.py` (`flexivel`, `as_vezes`, `indiferente`) — o valor inválido não gera erro, mas pode distorcer silenciosamente o score.
- **Benchmark rodado em máquina de desenvolvimento (Windows 10, sem Docker):** os números absolutos não refletem o ambiente de produção; os speedups relativos entre loop e lote são comparáveis.
- **N=5.000 no benchmark com banco** teve as repetições reduzidas de 5 para 2 (warmup > 30s), portanto a mediana é menos estável para esse ponto.
