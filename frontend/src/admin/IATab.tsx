// Aba "ThoLuk (IA)" do painel: situação do ThoLuk, laboratório (comparar dois textos) e o benchmark de paralelismo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getBenchmarkParalelismo, getIAStatus, testarIA } from '../api';
import type { BenchmarkParalelismo, IAStatus, IATesteResultado, ModoParalelo, SituacaoIA, Tema } from '../api';
import { GraficoWorkers } from './graficos';
import type { SerieWorkers } from './graficos';
import {
  C, FONTE_TEXTO, FONTE_TITULO, RAIO, Botao, Campo, CartaoTabela, Chip, EstadoCarregando, EstadoErro, EstadoVazio,
  ESTILO_TABELA, ESTILO_TD, ESTILO_TH, Selo, dataHoraBR, estiloCampo, numeroBR,
} from '../ui';
import type { TomSelo } from '../ui';

type Secao = 'status' | 'laboratorio' | 'paralelismo';
const SECOES: { id: Secao; rotulo: string }[] = [
  { id: 'status', rotulo: 'Status' },
  { id: 'laboratorio', rotulo: 'Laboratório' },
  { id: 'paralelismo', rotulo: 'Processamento paralelo' },
];

export default function IATab() {
  const [secao, setSecao] = useState<Secao>('status');
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div role="group" aria-label="Seções da aba ThoLuk (IA)" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {SECOES.map(s => <Chip key={s.id} ativo={secao === s.id} onClick={() => setSecao(s.id)}>{s.rotulo}</Chip>)}
      </div>
      {secao === 'status' && <StatusIA />}
      {secao === 'laboratorio' && <Laboratorio />}
      {secao === 'paralelismo' && <Paralelismo />}
    </div>
  );
}

function Cartao({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section style={{ background: C.card, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 700, color: C.text, margin: 0 }}>{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: React.ReactNode; detalhe?: string }) {
  return (
    <div style={{ background: C.bg, borderRadius: '14px', padding: '14px 16px', border: `1px solid ${C.border}` }}>
      <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted, margin: '0 0 6px', fontWeight: 700 }}>{rotulo}</p>
      <p style={{ fontFamily: FONTE_TITULO, fontSize: '20px', fontWeight: 800, color: C.text, margin: 0, overflowWrap: 'anywhere' }}>{valor}</p>
      {detalhe && <p style={{ fontFamily: FONTE_TEXTO, fontSize: '12px', color: C.muted, margin: '4px 0 0' }}>{detalhe}</p>}
    </div>
  );
}

// ─── a) Status ──────────────────────────────────────────────────────────────────

const TOM_SITUACAO: Record<SituacaoIA, TomSelo> = {
  disponivel: 'mint', carregando: 'coral', indisponivel: 'perigo', desabilitada: 'neutro', nao_carregado: 'neutro',
};
const ICONE_SITUACAO: Record<SituacaoIA, string> = {
  disponivel: '●', carregando: '◌', indisponivel: '✕', desabilitada: '○', nao_carregado: '○',
};

function StatusIA() {
  const [status, setStatus] = useState<IAStatus | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    setErro('');
    try {
      const s = await getIAStatus();
      setStatus(s);
      // Enquanto o modelo carrega, atualiza sozinho a cada 2 s.
      if (s.situacao === 'carregando') temporizador.current = setTimeout(carregar, 2000);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar a situação do ThoLuk.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    return () => { if (temporizador.current) clearTimeout(temporizador.current); };
  }, [carregar]);

  if (carregando && !status) return <EstadoCarregando texto="Carregando a situação do ThoLuk…" />;
  if (erro && !status) return <EstadoErro mensagem={erro} onTentarNovamente={() => { setCarregando(true); carregar(); }} />;
  if (!status) return null;

  const fracao = status.perfis_total ? status.perfis_com_embedding / status.perfis_total : 0;
  const tipico = status.tempo_tipico_geracao_ms ?? status.tempo_medio_geracao_ms;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Cartao titulo="Situação do ThoLuk" acao={<Botao tamanho="compacto" variante="neutro" onClick={carregar}>Atualizar</Botao>}>
        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: '0 0 12px' }}>
          ThoLuk, a IA de afinidade do PlaceMatch: um modelo de linguagem que roda no próprio servidor e compara o significado das bios.
        </p>
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <Selo tom={TOM_SITUACAO[status.situacao]} grande>
            <span aria-hidden="true" className={status.situacao === 'carregando' ? 'animate-spin' : undefined} style={{ display: 'inline-block' }}>
              {ICONE_SITUACAO[status.situacao]}
            </span>
            {status.situacao_texto}
          </Selo>
          {status.situacao === 'carregando' && (
            <span style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted }}>atualizando automaticamente…</span>
          )}
          {status.situacao === 'nao_carregado' && status.modelo_baixado && (
            <span style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted }}>o modelo está baixado e carrega no primeiro uso</span>
          )}
        </div>
        {status.erro && (
          <p role="alert" style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.danger, margin: '0 0 16px' }}>Última falha: {status.erro}</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '12px' }}>
          <Indicador rotulo="Modelo" valor={<span style={{ fontSize: '15px' }}>{status.modelo.split('/').pop()}</span>} detalhe="modelo de linguagem multilíngue do ThoLuk" />
          <Indicador rotulo="Dimensões do vetor" valor={numeroBR(status.dimensoes)} />
          <Indicador rotulo="Perfis com embedding" valor={`${numeroBR(status.perfis_com_embedding)} de ${numeroBR(status.perfis_total)}`}
            detalhe={status.perfis_sem_embedding_com_texto > 0 ? `${status.perfis_sem_embedding_com_texto} com bio aguardando análise` : `${numeroBR(fracao * 100, 0)}% dos perfis`} />
          <Indicador rotulo="Tempo típico por embedding" valor={tipico != null ? `${numeroBR(tipico, 1)} ms` : '—'}
            detalhe="mediana por bio (embedding e temas), sem a carga do modelo" />
          <Indicador rotulo="Carga do modelo" valor={status.tempo_carregamento_ms != null ? `${numeroBR(status.tempo_carregamento_ms / 1000, 1)} s` : '—'}
            detalhe={status.tempo_carregamento_ms != null ? 'uma vez, quando o servidor sobe' : 'ainda não carregado neste servidor'} />
          <Indicador rotulo="Temas cadastrados" valor={numeroBR(status.temas_cadastrados)} />
          <Indicador rotulo="Última atualização" valor={<span style={{ fontSize: '15px' }}>{dataHoraBR(status.ultima_atualizacao)}</span>}
            detalhe="último embedding gerado" />
        </div>
      </Cartao>
      <Cartao titulo="Temas de convivência (perfis com cada tema)">
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', listStyle: 'none', padding: 0, margin: 0 }}>
          {[...status.temas].sort((a, b) => b.perfis - a.perfis).map(t => (
            <li key={t.id}><Selo tom={t.perfis > 0 ? 'mint' : 'neutro'}>{t.nome}: {t.perfis}</Selo></li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}

// ─── b) Laboratório ─────────────────────────────────────────────────────────────

const EXEMPLOS = [
  { rotulo: 'Interesses parecidos, palavras diferentes', a: 'Adoro cozinhar para os amigos e testar receitas novas.', b: 'Faço jantares em casa no fim de semana e curto gastronomia.' },
  { rotulo: 'Estilos diferentes', a: 'Amo festas, receber gente em casa e sair toda sexta.', b: 'Gosto de silêncio, leio muito e durmo cedo.' },
  { rotulo: 'Estudo e foco', a: 'Estou no último ano de engenharia e passo as noites estudando.', b: 'Faço mestrado e preciso de um ambiente tranquilo para estudar.' },
];
const LIMITE = 1000;

function Medidor({ rotulo, valor, minimo = 0, texto, descricao, destaque = false }: {
  rotulo: string; valor: number; minimo?: number; texto: string; descricao: string; destaque?: boolean;
}) {
  const fracao = Math.max(0, Math.min(1, (valor - minimo) / (1 - minimo)));
  return (
    <div style={{ background: destaque ? C.mintSoft : C.bg, borderRadius: '14px', padding: '16px', border: `1px solid ${C.border}` }}>
      <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', fontWeight: 700, color: C.muted, margin: '0 0 6px' }}>{rotulo}</p>
      <p style={{ fontFamily: FONTE_TITULO, fontSize: '30px', fontWeight: 800, color: destaque ? C.mintText : C.text, margin: '0 0 10px', lineHeight: 1 }}>{texto}</p>
      <div role="meter" aria-label={rotulo} aria-valuemin={minimo} aria-valuemax={1} aria-valuenow={valor} aria-valuetext={texto}
        style={{ height: '10px', borderRadius: '5px', background: destaque ? C.card : C.border, overflow: 'hidden' }}>
        <div style={{ width: `${fracao * 100}%`, height: '100%', borderRadius: '5px', background: destaque ? `linear-gradient(90deg, ${C.mint}, ${C.mintDark})` : C.primary }} />
      </div>
      <p style={{ fontFamily: FONTE_TEXTO, fontSize: '12px', color: C.muted, margin: '8px 0 0', lineHeight: 1.5 }}>{descricao}</p>
    </div>
  );
}

function TemasDoTexto({ rotulo, temas, comuns }: { rotulo: string; temas: Tema[]; comuns: Set<string> }) {
  return (
    <div>
      <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', fontWeight: 700, color: C.muted, margin: '0 0 8px' }}>{rotulo}</p>
      {temas.length === 0 ? (
        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: 0 }}>Nenhum tema reconhecido.</p>
      ) : (
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', listStyle: 'none', padding: 0, margin: 0 }}>
          {temas.map(t => (
            <li key={t.id}>
              <Selo tom={comuns.has(t.id) ? 'mint' : 'neutro'}>{t.nome}{comuns.has(t.id) && <span className="sr-only"> (em comum)</span>}</Selo>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Laboratorio() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [resultado, setResultado] = useState<IATesteResultado | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState('');
  const [indisponivel, setIndisponivel] = useState('');
  const [enviando, setEnviando] = useState(false);
  const resultadoRef = useRef<HTMLDivElement>(null);

  const comparar = async (ta = a, tb = b) => {
    const novos: Record<string, string> = {};
    if (!ta.trim()) novos.texto_a = 'Escreva o primeiro texto.';
    if (!tb.trim()) novos.texto_b = 'Escreva o segundo texto.';
    setErros(novos);
    if (Object.keys(novos).length) return;
    setEnviando(true);
    setErroGeral('');
    setIndisponivel('');
    try {
      const r = await testarIA(ta, tb);
      setResultado(r);
      setTimeout(() => resultadoRef.current?.focus(), 0);
    } catch (e) {
      setResultado(null);
      if (e instanceof ApiError && e.status === 503) setIndisponivel(e.message);
      else if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErros(e.fieldErrors);
      else setErroGeral(e instanceof ApiError ? e.message : 'Não foi possível comparar os textos.');
    } finally {
      setEnviando(false);
    }
  };

  const usarExemplo = (ex: typeof EXEMPLOS[number]) => {
    setA(ex.a);
    setB(ex.b);
    comparar(ex.a, ex.b);
  };

  const comuns = new Set((resultado?.temas_em_comum ?? []).map(t => t.id));
  const campo = (valor: string, setValor: (v: string) => void, chave: 'texto_a' | 'texto_b', rotulo: string) => (
    <Campo rotulo={rotulo} flex="1 1 280px" contador={
      <span aria-live="polite" style={{ fontFamily: FONTE_TEXTO, fontSize: '12px', color: valor.length >= LIMITE ? C.danger : C.muted }}>
        {numeroBR(valor.length)}/{numeroBR(LIMITE)}
      </span>
    }>
      <textarea value={valor} maxLength={LIMITE} rows={4} onChange={e => setValor(e.target.value)} aria-invalid={!!erros[chave]}
        placeholder="Escreva como numa bio: interesses, rotina, o que gosta de fazer…"
        style={{ ...estiloCampo({ erro: !!erros[chave] }), resize: 'vertical', minHeight: '110px', lineHeight: 1.5 }} />
      {erros[chave] && <span role="alert" style={{ fontFamily: FONTE_TEXTO, fontSize: '12px', color: C.danger }}>{erros[chave]}</span>}
    </Campo>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Cartao titulo="Laboratório do ThoLuk">
        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: '0 0 12px' }}>Exemplos prontos:</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {EXEMPLOS.map(ex => (
            <Botao key={ex.rotulo} tamanho="mini" variante="secundario" onClick={() => usarExemplo(ex)} disabled={enviando}>{ex.rotulo}</Botao>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {campo(a, setA, 'texto_a', 'Texto A')}
          {campo(b, setB, 'texto_b', 'Texto B')}
        </div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Botao onClick={() => comparar()} disabled={enviando}>{enviando ? 'Comparando…' : 'Comparar com o ThoLuk'}</Botao>
          {erroGeral && <span role="alert" style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.danger }}>{erroGeral}</span>}
        </div>
        <p role="note" style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.text, margin: '16px 0 0', padding: '12px 14px', borderRadius: RAIO.campo, background: '#F2EEEA', lineHeight: 1.5 }}>
          O ThoLuk mede a afinidade de assunto/interesses; preferências opostas sobre o mesmo assunto (ex.: festas × silêncio) são tratadas pelos critérios de hábitos e rotina.
        </p>
      </Cartao>

      {indisponivel && <EstadoErro mensagem={indisponivel} onTentarNovamente={() => comparar()} />}

      {resultado && (
        <div ref={resultadoRef} tabIndex={-1} aria-label="Resultado da comparação" style={{ outline: 'none' }} data-testid="resultado-laboratorio">
          <Cartao titulo="Resultado" acao={<span style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted }}>processado em {numeroBR(resultado.tempo_ms, 1)} ms</span>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <Medidor rotulo="Similaridade (cosseno)" valor={resultado.similaridade} texto={numeroBR(resultado.similaridade, 2)}
                descricao="Quanto os dois textos falam das mesmas coisas, de -1 a 1 (frases sem relação ficam perto de 0,1 a 0,3)." />
              <Medidor rotulo="Afinidade calibrada" valor={resultado.afinidade} texto={`${numeroBR(Math.round(resultado.afinidade * 100))}%`} destaque
                descricao="O valor que entra no score (10% do total): cosseno 0,20 ou menos vira 0% e 0,65 ou mais vira 100%." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <TemasDoTexto rotulo="Temas do texto A" temas={resultado.temas_a} comuns={comuns} />
              <TemasDoTexto rotulo="Temas do texto B" temas={resultado.temas_b} comuns={comuns} />
            </div>
            <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.text, margin: '16px 0 0' }}>
              {resultado.temas_em_comum.length
                ? <>Temas em comum: <strong>{resultado.temas_em_comum.map(t => t.nome).join(', ')}</strong></>
                : 'Nenhum tema em comum.'}
            </p>
          </Cartao>
        </div>
      )}
    </div>
  );
}

// ─── c) Processamento paralelo ──────────────────────────────────────────────────

const COR_MODO: Record<ModoParalelo, string> = { sequencial: C.muted, threads: C.primary, processos: C.mintDark };
const ROTULO_MODO: Record<ModoParalelo, string> = { sequencial: 'Sequencial', threads: 'Threads', processos: 'Processos' };

function Paralelismo() {
  const [dados, setDados] = useState<BenchmarkParalelismo | null>(null);
  const [semBenchmark, setSemBenchmark] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [n, setN] = useState<number | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro('');
    setSemBenchmark(false);
    getBenchmarkParalelismo()
      .then(d => { setDados(d); setN(prev => prev ?? Math.max(...d.recalculo.map(x => x.N))); })
      .catch(e => {
        if (e instanceof ApiError && e.status === 404) setSemBenchmark(true);
        else setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar o benchmark.');
      })
      .finally(() => setCarregando(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const tamanhos = useMemo(() => Array.from(new Set((dados?.recalculo ?? []).map(x => x.N))).sort((x, y) => x - y), [dados]);

  if (carregando) return <EstadoCarregando texto="Carregando o benchmark…" />;
  if (semBenchmark) {
    return (
      <EstadoVazio
        titulo="O benchmark de paralelismo ainda não foi executado."
        descricao="No servidor, dentro de backend/, rode: python manage.py benchmark_paralelismo. Depois, volte a esta aba."
        acao={{ rotulo: 'Verificar de novo', onClick: carregar }}
      />
    );
  }
  if (erro || !dados) return <EstadoErro mensagem={erro || 'Benchmark indisponível.'} onTentarNovamente={carregar} />;

  const linhasN = dados.recalculo.filter(x => x.N === n);
  const seq = linhasN.find(x => x.modo === 'sequencial');
  const serie = (modo: ModoParalelo, campo: 'tempo_mediana_s' | 'speedup', marcador: 'circulo' | 'quadrado'): SerieWorkers => ({
    rotulo: ROTULO_MODO[modo], cor: COR_MODO[modo], marcador,
    pontos: linhasN.filter(x => x.modo === modo && x[campo] != null).map(x => ({ x: x.workers, y: x[campo] as number })).sort((p, q) => p.x - q.x),
  });
  const workers = Array.from(new Set(linhasN.filter(x => x.modo !== 'sequencial').map(x => x.workers))).sort((x, y) => x - y);
  const seriesTempo: SerieWorkers[] = [
    serie('threads', 'tempo_mediana_s', 'circulo'), serie('processos', 'tempo_mediana_s', 'quadrado'),
    ...(seq ? [{ rotulo: 'Sequencial', cor: C.muted, referencia: true, pontos: workers.map(w => ({ x: w, y: seq.tempo_mediana_s })) }] : []),
  ];
  const seriesSpeedup: SerieWorkers[] = [
    serie('threads', 'speedup', 'circulo'), serie('processos', 'speedup', 'quadrado'),
    { rotulo: 'Ideal', cor: C.borderStrong, referencia: true, pontos: workers.map(w => ({ x: w, y: w })) },
  ];
  const amdahl = dados.amdahl.filter(x => x.N === n);
  const amb = dados.ambiente;
  const pares = linhasN[0]?.pares ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Cartao titulo="Ambiente da medição">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '12px' }}>
          <Indicador rotulo="CPU" valor={<span style={{ fontSize: '14px' }}>{amb.cpu ?? '—'}</span>} />
          <Indicador rotulo="Núcleos" valor={`${amb.nucleos_fisicos ?? '—'} físicos · ${amb.nucleos_logicos ?? '—'} lógicos`} />
          <Indicador rotulo="Data" valor={<span style={{ fontSize: '15px' }}>{dataHoraBR(dados.gerado_em)}</span>}
            detalhe={`mediana de ${dados.parametros?.repeticoes ?? 3} repetições; blocos de ${dados.parametros?.bloco ?? '256 × 256 pares'}`} />
          <Indicador rotulo="CPU ocupada por outros programas" valor={amb.carga_cpu_fundo_pct != null || amb.carga_cpu_inicio_pct != null ? `${amb.carga_cpu_fundo_pct ?? amb.carga_cpu_inicio_pct}%` : '—'}
            detalhe="quanto maior, menor o ganho medido" />
        </div>
      </Cartao>

      <Cartao titulo="Recálculo das compatibilidades por número de workers">
        <div role="group" aria-label="Número de perfis" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', fontWeight: 700, color: C.muted }}>Perfis (N):</span>
          {tamanhos.map(t => <Chip key={t} ativo={t === n} onClick={() => setN(t)}>{numeroBR(t)}</Chip>)}
        </div>
        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: '0 0 12px' }}>
          {numeroBR(n ?? 0)} perfis = {numeroBR(pares)} pares calculados (metade buscando, metade oferecendo vaga).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }} data-testid="graficos-paralelismo">
          <GraficoWorkers titulo={`Tempo × workers com ${numeroBR(n ?? 0)} perfis`} rotuloY="tempo (s)" series={seriesTempo}
            formatarY={v => `${numeroBR(v, v < 1 ? 2 : 1)} s`} />
          <GraficoWorkers titulo={`Speedup × workers com ${numeroBR(n ?? 0)} perfis`} rotuloY="speedup (×)" series={seriesSpeedup}
            formatarY={v => `${numeroBR(v, 1)}×`} />
        </div>
        {amdahl.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '16px' }}>
            {amdahl.map(x => (
              <Indicador key={x.modo} rotulo={`Lei de Amdahl: ${ROTULO_MODO[x.modo].toLowerCase()}`}
                valor={`p = ${numeroBR(x.fracao_paralelizavel, 2)}`}
                detalhe={x.speedup_maximo_teorico ? `fração paralelizável; speedup máximo teórico ${numeroBR(x.speedup_maximo_teorico, 1)}×` : 'fração paralelizável'} />
            ))}
          </div>
        )}
      </Cartao>

      <Cartao titulo="Conclusão">
        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.text, margin: '0 0 12px', lineHeight: 1.6 }}>
          <strong>Lei de Amdahl:</strong> se só uma fração p do trabalho pode ser dividida entre n workers, o ganho máximo é
          1 / ((1 − p) + p / n). Criar processos, juntar os resultados e gravar no banco são a parte que não se divide.
        </p>
        <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {dados.observacoes.map(o => (
            <li key={o} style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.text, lineHeight: 1.5 }}>{o}</li>
          ))}
        </ul>
      </Cartao>

      <Cartao titulo="Tabela resumida">
        <CartaoTabela>
          <table style={ESTILO_TABELA}>
            <caption className="sr-only">Tempo, speedup e eficiência por número de perfis, modo e workers</caption>
            <thead>
              <tr>
                {['N', 'Modo', 'Workers', 'Tempo', 'Speedup', 'Eficiência'].map(h => <th key={h} scope="col" style={ESTILO_TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {dados.recalculo.map(x => (
                <tr key={`${x.N}-${x.modo}-${x.workers}`} style={x.N === n ? { background: C.primarySoft } : undefined}>
                  <td style={ESTILO_TD}>{numeroBR(x.N)}</td>
                  <td style={ESTILO_TD}>{ROTULO_MODO[x.modo]}</td>
                  <td style={ESTILO_TD}>{x.workers}</td>
                  <td style={ESTILO_TD}>{numeroBR(x.tempo_mediana_s, 3)} s</td>
                  <td style={{ ...ESTILO_TD, fontWeight: 700, color: (x.speedup ?? 0) > 1.05 ? C.mintText : (x.speedup ?? 1) < 0.95 ? C.danger : C.text }}>
                    {x.speedup != null ? `${numeroBR(x.speedup, 2)}×` : '—'}
                  </td>
                  <td style={ESTILO_TD}>{x.eficiencia != null ? numeroBR(x.eficiencia, 2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CartaoTabela>
      </Cartao>
    </div>
  );
}
