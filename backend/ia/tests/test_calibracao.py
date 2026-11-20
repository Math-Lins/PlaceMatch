"""Pesos, calibração do cosseno, renormalização e o 7º critério nas duas implementações."""
from types import SimpleNamespace

import numpy as np
from django.test import SimpleTestCase, override_settings

from matches.algoritmo import PESOS, calcular_score, calcular_scores_lote, detalhar_score
from matches.algoritmo.afinidade import calibrar, combinar, pesos_efetivos
from matches.algoritmo.config import CRITERIOS_ESTRUTURADOS, IA_COSSENO_PISO, IA_COSSENO_TETO


def _ns(pid=1, vetor=None, **kw):
    base = dict(id=pid, orcamento_min=800.0, orcamento_max=1500.0, regiao='Recife', fumante=False, aceita_pets=True,
                tolerancia_bagunca=3, nivel_organizacao=3, perfil_horario='flexivel', nivel_ruido=3, nivel_social=3,
                aceita_visitas='as_vezes', tipo_imovel='indiferente', qtd_moradores=2, idade=25, vetor_ia=vetor)
    base.update(kw)
    return SimpleNamespace(**base)


def _unit(*valores):
    v = np.zeros(384)
    v[:len(valores)] = valores
    return v / np.linalg.norm(v)


class PesosTest(SimpleTestCase):
    def test_novos_pesos_somam_100(self):
        self.assertEqual(PESOS, {'orcamento': 0.23, 'regiao': 0.14, 'rotina': 0.14, 'habitos': 0.22,
                                 'moradia': 0.09, 'idade': 0.08, 'afinidade_ia': 0.10})
        self.assertAlmostEqual(sum(PESOS.values()), 1.0, places=12)

    def test_pesos_efetivos_sem_ia_renormalizam_os_6(self):
        ef = pesos_efetivos(PESOS, com_ia=False)
        self.assertEqual(ef['afinidade_ia'], 0.0)
        self.assertAlmostEqual(sum(ef.values()), 1.0, places=12)
        self.assertAlmostEqual(ef['orcamento'], 0.23 / 0.90, places=12)
        self.assertAlmostEqual(ef['orcamento'] / ef['habitos'], 0.23 / 0.22, places=12)  # proporção mantida

    def test_pesos_efetivos_com_ia_sao_os_configurados(self):
        ef = pesos_efetivos(PESOS, com_ia=True)
        for k, v in PESOS.items():
            self.assertAlmostEqual(ef[k], v, places=12)


class CalibracaoTest(SimpleTestCase):
    def test_escala_linear_limitada(self):
        self.assertEqual(calibrar(IA_COSSENO_PISO), 0.0)
        self.assertEqual(calibrar(IA_COSSENO_TETO), 1.0)
        self.assertEqual(calibrar(-0.5), 0.0)
        self.assertEqual(calibrar(0.0), 0.0)
        self.assertEqual(calibrar(0.99), 1.0)
        self.assertAlmostEqual(calibrar((IA_COSSENO_PISO + IA_COSSENO_TETO) / 2), 0.5, places=4)
        self.assertIsNone(calibrar(None))

    def test_monotonica(self):
        valores = [calibrar(c) for c in np.linspace(-1, 1, 201)]
        self.assertEqual(valores, sorted(valores))

    def test_piso_menor_que_teto_e_dentro_do_intervalo_do_cosseno(self):
        self.assertTrue(-1 < IA_COSSENO_PISO < IA_COSSENO_TETO < 1)


class RenormalizacaoTest(SimpleTestCase):
    def test_sem_ia_e_a_media_ponderada_dos_6(self):
        sims = (1.0, 0.0, 0.5, 0.8, 0.25, 0.9)
        esperado = sum(PESOS[k] * s for k, s in zip(CRITERIOS_ESTRUTURADOS, sims)) / 0.90
        self.assertAlmostEqual(combinar(sims, None, PESOS), round(esperado, 4), places=4)

    def test_ninguem_e_penalizado_por_bio_curta(self):
        """Par perfeito nos 6 critérios: 1.0 sem embedding (e não 0.90)."""
        a, b = _ns(1), _ns(2)
        self.assertEqual(calcular_score(a, b), 1.0)
        det = detalhar_score(a, b)
        self.assertIsNone(det['afinidade_ia'])
        self.assertIsNone(det['cosseno'])

    def test_so_um_dos_perfis_com_embedding_tambem_ignora(self):
        self.assertEqual(calcular_score(_ns(1, _unit(1)), _ns(2, None)), 1.0)

    def test_com_ia_o_criterio_entra_com_10_por_cento(self):
        iguais = calcular_score(_ns(1, _unit(1, 0)), _ns(2, _unit(1, 0)))
        opostos = calcular_score(_ns(1, _unit(1, 0)), _ns(2, _unit(0, 1)))
        self.assertEqual(iguais, 1.0)
        self.assertEqual(opostos, 0.9)  # cosseno 0 → afinidade 0 → perde exatamente o peso da IA

    @override_settings(IA_HABILITADA=False)
    def test_ia_desligada_ignora_os_vetores(self):
        self.assertEqual(calcular_score(_ns(1, _unit(1, 0)), _ns(2, _unit(0, 1))), 1.0)
        _, scores = calcular_scores_lote(_ns(1, _unit(1, 0)), [_ns(2, _unit(0, 1))])
        self.assertEqual(scores.tolist(), [1.0])

    def test_detalhar_devolve_os_7_valores(self):
        det = detalhar_score(_ns(1, _unit(1, 1)), _ns(2, _unit(1, 0), regiao='Olinda'))
        self.assertEqual(set(det['criterios']), set(CRITERIOS_ESTRUTURADOS))
        self.assertEqual(det['criterios']['regiao'], 0.0)
        self.assertAlmostEqual(det['cosseno'], 0.7071, places=4)
        self.assertEqual(det['afinidade_ia'], 1.0)


class EquivalenciaComIATest(SimpleTestCase):
    """Escalar × vetorial com o 7º critério: resultados IDÊNTICOS, com e sem embedding."""

    def test_lote_igual_ao_escalar(self):
        rng = np.random.default_rng(7)
        direcao = rng.standard_normal(384)
        perfis = []
        for i in range(1, 121):
            vetor = None
            if i % 5:
                v = rng.standard_normal(384) + direcao * rng.uniform(0, 3)
                vetor = v / np.linalg.norm(v)
            perfis.append(_ns(i, vetor, idade=int(rng.integers(18, 60)), nivel_ruido=int(rng.integers(1, 6)),
                              orcamento_min=float(rng.integers(300, 1500)), orcamento_max=float(rng.integers(1500, 4000)),
                              regiao=rng.choice(['Recife', 'Olinda']), perfil_horario=rng.choice(['madrugador', 'noturno', 'flexivel'])))
        com_ia = 0
        for base in perfis[:40]:
            ids, lote = calcular_scores_lote(base, perfis[40:])
            for outro, score in zip(perfis[40:], lote.tolist()):
                self.assertEqual(score, calcular_score(base, outro))
                com_ia += base.vetor_ia is not None and outro.vetor_ia is not None
            self.assertEqual(ids.tolist(), [p.id for p in perfis[40:]])
        self.assertGreater(com_ia, 1000)
