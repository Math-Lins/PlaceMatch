import { useState, useEffect, useCallback } from 'react';
import { listarRelatorios, getRelatorio, downloadRelatorioCSV, validarPeriodo, ApiError } from '../api';
import type { RelatorioItem, RelatorioResultado, AdminFiltros } from '../api';
import {
  C, FONTE_TITULO, FONTE_TEXTO, RAIO, Botao, Campo, CartaoTabela, EstadoCarregando, EstadoErro, EstadoVazio, MensagemErro,
  ESTILO_TABELA, ESTILO_TH, ESTILO_TD, ESTILO_ERRO_CAMPO, estiloCampo, dataHoraBR, descreverFiltros, rotuloChave, rotuloValor, numeroBR,
} from '../ui';

// ─── Filtros de cada relatório ─────────────────────────────────────────────────

const FILTRO_META: Record<string, { label: string; tipo: 'date' | 'text' | 'select' }> = {
  data_inicio: { label: 'Data inicial', tipo: 'date' },
  data_fim: { label: 'Data final', tipo: 'date' },
  regiao: { label: 'Região', tipo: 'text' },
  tipo: { label: 'Tipo', tipo: 'select' },
};

const TIPO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'buscando_vaga', label: 'Buscando vaga' },
  { value: 'oferecendo_vaga', label: 'Oferecendo vaga' },
];

const SECAO: React.CSSProperties = { background: C.card, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}` };
const TITULO_SECAO: React.CSSProperties = { fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 14px' };

function FilterInputs({
  filtroKeys,
  values,
  onChange,
}: {
  filtroKeys: string[];
  values: AdminFiltros;
  onChange: (key: string, val: string) => void;
}) {
  if (!filtroKeys.length) return null;
  const vals = values as Record<string, string | undefined>;
  const erroPeriodo = validarPeriodo(vals.data_inicio, vals.data_fim);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
        {filtroKeys.map(key => {
          const meta = FILTRO_META[key];
          if (!meta) return null;
          const rawVal = vals[key] ?? '';
          const erro = meta.tipo === 'date' && !!erroPeriodo;
          const est = estiloCampo({ compacto: true, erro });
          return (
            <Campo key={key} rotulo={meta.label} minWidth={meta.tipo === 'date' ? undefined : '170px'}>
              {meta.tipo === 'select' ? (
                <select value={rawVal} onChange={e => onChange(key, e.target.value)} style={est}>
                  {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  type={meta.tipo === 'date' ? 'date' : 'text'}
                  value={rawVal}
                  onChange={e => onChange(key, e.target.value)}
                  placeholder={meta.tipo === 'text' ? 'Ex: Boa Viagem' : undefined}
                  aria-invalid={erro}
                  style={est}
                />
              )}
            </Campo>
          );
        })}
      </div>
      {erroPeriodo && <span role="alert" style={{ ...ESTILO_ERRO_CAMPO, marginTop: '8px' }}>{erroPeriodo}</span>}
    </div>
  );
}

// ─── Tabela do resultado ────────────────────────────────────────────────────────

function ResultTable({ resultado }: { resultado: RelatorioResultado }) {
  const totaisObjeto = resultado.totais && !Array.isArray(resultado.totais) ? resultado.totais as Record<string, number> : null;
  return (
    <div>
      <div style={{ marginBottom: '14px', display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'baseline' }}>
        <span style={{ fontFamily: FONTE_TITULO, fontSize: '18px', fontWeight: 800, color: C.text }}>
          {resultado.titulo}
        </span>
        <span style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted }}>
          Gerado em {dataHoraBR(resultado.gerado_em)}
        </span>
        {Object.keys(resultado.filtros_aplicados).length > 0 && (
          <span style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted }}>
            Filtros: {descreverFiltros(resultado.filtros_aplicados as Record<string, unknown>)}
          </span>
        )}
      </div>

      {/* Totais (ex.: matches, mensagens) */}
      {totaisObjeto && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          {Object.entries(totaisObjeto).map(([k, v]) => (
            <div key={k} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: RAIO.campo, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '120px' }}>
              <span style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', fontWeight: 700, color: C.muted }}>{rotuloChave(k)}</span>
              <span style={{ fontFamily: FONTE_TITULO, fontSize: '20px', fontWeight: 800, color: C.text }}>
                {typeof v === 'number' ? numeroBR(v) : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      <CartaoTabela>
        <table style={ESTILO_TABELA}>
          <thead>
            <tr>{resultado.colunas.map(col => <th key={col} style={ESTILO_TH}>{col}</th>)}</tr>
          </thead>
          <tbody>
            {resultado.linhas.length === 0 ? (
              <tr>
                <td colSpan={resultado.colunas.length} style={{ ...ESTILO_TD, padding: '32px 12px', textAlign: 'center', color: C.muted }}>
                  Nenhum resultado para os filtros aplicados.
                </td>
              </tr>
            ) : (
              resultado.linhas.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ ...ESTILO_TD, whiteSpace: typeof cell === 'number' ? 'nowrap' : undefined }}>
                      {typeof cell === 'number' && /\(%\)/.test(resultado.colunas[ci] ?? '') ? numeroBR(cell, 2) : rotuloValor('', cell)}
                    </td>
                  ))}
                </tr>
              ))
            )}
            {Array.isArray(resultado.totais) && resultado.totais.length > 0 && (
              <tr style={{ background: C.primarySoft }}>
                {(resultado.totais as (string | number | null)[]).map((cell, ci) => (
                  <td key={ci} style={{ ...ESTILO_TD, fontFamily: FONTE_TITULO, fontWeight: 800 }}>
                    {rotuloValor('', cell)}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </CartaoTabela>
    </div>
  );
}

// ─── RelatoriosTab ────────────────────────────────────────────────────────────

export default function RelatoriosTab() {
  const [catalogo, setCatalogo] = useState<RelatorioItem[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(true);
  const [erroCatalogo, setErroCatalogo] = useState('');

  const [selectedId, setSelectedId] = useState<string>('');
  const [filtros, setFiltros] = useState<AdminFiltros>({});

  const [resultado, setResultado] = useState<RelatorioResultado | null>(null);
  const [loadingRel, setLoadingRel] = useState(false);
  const [erroRel, setErroRel] = useState('');
  const [exporting, setExporting] = useState(false);

  const carregarCatalogo = useCallback(() => {
    setLoadingCatalogo(true);
    setErroCatalogo('');
    listarRelatorios()
      .then(items => {
        setCatalogo(items);
        setLoadingCatalogo(false);
        if (items.length) setSelectedId(id => id || items[0].id);
      })
      .catch((e: Error) => {
        setErroCatalogo(e instanceof ApiError ? e.message : 'Não foi possível carregar a lista de relatórios.');
        setLoadingCatalogo(false);
      });
  }, []);

  useEffect(() => { carregarCatalogo(); }, [carregarCatalogo]);

  // Ao trocar de relatório, os filtros e o resultado anteriores deixam de valer.
  useEffect(() => { setFiltros({}); setResultado(null); setErroRel(''); }, [selectedId]);

  const selectedRel = catalogo.find(r => r.id === selectedId);

  const handleFiltroChange = (key: string, val: string) => {
    setFiltros(prev => ({ ...prev, [key]: val || undefined }));
  };

  const handleGerar = () => {
    if (!selectedId || validarPeriodo(filtros.data_inicio, filtros.data_fim)) return;
    setLoadingRel(true);
    setErroRel('');
    setResultado(null);
    getRelatorio(selectedId, filtros)
      .then(res => { setResultado(res); setLoadingRel(false); })
      .catch((e: Error) => {
        setErroRel(e instanceof ApiError ? e.message : 'Não foi possível gerar o relatório.');
        setLoadingRel(false);
      });
  };

  const handleExport = async () => {
    if (!selectedId || validarPeriodo(filtros.data_inicio, filtros.data_fim)) return;
    setExporting(true);
    try {
      await downloadRelatorioCSV(selectedId, filtros);
    } catch (e) {
      setErroRel(e instanceof Error ? e.message : 'Não foi possível exportar o CSV.');
    } finally {
      setExporting(false);
    }
  };

  if (loadingCatalogo) return <EstadoCarregando texto="Carregando relatórios…" />;
  if (erroCatalogo) return <EstadoErro mensagem={erroCatalogo} onTentarNovamente={carregarCatalogo} />;
  if (!catalogo.length) return <EstadoVazio titulo="Nenhum relatório disponível." />;

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Escolha do relatório */}
      <div style={SECAO}>
        <h3 style={TITULO_SECAO}>Selecionar relatório</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          {catalogo.map(rel => {
            const ativo = selectedId === rel.id;
            return (
              <label
                key={rel.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer',
                  padding: '12px 14px', borderRadius: RAIO.campo,
                  border: `2px solid ${ativo ? C.primary : C.border}`,
                  background: ativo ? C.primarySoft : C.card,
                }}
              >
                <input
                  type="radio" name="relatorio" value={rel.id}
                  checked={ativo}
                  onChange={() => setSelectedId(rel.id)}
                  style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: C.primaryDark }}
                />
                <span>
                  <span style={{ display: 'block', fontFamily: FONTE_TITULO, fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 2px' }}>
                    {rel.titulo}
                  </span>
                  <span style={{ display: 'block', fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted, lineHeight: 1.4 }}>
                    {rel.descricao}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Filtros do relatório escolhido */}
      {selectedRel && selectedRel.filtros.length > 0 && (
        <div style={SECAO}>
          <h3 style={TITULO_SECAO}>Filtros</h3>
          <FilterInputs filtroKeys={selectedRel.filtros} values={filtros} onChange={handleFiltroChange} />
        </div>
      )}

      {/* Ações */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Botao onClick={handleGerar} disabled={!selectedId || loadingRel}>
          {loadingRel ? 'Gerando…' : 'Gerar relatório'}
        </Botao>
        {resultado && (
          <Botao variante="neutro" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </Botao>
        )}
      </div>

      {erroRel && <MensagemErro>{erroRel}</MensagemErro>}

      {loadingRel && <EstadoCarregando texto="Gerando relatório…" />}

      {!loadingRel && resultado && (
        <div style={SECAO}>
          <ResultTable resultado={resultado} />
        </div>
      )}
    </div>
  );
}
