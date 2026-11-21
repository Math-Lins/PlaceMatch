// Padrão visual único do PlaceMatch: cores, medidas, componentes básicos e formatação pt-BR.
// Telas do usuário e painel admin importam daqui (nada de cores ou botões "soltos").
import React from 'react';

// ─── Cores ──────────────────────────────────────────────────────────────────────
// Coral e mint são as cores da marca. Para TEXTO usam-se os tons escuros, que passam no
// contraste mínimo de 4,5:1 (WCAG AA); os tons puros ficam para ícones, bordas e barras.
export const C = {
  primary: '#E06B45',      // coral da marca (ícones, bordas, barras, gradiente)
  primaryLight: '#F0896A',
  primaryDark: '#C4512E',  // fundo de botão/selo com texto branco (4,6:1)
  primaryText: '#B8482A',  // texto coral sobre fundo claro (≥ 4,7:1)
  primarySoft: '#FFF0EB',  // fundo de selo/chip coral
  mint: '#5DBF96',         // mint da marca (decorativo)
  mintLight: '#80D4B0',
  mintDark: '#3EA87A',
  mintText: '#2B7A57',     // texto mint sobre fundo claro (≥ 4,7:1)
  mintSoft: '#E6F7F0',     // fundo de selo/chip mint
  bg: '#FBF8F5',
  card: '#FFFFFF',
  text: '#2A2420',
  muted: '#6F645E',        // texto secundário (5,4:1 sobre o fundo)
  border: '#EDE8E3',
  borderStrong: '#D9D1CA', // borda de campo (bem visível sobre o branco)
  danger: '#C93C3C',       // destrutivo / erro (5,0:1)
  dangerSoft: '#FCEDED',
};

export const FONTE_TITULO = 'Outfit,sans-serif';
export const FONTE_TEXTO = 'Nunito,sans-serif';

export const RAIO = { campo: '12px', botao: '14px', card: '20px', modal: '24px', selo: '999px' };
export const SOMBRA = {
  card: '0 8px 28px rgba(42,36,32,0.10)',
  menu: '0 8px 24px rgba(42,36,32,0.14)',
  modal: '0 16px 48px rgba(42,36,32,0.22)',
};
export const TAM_TITULO = { tela: '24px', modal: '20px', secao: '16px' };

// ─── Tipografia ─────────────────────────────────────────────────────────────────

export const ESTILO_TITULO_TELA: React.CSSProperties = { fontFamily: FONTE_TITULO, fontSize: TAM_TITULO.tela, fontWeight: 800, color: C.text, margin: 0 };
export const ESTILO_TITULO_MODAL: React.CSSProperties = { fontFamily: FONTE_TITULO, fontSize: TAM_TITULO.modal, fontWeight: 800, color: C.text, margin: 0 };
export const ESTILO_TITULO_SECAO: React.CSSProperties = { fontFamily: FONTE_TITULO, fontSize: TAM_TITULO.secao, fontWeight: 700, color: C.text, margin: '0 0 14px' };
export const ESTILO_ROTULO: React.CSSProperties = { fontFamily: FONTE_TEXTO, fontSize: '13px', fontWeight: 700, color: C.muted };
export const ESTILO_ERRO_CAMPO: React.CSSProperties = { fontFamily: FONTE_TEXTO, fontSize: '12px', color: C.danger, display: 'block', marginTop: '4px' };

// ─── Campos ─────────────────────────────────────────────────────────────────────

/** Estilo de campo (input, select, textarea). `compacto` = barras de filtro do admin. */
export function estiloCampo(opts: { erro?: boolean; compacto?: boolean; fundo?: string } = {}): React.CSSProperties {
  return {
    padding: opts.compacto ? '9px 12px' : '13px 16px',
    minHeight: opts.compacto ? '40px' : '48px',
    borderRadius: RAIO.campo,
    border: `1.5px solid ${opts.erro ? C.danger : C.borderStrong}`,
    background: opts.fundo ?? C.card,
    fontFamily: FONTE_TEXTO,
    fontSize: opts.compacto ? '14px' : '15px',
    color: C.text,
    boxSizing: 'border-box',
    minWidth: 0,
  };
}

/** Rótulo + campo empilhados (filtros do admin e modais). */
export function Campo({ rotulo, children, minWidth, flex, contador }: {
  rotulo: string; children: React.ReactNode; minWidth?: string; flex?: string; contador?: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth, flex }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <span style={ESTILO_ROTULO}>{rotulo}</span>
        {contador}
      </span>
      {children}
    </label>
  );
}

// ─── Botões ─────────────────────────────────────────────────────────────────────

export type VarianteBotao = 'primario' | 'secundario' | 'destrutivo' | 'destrutivoContorno' | 'neutro' | 'texto';
export type TamanhoBotao = 'normal' | 'compacto' | 'mini';

const VARIANTES: Record<VarianteBotao, React.CSSProperties> = {
  primario: { background: C.primaryDark, color: '#fff', border: `2px solid ${C.primaryDark}` },
  secundario: { background: C.card, color: C.primaryText, border: `2px solid ${C.primary}` },
  destrutivo: { background: C.danger, color: '#fff', border: `2px solid ${C.danger}` },
  destrutivoContorno: { background: C.card, color: C.danger, border: `2px solid ${C.danger}` },
  neutro: { background: C.card, color: C.text, border: `2px solid ${C.borderStrong}` },
  texto: { background: 'transparent', color: C.muted, border: '2px solid transparent' },
};

const TAMANHOS: Record<TamanhoBotao, React.CSSProperties> = {
  normal: { padding: '12px 20px', minHeight: '48px', fontSize: '16px' },
  compacto: { padding: '8px 16px', minHeight: '40px', fontSize: '14px' },
  mini: { padding: '6px 12px', minHeight: '36px', fontSize: '13px' },
};

export function Botao({ children, onClick, variante = 'primario', tamanho = 'normal', disabled = false, larguraTotal = false, ariaLabel, title, style, type = 'button' }: {
  children: React.ReactNode; onClick?: () => void; variante?: VarianteBotao; tamanho?: TamanhoBotao;
  disabled?: boolean; larguraTotal?: boolean; ariaLabel?: string; title?: string; style?: React.CSSProperties; type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className="pm-botao"
      style={{
        ...VARIANTES[variante], ...TAMANHOS[tamanho],
        width: larguraTotal ? '100%' : undefined,
        borderRadius: RAIO.botao, fontFamily: FONTE_TITULO, fontWeight: 700, lineHeight: 1.2,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
        whiteSpace: 'nowrap', transition: 'opacity 0.15s, filter 0.15s', boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Botão só com ícone (fechar, voltar, menu): área de toque de 44 × 44 px. */
export function BotaoIcone({ children, onClick, ariaLabel, cor = C.muted, fundo = 'transparent', disabled = false, style }: {
  children: React.ReactNode; onClick?: () => void; ariaLabel: string; cor?: string; fundo?: string; disabled?: boolean; style?: React.CSSProperties;
}) {
  return (
    <button
      type="button" onClick={disabled ? undefined : onClick} aria-label={ariaLabel} disabled={disabled}
      style={{
        width: '44px', height: '44px', minWidth: '44px', borderRadius: RAIO.campo, border: 'none',
        background: fundo, color: cor, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, ...style,
      }}
    >
      {children}
    </button>
  );
}

export function IconeFechar({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconeVoltar({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

// ─── Selos (badges) e chips ─────────────────────────────────────────────────────

export type TomSelo = 'coral' | 'mint' | 'neutro' | 'perigo';
const TONS: Record<TomSelo, { bg: string; cor: string }> = {
  coral: { bg: C.primarySoft, cor: C.primaryText },
  mint: { bg: C.mintSoft, cor: C.mintText },
  neutro: { bg: '#F2EEEA', cor: C.muted },
  perigo: { bg: C.dangerSoft, cor: C.danger },
};

export function Selo({ children, tom = 'neutro', grande = false, style }: { children: React.ReactNode; tom?: TomSelo; grande?: boolean; style?: React.CSSProperties }) {
  const t = TONS[tom];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: grande ? '5px 14px' : '3px 10px', borderRadius: RAIO.selo,
      background: t.bg, color: t.cor, fontFamily: FONTE_TEXTO,
      fontSize: grande ? '14px' : '12px', fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1.4, ...style,
    }}>{children}</span>
  );
}

/** Opção selecionável (pílula) usada em filtros e formulários. */
export function Chip({ ativo, onClick, children, ariaPressed = true }: { ativo: boolean; onClick: () => void; children: React.ReactNode; ariaPressed?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ariaPressed ? ativo : undefined} style={{
      padding: '8px 16px', minHeight: '40px', borderRadius: RAIO.selo, cursor: 'pointer',
      border: `2px solid ${ativo ? C.primary : C.border}`,
      background: ativo ? C.primarySoft : C.card,
      color: ativo ? C.primaryText : C.muted,
      fontFamily: FONTE_TEXTO, fontSize: '13px', fontWeight: 700,
    }}>{children}</button>
  );
}

// ─── Estados de lista: carregando, vazio e erro ─────────────────────────────────

export function EstadoCarregando({ texto = 'Carregando…', altura }: { texto?: string; altura?: string }) {
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '48px 24px', minHeight: altura }}>
      <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke={C.border} strokeWidth="3" />
        <path d="M22 12a10 10 0 00-10-10" stroke={C.primary} strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: 0 }}>{texto}</p>
    </div>
  );
}

export function EstadoVazio({ titulo, descricao, icone, acao, altura }: {
  titulo: string; descricao?: string; icone?: React.ReactNode; acao?: { rotulo: string; onClick: () => void }; altura?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '48px 24px', textAlign: 'center', minHeight: altura }}>
      {icone && (
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: C.primarySoft, color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
          {icone}
        </div>
      )}
      <p style={{ fontFamily: FONTE_TITULO, fontSize: '17px', fontWeight: 700, color: C.text, margin: 0 }}>{titulo}</p>
      {descricao && <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: 0, maxWidth: '320px', lineHeight: 1.5 }}>{descricao}</p>}
      {acao && <div style={{ marginTop: '8px' }}><Botao tamanho="compacto" onClick={acao.onClick}>{acao.rotulo}</Botao></div>}
    </div>
  );
}

export function EstadoErro({ mensagem, onTentarNovamente, altura }: { mensagem: string; onTentarNovamente?: () => void; altura?: string }) {
  return (
    <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '48px 24px', textAlign: 'center', minHeight: altura }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: C.dangerSoft, color: C.danger, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="7" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.6" />
        </svg>
      </div>
      <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.danger, margin: 0, maxWidth: '360px', lineHeight: 1.5 }}>{mensagem}</p>
      {onTentarNovamente && <Botao tamanho="compacto" variante="secundario" onClick={onTentarNovamente}>Tentar novamente</Botao>}
    </div>
  );
}

/** Mensagem de erro de formulário (abaixo dos campos). */
export function MensagemErro({ children }: { children: React.ReactNode }) {
  return <p role="alert" style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.danger, margin: '12px 0 0', textAlign: 'center' }}>{children}</p>;
}

// ─── Modal ──────────────────────────────────────────────────────────────────────

/** Moldura padrão de modal (fundo escurecido + cartão). `folha` = sobe da base no celular. */
export function Modal({ titulo, onFechar, children, larguraMax = '440px', folha = false, podeFechar = true, rotuloFechar = 'Fechar', ariaLabel, rodape }: {
  titulo: string; ariaLabel?: string; rodape?: React.ReactNode; onFechar: () => void; children: React.ReactNode; larguraMax?: string; folha?: boolean; podeFechar?: boolean; rotuloFechar?: string;
}) {
  const dialogoRef = React.useRef<HTMLDivElement>(null);

  // Foco: ao abrir, vai para o diálogo; ao fechar, volta para o elemento que o abriu.
  React.useEffect(() => {
    const abriuCom = document.activeElement as HTMLElement | null;
    dialogoRef.current?.focus({ preventScroll: true });
    return () => { if (abriuCom && document.contains(abriuCom)) abriuCom.focus({ preventScroll: true }); };
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && podeFechar) { onFechar(); return; }
      if (e.key !== 'Tab') return;
      // Prende o Tab dentro do diálogo (modal): quem usa o teclado não "sai" para a tela de trás.
      const dialogo = dialogoRef.current;
      if (!dialogo) return;
      const focaveis = Array.from(dialogo.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focaveis.length === 0) { e.preventDefault(); return; }
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;
      if (!dialogo.contains(ativo) || (ativo === dialogo && !e.shiftKey)) { e.preventDefault(); primeiro.focus(); }
      else if (e.shiftKey && (ativo === primeiro || ativo === dialogo)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && ativo === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onFechar, podeFechar]);
  return (
    <div
      ref={dialogoRef} tabIndex={-1}
      role="dialog" aria-modal="true" aria-label={ariaLabel ?? titulo}
      onClick={() => { if (podeFechar) onFechar(); }}
      className={folha ? 'items-end md:items-center md:p-4' : 'items-center'}
      style={{ position: 'fixed', inset: 0, background: 'rgba(42,36,32,0.5)', zIndex: 200, display: 'flex', justifyContent: 'center', padding: folha ? 0 : '16px', outline: 'none' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={folha ? 'rounded-t-[24px] md:rounded-[24px]' : undefined}
        style={{ background: C.card, width: '100%', maxWidth: larguraMax, maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: folha ? undefined : RAIO.modal, boxShadow: SOMBRA.modal, boxSizing: 'border-box', overflow: 'hidden' }}
      >
        <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexShrink: 0 }}>
          <h3 style={ESTILO_TITULO_MODAL}>{titulo}</h3>
          <BotaoIcone ariaLabel={rotuloFechar} onClick={onFechar} disabled={!podeFechar} style={{ marginRight: '-10px' }}><IconeFechar /></BotaoIcone>
        </div>
        <div style={{ padding: rodape ? '0 24px 8px' : '0 24px 24px', overflowY: 'auto', flex: '1 1 auto' }}>{children}</div>
        {rodape && <div style={{ padding: '16px 24px 24px', borderTop: `1px solid ${C.border}`, flexShrink: 0, background: C.card }}>{rodape}</div>}
      </div>
    </div>
  );
}

// ─── Formatação pt-BR ───────────────────────────────────────────────────────────

const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** "2026-11-16" ou ISO completo → "16/11/2026". */
export function dataBR(v: string | Date | null | undefined): string {
  if (!v) return '—';
  if (typeof v === 'string' && ISO_DATA.test(v)) {
    const [a, m, d] = v.split('-');
    return `${d}/${m}/${a}`;
  }
  const dt = typeof v === 'string' ? new Date(v) : v;
  if (isNaN(dt.getTime())) return String(v);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(dt);
}

/** ISO → "16/11/2026 14:32" (com segundos se pedido). */
export function dataHoraBR(v: string | null | undefined, segundos = false): string {
  if (!v) return '—';
  const dt = new Date(v);
  if (isNaN(dt.getTime())) return v;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    ...(segundos ? { second: '2-digit' } : {}),
  }).format(dt).replace(',', '');
}

/** "16/11" a partir de "2026-11-16". */
export function diaMesBR(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

export function numeroBR(v: number, casas?: number): string {
  return v.toLocaleString('pt-BR', casas === undefined ? undefined : { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** 1200 → "R$ 1.200"; 1200.5 → "R$ 1.200,50". */
export function moedaBR(v: number | string): string {
  const n = Number(v);
  if (isNaN(n)) return '—';
  const inteiro = Number.isInteger(n);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: inteiro ? 0 : 2, maximumFractionDigits: 2 }).replace(/ /g, ' ');
}

export function faixaMoedaBR(min: number | string, max: number | string): string {
  return Number(min) === Number(max) ? moedaBR(min) : `${moedaBR(min)} – ${moedaBR(max)}`;
}

/** 0.873 → "87,3%". */
export function percentualBR(fracao: number, casas = 1): string {
  return `${numeroBR(fracao * 100, casas)}%`;
}

export function rotuloMoradores(n: number): string {
  return `${n}${n >= 4 ? '+' : ''} pessoa${n > 1 ? 's' : ''}`;
}

/** Valor de célula vindo da API: datas ISO viram dd/mm/aaaa e números usam vírgula. */
export function celulaBR(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'number') return numeroBR(v);
  if (ISO_DATA.test(v)) return dataBR(v);
  if (ISO_DATA_HORA.test(v)) return dataHoraBR(v);
  return v;
}

// ─── Rótulos de valores internos (nunca mostrar "buscando_vaga" ao usuário) ─────

export const ROTULO_TIPO_USUARIO: Record<string, string> = {
  buscando_vaga: 'Buscando vaga',
  oferecendo_vaga: 'Oferecendo vaga',
  administrador: 'Administrador',
};

export const ROTULO_STATUS_DENUNCIA: Record<string, string> = {
  pendente: 'Pendente',
  resolvida: 'Procedente',
  descartada: 'Improcedente',
};

export const ROTULO_ENTIDADE: Record<string, string> = {
  usuario: 'Usuário', perfil: 'Perfil', match: 'Match', mensagem: 'Mensagem',
  denuncia: 'Denúncia', relatorio: 'Relatório', log: 'Log', ia: 'IA',
};

/** Rótulos de filtros e totais vindos da API (chaves internas → texto). */
export const ROTULO_CHAVE: Record<string, string> = {
  data_inicio: 'De', data_fim: 'Até', regiao: 'Região', tipo: 'Tipo', status: 'Status', motivo: 'Motivo',
  matches: 'Matches', mensagens: 'Mensagens', perfis: 'Perfis', compatibilidades: 'Compatibilidades',
  curtidas: 'Curtidas', recusas: 'Recusas', usuarios: 'Usuários', com_perfil: 'Com perfil',
  total: 'Total', pendentes: 'Pendentes', resolvidas: 'Procedentes', descartadas: 'Improcedentes',
  match_id: 'Match', score: 'Compatibilidade', tamanho: 'Tamanho (caracteres)', denunciado_id: 'Denunciado (ID)',
  novo_status: 'Nova situação', email: 'E-mail', campos: 'Campos alterados', relatorio: 'Relatório',
  filtros: 'Filtros', ip: 'IP', q: 'Busca', ativo: 'Situação', acao: 'Ação', usuario: 'Usuário', entidade: 'Entidade',
  page: 'Página', formato: 'Formato',
  caracteres_a: 'Caracteres do texto A', caracteres_b: 'Caracteres do texto B', ia_disponivel: 'IA disponível',
  afinidade: 'Afinidade', tempo_ms: 'Tempo (ms)',
};

const ROTULO_VALOR: Record<string, string> = {
  ...ROTULO_TIPO_USUARIO, ...ROTULO_STATUS_DENUNCIA,
  spam: 'Spam', ofensivo: 'Conteúdo ofensivo', falso: 'Perfil falso', outro: 'Outro',
  true: 'Sim', false: 'Não', csv: 'CSV', json: 'JSON',
};

export function rotuloChave(k: string): string {
  return ROTULO_CHAVE[k] ?? (k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '));
}

/** Valor de filtro/detalhe em texto legível (datas, tipos, status, listas e objetos). */
export function rotuloValor(chave: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (chave === 'score' && typeof v === 'number') return percentualBR(v);
  if (Array.isArray(v)) return v.map(x => rotuloValor('', x)).join(', ') || '—';
  if (typeof v === 'object') {
    const pares = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== '' && x !== null && x !== undefined);
    return pares.length ? pares.map(([k, x]) => `${rotuloChave(k)}: ${rotuloValor(k, x)}`).join(' · ') : '—';
  }
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  const s = String(v);
  if (ROTULO_VALOR[s]) return ROTULO_VALOR[s];
  if (typeof v === 'number') return numeroBR(v);
  return celulaBR(s);
}

/** {data_inicio: '2026-01-01', tipo: 'buscando_vaga'} → "De: 01/01/2026 · Tipo: Buscando vaga". */
export function descreverFiltros(f: Record<string, unknown>): string {
  return Object.entries(f)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${rotuloChave(k)}: ${rotuloValor(k, v)}`)
    .join(' · ');
}

// ─── Tabelas e filtros do painel admin ──────────────────────────────────────────

export const ESTILO_TABELA: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontFamily: FONTE_TEXTO, fontSize: '14px' };
export const ESTILO_TH: React.CSSProperties = { padding: '12px', textAlign: 'left', fontFamily: FONTE_TITULO, fontSize: '13px', fontWeight: 700, color: C.muted, whiteSpace: 'nowrap', background: C.bg, borderBottom: `2px solid ${C.border}` };
export const ESTILO_TD: React.CSSProperties = { padding: '12px', color: C.text, borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle' };

/** Moldura branca das tabelas (rolagem horizontal no celular). */
export function CartaoTabela({ children }: { children: React.ReactNode }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px', overflowX: 'auto' }}>{children}</div>;
}

/** Barra de filtros do admin (campos lado a lado, botões alinhados à base). */
export function BarraFiltros({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', alignItems: 'flex-end' }}>{children}</div>;
}

/** Par De/Até com a mensagem de período inválido logo abaixo. */
export function CamposPeriodo({ inicio, fim, onInicio, onFim, erro, rotuloInicio = 'De', rotuloFim = 'Até' }: {
  inicio: string; fim: string; onInicio: (v: string) => void; onFim: (v: string) => void; erro?: string; rotuloInicio?: string; rotuloFim?: string;
}) {
  const est = estiloCampo({ compacto: true, erro: !!erro });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Campo rotulo={rotuloInicio}><input type="date" value={inicio} onChange={e => onInicio(e.target.value)} aria-invalid={!!erro} style={est} /></Campo>
        <Campo rotulo={rotuloFim}><input type="date" value={fim} onChange={e => onFim(e.target.value)} aria-invalid={!!erro} style={est} /></Campo>
      </div>
      {erro && <span role="alert" style={{ ...ESTILO_ERRO_CAMPO, marginTop: 0 }}>{erro}</span>}
    </div>
  );
}

export function Paginacao({ pagina, totalPaginas, total, rotuloTotal, onPagina }: {
  pagina: number; totalPaginas: number; total: number; rotuloTotal: (n: number) => string; onPagina: (p: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', flexWrap: 'wrap', gap: '8px' }}>
      <span style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted }}>{rotuloTotal(total)}</span>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Botao variante="neutro" tamanho="mini" onClick={() => onPagina(Math.max(1, pagina - 1))} disabled={pagina <= 1}>← Anterior</Botao>
        <span style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.text }}>Página {pagina} de {Math.max(1, totalPaginas)}</span>
        <Botao variante="neutro" tamanho="mini" onClick={() => onPagina(Math.min(totalPaginas, pagina + 1))} disabled={pagina >= totalPaginas}>Próxima →</Botao>
      </div>
    </div>
  );
}
