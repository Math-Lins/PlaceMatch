import { useState, useEffect, useRef, useId } from 'react';
import {
  login as apiLogin,
  registrar as apiRegistrar,
  buscarMeuUsuario,
  listarPerfis,
  criarPerfil as apiCriarPerfil,
  atualizarPerfil as apiAtualizarPerfil,
  excluirPerfil as apiExcluirPerfil,
  sairDaConta,
  setOn401,
  ApiError,
  perfilIndisponivel,
  listarDescoberta,
  enviarCurtida,
  listarMatches,
  listarConversas,
  listarMensagens,
  enviarMensagem,
  criarDenuncia,
  solicitarRedefinicaoSenha,
  redefinirSenha,
} from './api';
import type { Perfil as PerfilAPI, PerfilPayload, PerfilDescoberto, PerfilBasico, MatchData, Conversa, MensagemAPI, DescobertaParams } from './api';
import AdminPanel from './admin/AdminPanel';
import {
  C, RAIO, SOMBRA, FONTE_TEXTO, FONTE_TITULO, ESTILO_TITULO_TELA, ESTILO_ROTULO, ESTILO_ERRO_CAMPO,
  Botao, BotaoIcone, IconeVoltar, IconeFechar, Selo, Chip, Modal, MensagemErro,
  EstadoCarregando, EstadoVazio, EstadoErro, estiloCampo,
  faixaMoedaBR, moedaBR, rotuloMoradores, dataBR,
} from './ui';
import capaInicio from './assets/capa-inicio.jpg';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Screen =
  | 'welcome'
  | 'login'
  | 'register'
  | 'esqueci-senha'
  | 'redefinir-senha'
  | 'profile-create'
  | 'discovery'
  | 'profile-detail'
  | 'match'
  | 'matches'
  | 'chat'
  | 'profile'
  | 'notifications'
  | 'admin';

type Tab = 'discovery' | 'notifications' | 'matches' | 'profile';

interface Profile {
  id: number;
  name: string;
  age: number;
  region: string;
  bio: string;
  compat: number;
  photo: string;
  tags: string[];
  budget: string;
  smoker: boolean;
  pets: boolean;
  organized: number;
  messy: number;
  horario: 'madrugador' | 'noturno' | 'flexivel';
  ruido: number;
  social: number;
  visitas: 'raramente' | 'as_vezes' | 'frequentemente';
  tipoImovel: 'apartamento' | 'casa' | 'republica' | 'indiferente';
  qtdMoradores: number;
  lastMsg?: string;
  lastTime?: string;
  // campos de anúncio (oferecendo_vaga)
  tipo?: 'buscando_vaga' | 'oferecendo_vaga';
  tituloAnuncio?: string;
  descricaoImovel?: string;
  fotosImovel?: string[];
  fotoPerfilUrl?: string;
  usuarioId?: number;
}

// ─── Dados ───────────────────────────────────────────

// Perfil "vazio": valor inicial neutro dos estados de tela (nunca mostra dados de pessoas).
const PERFIL_VAZIO: Profile = {
  id: 0, name: '', age: 0, region: '', bio: '', compat: 0, photo: '', tags: [], budget: '',
  smoker: false, pets: false, organized: 3, messy: 3, horario: 'flexivel', ruido: 3, social: 3,
  visitas: 'as_vezes', tipoImovel: 'indiferente', qtdMoradores: 2,
};

const HORARIO_LABEL: Record<string, string> = {
  madrugador: 'Madrugador(a)',
  noturno: 'Noturno(a)',
  flexivel: 'Horário flexível',
};

const VISITAS_LABEL: Record<string, string> = {
  raramente: 'Poucas visitas',
  as_vezes: 'Visitas ocasionais',
  frequentemente: 'Recebe visitas',
};

const IMOVEL_LABEL: Record<string, string> = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  republica: 'República',
  indiferente: 'Indiferente',
};

function buildTags(p: {
  fumante: boolean; aceita_pets: boolean; nivel_organizacao: number;
  tolerancia_bagunca: number; perfil_horario: string; nivel_social: number;
}): string[] {
  const tags: string[] = [];
  tags.push(p.fumante ? 'Fumante' : 'Não fumante');
  tags.push(p.aceita_pets ? 'Aceita pets' : 'Sem pets');
  if (p.nivel_organizacao >= 4) tags.push('Organizado(a)');
  else if (p.tolerancia_bagunca >= 4) tags.push('Descontraído(a)');
  tags.push(HORARIO_LABEL[p.perfil_horario] ?? p.perfil_horario);
  if (p.nivel_social >= 4) tags.push('Social');
  else if (p.nivel_social <= 2) tags.push('Reservado(a)');
  return tags;
}

/** Foto que representa a pessoa: a foto de perfil; sem ela, a primeira foto do imóvel. */
function fotoDaPessoa(p: { foto_perfil_url?: string | null; fotos_imovel?: string[] | null }): string {
  return p.foto_perfil_url || p.fotos_imovel?.[0] || '';
}

function perfilDescobertoParaProfile(p: PerfilDescoberto): Profile {
  const budget = faixaMoedaBR(p.orcamento_min, p.orcamento_max);
  return {
    id: p.id,
    name: p.nome,
    age: p.idade,
    region: p.regiao,
    bio: p.bio,
    compat: Math.round(p.score * 100),
    photo: fotoDaPessoa(p),
    tags: buildTags(p),
    budget,
    smoker: p.fumante,
    pets: p.aceita_pets,
    organized: p.nivel_organizacao,
    messy: p.tolerancia_bagunca,
    horario: p.perfil_horario,
    ruido: p.nivel_ruido,
    social: p.nivel_social,
    visitas: p.aceita_visitas,
    tipoImovel: p.tipo_imovel,
    qtdMoradores: p.qtd_moradores,
    tipo: p.tipo,
    tituloAnuncio: p.titulo_anuncio ?? undefined,
    descricaoImovel: p.descricao_imovel ?? undefined,
    fotosImovel: p.fotos_imovel,
    fotoPerfilUrl: p.foto_perfil_url ?? undefined,
    usuarioId: p.usuario_id,
  };
}

function perfilBasicoParaProfile(p: PerfilBasico | undefined, score: number): Profile {
  if (!p) return PERFIL_VAZIO;
  const budget = faixaMoedaBR(p.orcamento_min, p.orcamento_max);
  return {
    id: p.id,
    name: p.nome,
    age: p.idade,
    region: p.regiao,
    bio: p.bio,
    compat: Math.round(score * 100),
    photo: fotoDaPessoa(p),
    tags: buildTags(p),
    budget,
    smoker: p.fumante,
    pets: p.aceita_pets,
    organized: p.nivel_organizacao,
    messy: p.tolerancia_bagunca,
    horario: p.perfil_horario,
    ruido: p.nivel_ruido,
    social: p.nivel_social,
    visitas: p.aceita_visitas,
    tipoImovel: p.tipo_imovel,
    qtdMoradores: p.qtd_moradores,
    tipo: p.tipo,
    tituloAnuncio: p.titulo_anuncio ?? undefined,
    descricaoImovel: p.descricao_imovel ?? undefined,
    fotosImovel: p.fotos_imovel,
    fotoPerfilUrl: p.foto_perfil_url ?? undefined,
    usuarioId: p.usuario_id,
  };
}


// ─── Shared UI Components ─────────────────────────────────────────────────────
// Cores, botões, selos e estados vêm de ./ui (padrão único com o painel admin).

function Btn({ label, onClick, outline = false, danger = false, small = false, disabled = false, style: extraStyle, type = 'button' }: {
  label: string; onClick?: () => void; outline?: boolean; danger?: boolean; small?: boolean; disabled?: boolean; style?: React.CSSProperties; type?: 'button' | 'submit';
}) {
  const variante = danger ? (outline ? 'destrutivoContorno' : 'destrutivo') : outline ? 'secundario' : 'primario';
  return (
    <Botao variante={variante} tamanho={small ? 'compacto' : 'normal'} onClick={onClick} disabled={disabled} larguraTotal style={extraStyle} type={type}>
      {label}
    </Botao>
  );
}

function Input({ label, type = 'text', placeholder, value, onChange, error, maxLength, inputMode, id, autoComplete }: {
  label: string; type?: string; placeholder?: string; value?: string; onChange?: (v: string) => void; error?: string; maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; id?: string; autoComplete?: string;
}) {
  const erroId = useId();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={ESTILO_ROTULO}>{label}</span>
        {maxLength !== undefined && (
          <span style={{ fontSize: '12px', color: (value?.length ?? 0) >= maxLength ? C.danger : C.muted, fontFamily: FONTE_TEXTO }}>{value?.length ?? 0}/{maxLength}</span>
        )}
      </span>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? erroId : undefined}
        onChange={e => onChange?.(e.target.value)}
        style={estiloCampo({ erro: !!error })}
      />
      {error && <span id={erroId} style={{ ...ESTILO_ERRO_CAMPO, marginTop: 0 }}>{error}</span>}
    </label>
  );
}

function Tag({ label }: { label: string }) {
  const isMint = label.includes('Aceita') || label.includes('Organiz') || label.includes('Tranquil');
  return <Selo tom={isMint ? 'mint' : 'coral'}>{label}</Selo>;
}

// Faixas de compatibilidade: mesmas cores no selo, no medidor e nas listas.
// `color` = barras/bordas (decorativo); `texto` = cor de texto com contraste AA.
const COMPAT_LEVELS = [
  { min: 0,  max: 20,  label: 'Baixa compatibilidade',   color: '#B5ABA5',      texto: C.muted,       tom: 'neutro' as const },
  { min: 20, max: 40,  label: 'Compatibilidade regular', color: C.primaryLight, texto: C.primaryText, tom: 'coral' as const },
  { min: 40, max: 60,  label: 'Boa compatibilidade',     color: C.primary,      texto: C.primaryText, tom: 'coral' as const },
  { min: 60, max: 80,  label: 'Alta compatibilidade',    color: C.mint,         texto: C.mintText,    tom: 'mint' as const },
  { min: 80, max: 101, label: 'Combinação perfeita',     color: C.mintDark,     texto: C.mintText,    tom: 'mint' as const },
];

function getCompatLevel(value: number) {
  return COMPAT_LEVELS.find(l => value >= l.min && value < l.max) ?? COMPAT_LEVELS[4];
}

function CompatBadge({ value, large = false, sobreFoto = false }: { value: number; large?: boolean; sobreFoto?: boolean }) {
  const level = getCompatLevel(value);
  // Sobre foto o selo ganha fundo branco sólido para manter o contraste.
  return (
    <Selo tom={level.tom} grande={large} style={{ fontFamily: FONTE_TITULO, ...(sobreFoto ? { background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' } : {}) }}>
      ❤️ {value}% compatível
    </Selo>
  );
}

function ImagemComFallback({ src, alt, style, tipo = 'imovel', iniciais = '' }: {
  src?: string | null;
  alt: string;
  style?: React.CSSProperties;
  tipo?: 'imovel' | 'avatar';
  iniciais?: string;
}) {
  const [erro, setErro] = useState(false);
  useEffect(() => { setErro(false); }, [src]);
  const base: React.CSSProperties = {
    ...style,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    background: `linear-gradient(135deg, ${C.primary} 0%, ${C.mint} 100%)`,
    // A inicial acompanha o tamanho do espaço (avatar pequeno ou card inteiro).
    containerType: 'size',
  };
  if (!src || erro) {
    return tipo === 'avatar' ? (
      <div role="img" aria-label={alt} style={base}>
        <span aria-hidden="true" style={{ color: '#fff', fontFamily: FONTE_TITULO, fontWeight: 800, fontSize: 'max(11px, 38cqmin)', lineHeight: 1, textShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
          {(iniciais || alt.charAt(0) || '?').toUpperCase()}
        </span>
      </div>
    ) : (
      <div role="img" aria-label={alt} style={base}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22" fill="rgba(255,255,255,0)" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5"/>
        </svg>
      </div>
    );
  }
  return <img src={src} alt={alt} style={style} onError={() => setErro(true)} />;
}

function ScaleBar({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }} aria-hidden="true">
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          width: '32px', height: '6px', borderRadius: '3px',
          background: i <= value ? C.primary : C.border,
        }}/>
      ))}
    </div>
  );
}

/** Linha "rótulo — valor" dos cartões de detalhe (perfil, anúncio, Meu Perfil). */
function LinhaInfo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted }}>{label}</span>
      <span style={{ fontFamily: FONTE_TITULO, fontSize: '14px', fontWeight: 700, color: C.text, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

/** Escalas 1–5 de hábitos (detalhe do perfil e Meu Perfil). Ordem: organização, bagunça, barulho, social. */
function ListaHabitos({ valores }: { valores: number[] }) {
  const rotulos = ['Organização', 'Tolerância à bagunça', 'Tolerância a barulho', 'Perfil social'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {rotulos.map((label, i) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted }}>{label}</span>
            <span style={{ fontFamily: FONTE_TITULO, fontSize: '13px', fontWeight: 700, color: C.primaryText }}>{valores[i]}/5</span>
          </div>
          <ScaleBar value={valores[i]} />
        </div>
      ))}
    </div>
  );
}

/** Cartão branco com título (seções de detalhe e Meu Perfil). */
function CartaoSecao({ titulo, children, style }: { titulo: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.card, borderRadius: RAIO.card, padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}`, ...style }}>
      <h3 style={{ fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 14px' }}>{titulo}</h3>
      {children}
    </div>
  );
}

/** "1 mensagem não lida" / "3 mensagens não lidas" (texto para leitores de tela). */
function textoNaoLidas(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Contador sobre ícone (notificações, filtros ativos, mensagens não lidas).
 * O número visível é decorativo; `rotulo` é o texto lido pelos leitores de tela
 * (o `id` permite ligá-lo ao botão com aria-describedby).
 */
function Contador({ n, style, rotulo, id }: { n: number; style?: React.CSSProperties; rotulo?: string; id?: string }) {
  return (
    <>
      <span aria-hidden="true" style={{
        background: C.primaryDark, color: '#fff', borderRadius: '10px',
        padding: '0 5px', fontSize: '11px', fontWeight: 800,
        fontFamily: FONTE_TITULO, lineHeight: '16px',
        minWidth: '16px', textAlign: 'center', display: 'inline-block', ...style,
      }}>
        {n > 9 ? '9+' : n}
      </span>
      {rotulo && <span id={id} className="sr-only">{rotulo}</span>}
    </>
  );
}

/** Contador do item "Notificações" do menu; o nome do botão continua "Notificações" e a quantidade vira a descrição. */
function ContadorNotificacoes({ n, id }: { n: number; id: string }) {
  return <Contador n={n} id={id} rotulo={textoNaoLidas(n, 'notificação não lida', 'notificações não lidas')} style={{ position: 'absolute', top: '-6px', right: '-9px' }} />;
}

/** Chip de filtro aplicado, com botão de remover (área de toque de 32 px). */
function ChipFiltro({ rotulo, onRemover }: { rotulo: string; onRemover: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '0 0 0 12px', borderRadius: RAIO.selo, background: C.primarySoft, fontFamily: FONTE_TEXTO, fontSize: '13px', fontWeight: 700, color: C.primaryText }}>
      {rotulo}
      <button type="button" onClick={onRemover} aria-label={`Remover filtro ${rotulo}`} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', color: C.primaryText, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
        <IconeFechar tamanho={14} />
      </button>
    </span>
  );
}

// ─── Bottom Navigation ─────────────────────────────────────────────────────────

function BottomNav({ tab, setTab, notifsCount }: { tab: Tab; setTab: (t: Tab) => void; notifsCount: number }) {
  const ID_CONTADOR = 'contador-notificacoes-inferior';
  const items: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    {
      id: 'discovery', label: 'Descoberta',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
      ),
    },
    {
      id: 'notifications', label: 'Notificações',
      icon: (a) => (
        <div style={{ position: 'relative', width: '22px', height: '22px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          {notifsCount > 0 && <ContadorNotificacoes n={notifsCount} id={ID_CONTADOR} />}
        </div>
      ),
    },
    {
      id: 'matches', label: 'Matches',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      ),
    },
    {
      id: 'profile', label: 'Perfil',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ];
  return (
    <div style={{
      background: C.card, borderTop: `1px solid ${C.border}`,
      display: 'flex', zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {items.map(item => (
        <button key={item.id} onClick={() => setTab(item.id)} aria-label={item.label} aria-current={tab === item.id ? 'page' : undefined}
          aria-describedby={item.id === 'notifications' && notifsCount > 0 ? ID_CONTADOR : undefined} style={{
          flex: 1, padding: '10px 0 8px', minHeight: '56px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer',
        }}>
          {item.icon(tab === item.id)}
          <span style={{ fontSize: '11px', fontWeight: 700, color: tab === item.id ? C.primaryText : C.muted, fontFamily: FONTE_TEXTO }}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

function AppShell({ screen, tab, setTab, nav, onLogout, notifsCount, children }: {
  screen: Screen;
  tab: Tab;
  setTab: (t: Tab) => void;
  nav: (s: Screen) => void;
  onLogout: () => void;
  notifsCount: number;
  children: React.ReactNode;
}) {
  const isInternal = ['discovery', 'profile-detail', 'match', 'matches', 'chat', 'profile', 'notifications'].includes(screen);
  const isTabScreen = ['discovery', 'matches', 'profile', 'notifications'].includes(screen);

  if (!isInternal) return <>{children}</>;

  const handleTabChange = (t: Tab) => { setTab(t); nav(t as Screen); };
  const ID_CONTADOR = 'contador-notificacoes-lateral';

  const sideItems: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    {
      id: 'discovery', label: 'Descoberta',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
      ),
    },
    {
      id: 'notifications', label: 'Notificações',
      icon: (a) => (
        <div style={{ position: 'relative', width: '22px', height: '22px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          {notifsCount > 0 && <ContadorNotificacoes n={notifsCount} id={ID_CONTADOR} />}
        </div>
      ),
    },
    {
      id: 'matches', label: 'Matches',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      ),
    },
    {
      id: 'profile', label: 'Perfil',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="flex min-h-dvh bg-bg">
      {/* Sidebar — visível apenas em lg */}
      <aside
        className="hidden lg:flex flex-col bg-card border-r border-border"
        style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: '260px', zIndex: 40 }}
      >
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
                <path d="M18 6 L6 14 L6 28 L14 28 L14 20 L22 20 L22 28 L30 28 L30 14 Z" fill="white" opacity="0.9"/>
                <circle cx="24" cy="12" r="5" fill="white"/>
                <path d="M20 11 C20 8.8 22 7 24 7 C26 7 28 8.8 28 11 C28 14 24 17 24 17 C24 17 20 14 20 11Z" fill={C.primary}/>
              </svg>
            </div>
            <span style={{ fontFamily: FONTE_TITULO, fontSize: '18px', fontWeight: 800, color: C.text }}>PlaceMatch</span>
          </div>
        </div>

        {/* Itens de navegação */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
          {sideItems.map(item => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                aria-describedby={item.id === 'notifications' && notifsCount > 0 ? ID_CONTADOR : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', minHeight: '48px', borderRadius: RAIO.botao, cursor: 'pointer',
                  border: 'none', width: '100%', textAlign: 'left',
                  background: active ? C.primarySoft : 'transparent',
                  color: active ? C.primaryText : C.muted,
                  fontFamily: FONTE_TITULO, fontSize: '15px', fontWeight: 700,
                }}
              >
                {item.icon(active)}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Sair */}
        <div style={{ padding: '16px 12px 24px', borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={onLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', minHeight: '48px', borderRadius: RAIO.botao, cursor: 'pointer',
              border: 'none', width: '100%', textAlign: 'left',
              background: 'transparent', color: C.muted,
              fontFamily: FONTE_TITULO, fontSize: '15px', fontWeight: 700,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Área principal — offset da sidebar em lg */}
      <div className="flex-1 flex flex-col lg:ml-[260px] min-w-0">
        {children}
      </div>

      {/* BottomNav — mobile/tablet, apenas nas 3 telas de aba */}
      {isTabScreen && (
        <div
          className="lg:hidden"
          style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 }}
        >
          <BottomNav tab={tab} setTab={handleTabChange} notifsCount={notifsCount} />
        </div>
      )}
    </div>
  );
}

// ─── Brand Panel (painel de marca compartilhado nas telas pré-login) ─────────

function BrandPanel() {
  return (
    <div
      className="hidden lg:flex flex-col justify-center items-center lg:w-[480px] flex-shrink-0 p-12"
      style={{ background: `linear-gradient(160deg, ${C.primaryDark} 0%, ${C.primary} 55%, ${C.mint} 100%)` }}
    >
      <div style={{ color: '#fff', textAlign: 'center', maxWidth: '380px', width: '100%' }}>
        <div style={{ width: '72px', height: '72px', background: 'rgba(255,255,255,0.2)', borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', backdropFilter: 'blur(10px)' }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M18 6 L6 14 L6 28 L14 28 L14 20 L22 20 L22 28 L30 28 L30 14 Z" fill="white" opacity="0.9"/>
            <circle cx="24" cy="12" r="5" fill="white"/>
            <path d="M20 11 C20 8.8 22 7 24 7 C26 7 28 8.8 28 11 C28 14 24 17 24 17 C24 17 20 14 20 11Z" fill="rgba(255,255,255,0.6)"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: FONTE_TITULO, fontSize: '40px', fontWeight: 800, margin: '0 0 8px', letterSpacing: '-1px' }}>PlaceMatch</h1>
        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.85, margin: '0 0 28px' }}>Seu lar, sua turma</p>
        <div style={{ borderRadius: '24px', overflow: 'hidden', height: '260px', marginBottom: '24px' }}>
          <img
            src={capaInicio}
            alt="Pessoas convivendo em apartamento aconchegante"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <p style={{ fontFamily: FONTE_TITULO, fontSize: '20px', fontWeight: 700, lineHeight: 1.4, textShadow: '0 1px 6px rgba(42,36,32,0.45)' }}>
          Encontre quem combina com seu jeito de morar
        </p>
      </div>
    </div>
  );
}

// ─── Screen: Welcome ──────────────────────────────────────────────────────────

function WelcomeScreen({ nav }: { nav: (s: Screen) => void }) {
  return (
    <div className="flex min-h-dvh bg-bg">
      <BrandPanel />

      {/* Painel de CTA */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Mobile / tablet: logo + foto */}
        <div className="lg:hidden flex flex-col items-center w-full max-w-sm mb-8">
          <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '72px', height: '72px', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`, borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(224,107,69,0.35)' }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M18 6 L6 14 L6 28 L14 28 L14 20 L22 20 L22 28 L30 28 L30 14 Z" fill="white" opacity="0.9"/>
                <circle cx="24" cy="12" r="5" fill="white"/>
                <path d="M20 11 C20 8.8 22 7 24 7 C26 7 28 8.8 28 11 C28 14 24 17 24 17 C24 17 20 14 20 11Z" fill="#E06B45"/>
              </svg>
            </div>
            <h1 style={{ fontFamily: FONTE_TITULO, fontSize: '32px', fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.5px' }}>PlaceMatch</h1>
            <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', fontWeight: 700, color: C.primaryText, margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>Seu lar, sua turma</p>
          </div>
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{ borderRadius: '28px', overflow: 'hidden', height: '240px', position: 'relative' }}>
              <img
                src={capaInicio}
                alt="Pessoas convivendo em apartamento aconchegante"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.5) 0%, transparent 60%)' }}/>
            </div>
            <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
              <p style={{ fontFamily: FONTE_TITULO, fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.3 }}>
                Encontre quem combina com seu jeito de morar
              </p>
            </div>
          </div>
        </div>

        {/* Desktop: título acima dos botões */}
        <div className="hidden lg:block mb-8 text-center">
          <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 8px' }}>Boas-vindas!</h2>
          <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.muted, margin: 0 }}>Entre ou crie sua conta para começar.</p>
        </div>

        <div className="w-full max-w-sm" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Btn label="Entrar" onClick={() => nav('login')} />
          <Btn label="Criar conta" onClick={() => nav('register')} outline />
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Login ─────────────────────────────────────────────────────────────

function LoginScreen({ nav, onLoginSuccess, loginMsg }: { nav: (s: Screen) => void; onLoginSuccess: () => Promise<void>; loginMsg?: string }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleEntrar = async () => {
    setErro('');
    const erros: Record<string, string> = {};
    if (!email.trim()) erros.email = 'Informe seu e-mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) erros.email = 'Informe um e-mail válido.';
    if (!senha) erros.senha = 'Informe sua senha.';
    setFieldErrors(erros);
    if (Object.keys(erros).length > 0) return;

    setLoading(true);
    try {
      await apiLogin(email.trim(), senha);
      await onLoginSuccess();
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setFieldErrors(e.fieldErrors);
        setErro(e.message);
      } else {
        setErro(e instanceof Error ? e.message : 'E-mail ou senha incorretos.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-bg">
      <BrandPanel />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <button onClick={() => nav('welcome')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px 8px 0', minHeight: '44px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: C.muted }}>
            <IconeVoltar />
            <span style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', fontWeight: 700 }}>Voltar</span>
          </button>

          {loginMsg && (
            <div role="alert" style={{ background: C.dangerSoft, border: `1px solid ${C.danger}40`, borderRadius: RAIO.campo, padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.danger, margin: 0 }}>{loginMsg}</p>
            </div>
          )}
          <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Boas-vindas de volta!</h2>
          <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.muted, margin: '0 0 32px' }}>Entre com sua conta para continuar.</p>

          {/* <form>: Enter em qualquer campo envia (teclado); noValidate mantém as mensagens em português. */}
          <form noValidate onSubmit={e => { e.preventDefault(); handleEntrar(); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={setEmail} error={fieldErrors.email} autoComplete="username" />
            <Input label="Senha" type="password" placeholder="••••••••" value={senha} onChange={setSenha} error={fieldErrors.senha} autoComplete="current-password" />
          </div>
          <div style={{ textAlign: 'right', marginTop: '4px' }}>
            <button type="button" onClick={() => nav('esqueci-senha')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primaryText, fontWeight: 700, fontSize: '14px', fontFamily: FONTE_TEXTO, padding: '12px 0 12px 8px', minHeight: '44px' }}>
              Esqueci minha senha
            </button>
          </div>

          {erro && (
            <div role="alert" style={{ background: C.dangerSoft, border: `1px solid ${C.danger}40`, borderRadius: RAIO.campo, padding: '12px 16px', marginTop: '16px' }}>
              <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', fontWeight: 700, color: C.danger, margin: 0 }}>{erro}</p>
            </div>
          )}

          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Btn label={loading ? 'Entrando…' : 'Entrar'} type="submit" disabled={loading} />
          </div>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted }}>
            Ainda não tem uma conta?{' '}
            <button onClick={() => nav('register')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primaryText, fontWeight: 700, fontSize: '14px', fontFamily: FONTE_TEXTO, padding: '12px 4px', minHeight: '44px' }}>
              Criar conta
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Esqueci minha senha ──────────────────────────────────────────────

function EsqueciSenhaScreen({ nav }: { nav: (s: Screen) => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // Foco: ao abrir a confirmação, o título recebe o foco (leitores de tela leem a mensagem).
  useEffect(() => { if (enviado) tituloRef.current?.focus(); }, [enviado]);

  const handleEnviar = async () => {
    if (loading) return; // sem duplo clique / duplo Enter
    setErro('');
    const erros: Record<string, string> = {};
    if (!email.trim()) erros.email = 'Informe seu e-mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) erros.email = 'Informe um e-mail válido.';
    setFieldErrors(erros);
    if (Object.keys(erros).length > 0) return;

    setLoading(true);
    try {
      await solicitarRedefinicaoSenha(email.trim());
      setEnviado(true);
    } catch (e: unknown) {
      if (e instanceof ApiError) { setFieldErrors(e.fieldErrors); setErro(e.message); }
      else setErro('Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-bg">
      <BrandPanel />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <button onClick={() => nav('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px 8px 0', minHeight: '44px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: C.muted }}>
            <IconeVoltar />
            <span style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', fontWeight: 700 }}>Voltar</span>
          </button>

          {enviado ? (
            <div role="status">
              <h2 ref={tituloRef} tabIndex={-1} style={{ fontFamily: FONTE_TITULO, fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 12px', outline: 'none' }}>Confira seu e-mail</h2>
              <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.text, margin: '0 0 12px', lineHeight: 1.5 }}>
                Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.
              </p>
              <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: '0 0 28px', lineHeight: 1.5 }}>
                O link vale por 1 hora. Não chegou? Veja a caixa de spam ou peça outro link.
              </p>
              <Btn label="Voltar para o login" onClick={() => nav('login')} />
            </div>
          ) : (
            <>
              <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Esqueci minha senha</h2>
              <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.muted, margin: '0 0 28px' }}>Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
              <form noValidate onSubmit={e => { e.preventDefault(); handleEnviar(); }}>
                <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={setEmail} error={fieldErrors.email} autoComplete="username" />
                {erro && <MensagemErro>{erro}</MensagemErro>}
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Btn label={loading ? 'Enviando…' : 'Enviar link'} type="submit" disabled={loading} />
                  <Btn label="Voltar para o login" outline onClick={() => nav('login')} />
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Nova senha (link do e-mail) ──────────────────────────────────────

function RedefinirSenhaScreen({ nav, uid, token, onSenhaRedefinida }: {
  nav: (s: Screen) => void; uid: string; token: string; onSenhaRedefinida: () => void;
}) {
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [concluido, setConcluido] = useState(false);
  // Sem uid/token na URL, ou recusado pela API (inválido, expirado, já usado): tela de link inválido.
  const [linkInvalido, setLinkInvalido] = useState(!uid || !token);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (concluido || linkInvalido) tituloRef.current?.focus(); }, [concluido, linkInvalido]);

  const handleSalvar = async () => {
    if (loading) return;
    setErro('');
    const erros: Record<string, string> = {};
    if (!senha) erros.nova_senha = 'Informe uma senha.';
    else if (senha.length < 8) erros.nova_senha = 'A senha deve ter no mínimo 8 caracteres.';
    if (senha && confirmar && senha !== confirmar) erros.confirmar = 'As senhas não coincidem.';
    else if (senha && !confirmar) erros.confirmar = 'Repita a nova senha.';
    setFieldErrors(erros);
    if (Object.keys(erros).length > 0) return;

    setLoading(true);
    try {
      await redefinirSenha(uid, token, senha);
      onSenhaRedefinida();
      setConcluido(true);
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        if (e.fieldErrors.nova_senha) setFieldErrors({ nova_senha: e.fieldErrors.nova_senha });
        else if (e.status === 400) setLinkInvalido(true);
        else setErro(e.message);
      } else {
        setErro('Não foi possível redefinir a senha. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const titulo = (texto: string) => (
    <h2 ref={tituloRef} tabIndex={-1} style={{ fontFamily: FONTE_TITULO, fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 12px', outline: 'none' }}>{texto}</h2>
  );

  return (
    <div className="flex min-h-dvh bg-bg">
      <BrandPanel />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {concluido ? (
            <div role="status">
              {titulo('Senha redefinida!')}
              <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.text, margin: '0 0 28px', lineHeight: 1.5 }}>
                Sua senha foi alterada e as sessões abertas foram encerradas. Entre com a nova senha.
              </p>
              <Btn label="Entrar" onClick={() => nav('login')} />
            </div>
          ) : linkInvalido ? (
            <div role="alert">
              {titulo('Link inválido ou expirado')}
              <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.text, margin: '0 0 28px', lineHeight: 1.5 }}>
                Este link não vale mais: ele expira em 1 hora e só pode ser usado uma vez. Peça um novo link para criar a nova senha.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Btn label="Pedir um novo link" onClick={() => nav('esqueci-senha')} />
                <Btn label="Voltar para o login" outline onClick={() => nav('login')} />
              </div>
            </div>
          ) : (
            <>
              <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Nova senha</h2>
              <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.muted, margin: '0 0 28px' }}>Crie uma senha nova para a sua conta (mínimo de 8 caracteres).</p>
              <form noValidate onSubmit={e => { e.preventDefault(); handleSalvar(); }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <Input label="Nova senha" type={mostrar ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={senha} onChange={setSenha} error={fieldErrors.nova_senha} autoComplete="new-password" />
                  <Input label="Confirmar nova senha" type={mostrar ? 'text' : 'password'} placeholder="Repita a nova senha" value={confirmar} onChange={setConfirmar} error={fieldErrors.confirmar} autoComplete="new-password" />
                </div>
                <div style={{ marginTop: '4px' }}>
                  <button type="button" aria-pressed={mostrar} onClick={() => setMostrar(m => !m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primaryText, fontWeight: 700, fontSize: '14px', fontFamily: FONTE_TEXTO, padding: '12px 0', minHeight: '44px' }}>
                    {mostrar ? 'Ocultar senhas' : 'Mostrar senhas'}
                  </button>
                </div>
                {erro && <MensagemErro>{erro}</MensagemErro>}
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Btn label={loading ? 'Salvando…' : 'Redefinir senha'} type="submit" disabled={loading} />
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Register ─────────────────────────────────────────────────────────

function RegisterScreen({ nav, onLoginSuccess, onContaCriadaSemLogin }: {
  nav: (s: Screen) => void; onLoginSuccess: () => Promise<void>; onContaCriadaSemLogin: (aviso: string) => void;
}) {
  const [role, setRole] = useState<'looking' | 'has' | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleContinuar = async () => {
    setErro('');
    const erros: Record<string, string> = {};
    if (!nome.trim() || nome.trim().length < 2) erros.username = 'Nome deve ter pelo menos 2 caracteres.';
    else if (nome.trim().length > 150) erros.username = 'Nome deve ter no máximo 150 caracteres.';
    if (!email.trim()) erros.email = 'Informe seu e-mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) erros.email = 'Informe um e-mail válido.';
    if (!senha) erros.password = 'Informe uma senha.';
    else if (senha.length < 8) erros.password = 'A senha deve ter no mínimo 8 caracteres.';
    if (senha && confirmSenha && senha !== confirmSenha) erros.confirmSenha = 'As senhas não coincidem.';
    if (!role) erros.role = 'Selecione se você está procurando ou oferecendo um lugar.';
    setFieldErrors(erros);
    if (Object.keys(erros).length > 0) return;

    setLoading(true);
    let contaCriada = false;
    try {
      await apiRegistrar({
        username: nome.trim(),
        email: email.trim(),
        password: senha,
        tipo: role === 'looking' ? 'buscando_vaga' : 'oferecendo_vaga',
      });
      contaCriada = true;
      await apiLogin(email.trim(), senha);
      await onLoginSuccess();
    } catch (e: unknown) {
      if (contaCriada) {
        // A conta já existe: tentar cadastrar de novo só daria "e-mail já cadastrado". Vai para o login.
        onContaCriadaSemLogin('Sua conta foi criada, mas não conseguimos entrar automaticamente. Entre com seu e-mail e senha.');
        return;
      }
      if (e instanceof ApiError) {
        // Campos da API (backend/usuarios/serializers.py): username, email, password, tipo.
        // Na tela, `tipo` aparece no seletor "Você está:" (chave `role`).
        const fe: Record<string, string> = { ...e.fieldErrors };
        if (fe.tipo) { fe.role = fe.tipo; delete fe.tipo; }
        setFieldErrors(fe);
        const visiveis = ['username', 'email', 'password', 'role'];
        if (!visiveis.some(k => fe[k])) setErro(e.message);
      } else {
        setErro(e instanceof Error ? e.message : 'Erro ao criar conta.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-bg">
      <BrandPanel />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <button onClick={() => nav('welcome')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px 8px 0', minHeight: '44px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: C.muted }}>
            <IconeVoltar />
            <span style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', fontWeight: 700 }}>Voltar</span>
          </button>

          <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Criar conta</h2>
          <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.muted, margin: '0 0 28px' }}>Vamos conectar você ao lugar certo.</p>

          <form noValidate onSubmit={e => { e.preventDefault(); handleContinuar(); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Input label="Nome completo" placeholder="Seu nome" value={nome} onChange={setNome} error={fieldErrors.username} maxLength={150} autoComplete="name" />
            <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={setEmail} error={fieldErrors.email} autoComplete="username" />
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Senha" type="password" placeholder="Mínimo 8 caracteres" value={senha} onChange={setSenha} error={fieldErrors.password} autoComplete="new-password" />
              <Input label="Confirmar senha" type="password" placeholder="Repita a senha" value={confirmSenha} onChange={setConfirmSenha} error={fieldErrors.confirmSenha} autoComplete="new-password" />
            </div>
          </div>

          <p style={{ fontFamily: FONTE_TITULO, fontSize: '14px', fontWeight: 700, color: C.text, marginTop: '20px', marginBottom: '10px' }}>Você está:</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {(['looking', 'has'] as const).map(r => (
              <button key={r} type="button" onClick={() => setRole(r)} aria-pressed={role === r} style={{
                flex: 1, padding: '13px', minHeight: '48px', borderRadius: RAIO.botao, cursor: 'pointer',
                border: `2px solid ${role === r ? C.primary : fieldErrors.role ? C.danger : C.borderStrong}`,
                background: role === r ? C.primarySoft : C.card,
                color: role === r ? C.primaryText : C.muted,
                fontFamily: FONTE_TEXTO, fontSize: '14px', fontWeight: 700, lineHeight: 1.3,
              }}>
                {r === 'looking' ? '🔍 Procuro um lugar' : '🏠 Tenho um lugar disponível'}
              </button>
            ))}
          </div>
          {fieldErrors.role && <span style={ESTILO_ERRO_CAMPO}>{fieldErrors.role}</span>}

          {erro && <MensagemErro>{erro}</MensagemErro>}

          <div style={{ marginTop: '28px' }}>
            <Btn label={loading ? 'Criando conta…' : 'Continuar'} type="submit" disabled={loading} />
          </div>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted }}>
            Já tem uma conta?{' '}
            <button onClick={() => nav('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primaryText, fontWeight: 700, fontSize: '14px', fontFamily: FONTE_TEXTO, padding: '12px 4px', minHeight: '44px' }}>
              Entrar
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Perfil: tipos, validação e campos compartilhados (criação e edição) ──────

type TipoImovel = 'apartamento' | 'casa' | 'republica' | 'indiferente';
type Visitas = 'raramente' | 'as_vezes' | 'frequentemente';
type Horario = 'madrugador' | 'noturno' | 'flexivel';

// Limites iguais aos do backend (perfis/models.py e serializers.py). A descrição do imóvel
// não tem limite no backend; 1000 é um limite de interface.
const LIM = { nome: 150, regiao: 200, bio: 500, titulo: 120, descricao: 1000, fotos: 5, url: 500, orcamento: 99999999.99 };

interface PerfilForm {
  nome: string; idade: string; regiao: string; bio: string;
  orcamentoMin: string; orcamentoMax: string;
  tipoImovel: TipoImovel | null; qtdMoradores: number | null;
  fumante: boolean | null; pets: boolean | null;
  visitas: Visitas | null; horario: Horario | null;
  organizacao: number; bagunca: number; ruido: number; social: number;
  titulo: string; descricaoImovel: string; fotos: string[]; fotoPerfil: string;
}

const FORM_VAZIO: PerfilForm = {
  nome: '', idade: '', regiao: '', bio: '',
  orcamentoMin: '', orcamentoMax: '',
  tipoImovel: null, qtdMoradores: null,
  fumante: null, pets: null, visitas: null, horario: null,
  organizacao: 0, bagunca: 0, ruido: 0, social: 0,
  titulo: '', descricaoImovel: '', fotos: [], fotoPerfil: '',
};

// Campos (nomes da API) de cada etapa da criação de perfil.
const CAMPOS_ETAPA: Record<number, string[]> = {
  1: ['foto_perfil_url', 'nome', 'idade', 'regiao', 'bio'],
  2: ['orcamento_min', 'orcamento_max', 'tipo_imovel', 'qtd_moradores'],
  3: ['fumante', 'aceita_pets', 'aceita_visitas', 'perfil_horario'],
  4: ['tolerancia_bagunca', 'nivel_organizacao', 'nivel_ruido', 'nivel_social'],
  5: ['titulo_anuncio', 'descricao_imovel', 'fotos_imovel'],
};

function etapaDoCampo(campo: string): number | null {
  for (const [etapa, campos] of Object.entries(CAMPOS_ETAPA)) {
    if (campos.includes(campo)) return Number(etapa);
  }
  return null;
}

/** Número digitado no formato brasileiro: "1500", "1500,50", "1.500" e "1.500,50" (o ponto separa milhares). */
function numBR(v: string): number {
  const t = v.trim();
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''));
  return Number(t);
}

function urlHttpValida(u: string): boolean {
  if (!/^https?:\/\//.test(u)) return false;
  try { return !!new URL(u).hostname; } catch { return false; }
}

// Mesma mensagem de PerfilSerializer.validate_foto_perfil_url (backend/perfis/serializers.py).
const MSG_FOTO_PERFIL_INVALIDA = 'A URL da foto de perfil deve começar com http:// ou https://.';

/** Erro do link da foto de perfil (vazio é permitido). */
function erroFotoPerfil(url: string): string | undefined {
  const u = url.trim();
  return u && (u.length > LIM.url || !urlHttpValida(u)) ? MSG_FOTO_PERFIL_INVALIDA : undefined;
}

function perfilParaForm(p: PerfilAPI): PerfilForm {
  return {
    nome: p.nome, idade: String(p.idade), regiao: p.regiao, bio: p.bio ?? '',
    orcamentoMin: String(Number(p.orcamento_min)), orcamentoMax: String(Number(p.orcamento_max)),
    tipoImovel: p.tipo_imovel, qtdMoradores: p.qtd_moradores,
    fumante: p.fumante, pets: p.aceita_pets,
    visitas: p.aceita_visitas, horario: p.perfil_horario,
    organizacao: p.nivel_organizacao, bagunca: p.tolerancia_bagunca,
    ruido: p.nivel_ruido, social: p.nivel_social,
    titulo: p.titulo_anuncio ?? '', descricaoImovel: p.descricao_imovel ?? '',
    fotos: p.fotos_imovel ?? [], fotoPerfil: p.foto_perfil_url ?? '',
  };
}

function montarPayload(f: PerfilForm, anuncio: boolean): PerfilPayload {
  return {
    nome: f.nome.trim(),
    idade: Number(f.idade),
    regiao: f.regiao.trim(),
    bio: f.bio.trim(),
    orcamento_min: numBR(f.orcamentoMin),
    orcamento_max: numBR(f.orcamentoMax),
    fumante: f.fumante ?? false,
    aceita_pets: f.pets ?? false,
    tolerancia_bagunca: f.bagunca,
    nivel_organizacao: f.organizacao,
    perfil_horario: f.horario ?? 'flexivel',
    nivel_ruido: f.ruido,
    nivel_social: f.social,
    aceita_visitas: f.visitas ?? 'as_vezes',
    tipo_imovel: f.tipoImovel ?? 'indiferente',
    qtd_moradores: f.qtdMoradores ?? 2,
    // A foto de perfil vale para os dois tipos de usuário (etapa 1).
    foto_perfil_url: f.fotoPerfil.trim(),
    ...(anuncio ? {
      titulo_anuncio: f.titulo.trim(),
      descricao_imovel: f.descricaoImovel.trim(),
      fotos_imovel: f.fotos.map(x => x.trim()).filter(Boolean),
    } : {}),
  };
}

/** Valida só os `campos` pedidos (nomes da API). Mesmas regras da API, antes do envio. */
function validarPerfil(f: PerfilForm, campos: string[], anuncio: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  const quer = (c: string) => campos.includes(c);

  if (quer('nome')) {
    const n = f.nome.trim();
    if (n.length < 2) e.nome = 'Nome deve ter pelo menos 2 caracteres.';
    else if (n.length > LIM.nome) e.nome = `Nome deve ter no máximo ${LIM.nome} caracteres (${n.length}/${LIM.nome}).`;
  }
  if (quer('idade')) {
    const n = Number(f.idade);
    if (!f.idade || isNaN(n) || !Number.isInteger(n) || n < 18 || n > 100) e.idade = 'Idade deve estar entre 18 e 100 anos.';
  }
  if (quer('regiao')) {
    const r = f.regiao.trim();
    if (r.length < 2) e.regiao = 'Região deve ter pelo menos 2 caracteres.';
    else if (r.length > LIM.regiao) e.regiao = `Região deve ter no máximo ${LIM.regiao} caracteres (${r.length}/${LIM.regiao}).`;
  }
  if (quer('foto_perfil_url')) {
    const erro = erroFotoPerfil(f.fotoPerfil);
    if (erro) e.foto_perfil_url = erro;
  }
  if (quer('bio') && f.bio.length > LIM.bio) e.bio = `Bio deve ter no máximo ${LIM.bio} caracteres (${f.bio.length}/${LIM.bio}).`;

  if (quer('orcamento_min') || quer('orcamento_max')) {
    const min = numBR(f.orcamentoMin);
    const max = numBR(f.orcamentoMax);
    if (!f.orcamentoMin.trim() || isNaN(min) || min <= 0) e.orcamento_min = 'Informe um valor maior que zero.';
    else if (min > LIM.orcamento) e.orcamento_min = 'O valor máximo permitido é R$ 99.999.999,99.';
    if (!f.orcamentoMax.trim() || isNaN(max) || max <= 0) e.orcamento_max = 'Informe um valor maior que zero.';
    else if (max > LIM.orcamento) e.orcamento_max = 'O valor máximo permitido é R$ 99.999.999,99.';
    if (!e.orcamento_min && !e.orcamento_max && min > max) e.orcamento_max = 'O máximo deve ser maior ou igual ao mínimo.';
  }

  if (quer('fumante') && f.fumante === null) e.fumante = 'Responda se você fuma.';
  if (quer('aceita_pets') && f.pets === null) e.aceita_pets = 'Responda sobre pets.';
  if (quer('aceita_visitas') && !f.visitas) e.aceita_visitas = 'Selecione sua preferência.';
  if (quer('perfil_horario') && !f.horario) e.perfil_horario = 'Selecione seu perfil de horário.';

  if (quer('tolerancia_bagunca') && f.bagunca === 0) e.tolerancia_bagunca = 'Selecione sua tolerância à bagunça.';
  if (quer('nivel_organizacao') && f.organizacao === 0) e.nivel_organizacao = 'Selecione seu nível de organização.';
  if (quer('nivel_ruido') && f.ruido === 0) e.nivel_ruido = 'Selecione sua tolerância a barulho.';
  if (quer('nivel_social') && f.social === 0) e.nivel_social = 'Selecione seu nível social.';

  if (anuncio) {
    if (quer('titulo_anuncio') && f.titulo.trim().length > LIM.titulo) {
      e.titulo_anuncio = `O título deve ter no máximo ${LIM.titulo} caracteres (${f.titulo.trim().length}/${LIM.titulo}).`;
    }
    if (quer('descricao_imovel') && f.descricaoImovel.trim().length > LIM.descricao) {
      e.descricao_imovel = `A descrição deve ter no máximo ${LIM.descricao} caracteres (${f.descricaoImovel.trim().length}/${LIM.descricao}).`;
    }
    if (quer('fotos_imovel')) {
      const preenchidas = f.fotos.map(x => x.trim()).filter(Boolean);
      const ruim = f.fotos.findIndex(x => x.trim() !== '' && (x.trim().length > LIM.url || !urlHttpValida(x.trim())));
      if (preenchidas.length > LIM.fotos) e.fotos_imovel = `Envie no máximo ${LIM.fotos} fotos do imóvel.`;
      else if (ruim >= 0) e.fotos_imovel = `A foto ${ruim + 1} precisa ser um link http:// ou https:// válido (até ${LIM.url} caracteres).`;
    }
  }
  return e;
}

const ROTULO_ESTILO: React.CSSProperties = { fontFamily: FONTE_TITULO, fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' };
const ERRO_ESTILO = ESTILO_ERRO_CAMPO;

/** Botão de opção dos formulários de perfil (Sim/Não, tipo de imóvel, horário...). */
function estiloOpcao(ativo: boolean, erro?: string): React.CSSProperties {
  return {
    borderRadius: RAIO.campo, cursor: 'pointer', minHeight: '44px',
    border: `2px solid ${ativo ? C.primary : erro ? C.danger : C.borderStrong}`,
    background: ativo ? C.primarySoft : C.card,
    color: ativo ? C.primaryText : C.muted,
    fontFamily: FONTE_TEXTO, fontWeight: 700,
  };
}

function CampoSimNao({ label, value, onChange, error }: { label: string; value: boolean | null; onChange: (v: boolean) => void; error?: string }) {
  return (
    <div>
      <p style={ROTULO_ESTILO}>{label}</p>
      <div style={{ display: 'flex', gap: '10px' }}>
        {[true, false].map(v => (
          <button key={String(v)} type="button" onClick={() => onChange(v)} aria-pressed={value === v} style={{
            ...estiloOpcao(value === v, error), flex: 1, padding: '12px', fontSize: '14px',
          }}>
            {v ? 'Sim' : 'Não'}
          </button>
        ))}
      </div>
      {error && <span style={ERRO_ESTILO}>{error}</span>}
    </div>
  );
}

function CampoEscolha<T extends string>({ label, value, onChange, options, error }: {
  label: string; value: T | null; onChange: (v: T) => void;
  options: { value: T; label: string }[]; error?: string;
}) {
  return (
    <div>
      <p style={ROTULO_ESTILO}>{label}</p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {options.map(opt => (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)} aria-pressed={value === opt.value} style={{
            ...estiloOpcao(value === opt.value, error), flex: 1, minWidth: '80px', padding: '10px 12px', fontSize: '14px', textAlign: 'center',
          }}>
            {opt.label}
          </button>
        ))}
      </div>
      {error && <span style={ERRO_ESTILO}>{error}</span>}
    </div>
  );
}

function CampoEscala({ label, value, onChange, error }: { label: string; value: number; onChange: (v: number) => void; error?: string }) {
  return (
    <div>
      <p style={ROTULO_ESTILO}>{label}</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${label}: ${i} de 5`} aria-pressed={value === i} style={{
            flex: 1, height: '44px', borderRadius: RAIO.campo, cursor: 'pointer',
            border: `2px solid ${value >= i ? C.primaryDark : error ? C.danger : C.borderStrong}`,
            background: value >= i ? C.primaryDark : C.card,
            color: value >= i ? '#fff' : C.muted,
            fontFamily: FONTE_TITULO, fontSize: '15px', fontWeight: 700,
          }}>{i}</button>
        ))}
      </div>
      {error && <span style={ERRO_ESTILO}>{error}</span>}
    </div>
  );
}

function CampoQtdMoradores({ value, onChange, error }: { value: number | null; onChange: (v: number) => void; error?: string }) {
  return (
    <div>
      <p style={ROTULO_ESTILO}>Quantas pessoas no imóvel?</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[1, 2, 3, 4].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={value === n} style={{
            ...estiloOpcao(value === n, error), flex: 1, height: '44px', fontFamily: FONTE_TITULO, fontSize: '15px',
          }}>{n}{n === 4 ? '+' : ''}</button>
        ))}
      </div>
      {error && <span style={ERRO_ESTILO}>{error}</span>}
    </div>
  );
}

function CampoTexto({ label, value, onChange, max, error, placeholder, altura = 100 }: {
  label: string; value: string; onChange: (v: string) => void; max: number; error?: string; placeholder?: string; altura?: number;
}) {
  const erroId = useId();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={ESTILO_ROTULO}>{label}</span>
        <span style={{ fontSize: '12px', color: value.length >= max ? C.danger : C.muted, fontFamily: FONTE_TEXTO }}>{value.length}/{max}</span>
      </span>
      <textarea
        placeholder={placeholder}
        value={value}
        maxLength={max}
        aria-invalid={!!error}
        aria-describedby={error ? erroId : undefined}
        onChange={e => onChange(e.target.value)}
        style={{ ...estiloCampo({ erro: !!error }), width: '100%', resize: 'none', height: `${altura}px`, lineHeight: 1.5 }}
      />
      {error && <span id={erroId} style={{ ...ERRO_ESTILO, marginTop: 0 }}>{error}</span>}
    </label>
  );
}

type PropsEtapa = { form: PerfilForm; setForm: (p: Partial<PerfilForm>) => void; errors: Record<string, string> };

const ID_CAMPO_FOTO_PERFIL = 'campo-foto-perfil';

/** Círculo com a prévia da foto (ou ícone da câmera) + campo "Link da sua foto". Clicar no círculo foca o campo. */
function CampoFotoPerfil({ form, setForm, errors }: PropsEtapa) {
  const u = form.fotoPerfil.trim();
  const erroLocal = erroFotoPerfil(form.fotoPerfil);
  const valida = u !== '' && !erroLocal;
  const [falhou, setFalhou] = useState(false);
  useEffect(() => { setFalhou(false); }, [u]);
  const mostrarFoto = valida && !falhou;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => document.getElementById(ID_CAMPO_FOTO_PERFIL)?.focus()}
          aria-label={mostrarFoto ? 'Alterar o link da sua foto' : 'Adicionar o link da sua foto'}
          style={{ width: '96px', height: '96px', borderRadius: '50%', background: C.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', border: mostrarFoto ? `3px solid ${C.primary}` : `3px dashed ${C.primary}`, padding: 0, cursor: 'pointer' }}
        >
          {mostrarFoto ? (
            <img key={u} src={u} alt="Pré-visualização da sua foto" onError={() => setFalhou(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : (
            <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          )}
          <span aria-hidden="true" style={{ position: 'absolute', bottom: 0, right: 0, width: '26px', height: '26px', background: C.primaryDark, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: 700 }}>
            {mostrarFoto ? '✎' : '+'}
          </span>
        </button>
      </div>
      <Input id={ID_CAMPO_FOTO_PERFIL} label="Link da sua foto" placeholder="https://..." value={form.fotoPerfil} onChange={v => setForm({ fotoPerfil: v })} error={erroLocal ?? errors.foto_perfil_url} maxLength={LIM.url} />
    </div>
  );
}

function EtapaPessoal({ form, setForm, errors }: PropsEtapa) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <CampoFotoPerfil form={form} setForm={setForm} errors={errors} />
      <Input label="Nome" placeholder="Seu nome completo" value={form.nome} onChange={v => setForm({ nome: v })} error={errors.nome} maxLength={LIM.nome} />
      <div className="grid md:grid-cols-2 gap-4">
        <Input label="Idade" type="number" inputMode="numeric" placeholder="Sua idade" value={form.idade} onChange={v => setForm({ idade: v })} error={errors.idade} />
        <Input label="Região ou bairro" placeholder="Ex: Boa Viagem, Recife" value={form.regiao} onChange={v => setForm({ regiao: v })} error={errors.regiao} maxLength={LIM.regiao} />
      </div>
      <CampoTexto label="Sobre você" placeholder="Conte um pouco sobre você e o que procura em um colega de moradia..." value={form.bio} onChange={v => setForm({ bio: v })} max={LIM.bio} error={errors.bio} />
    </div>
  );
}

function EtapaMoradia({ form, setForm, errors }: PropsEtapa) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <p style={ROTULO_ESTILO}>Faixa de orçamento mensal</p>
        <div className="grid md:grid-cols-2 gap-4">
          <Input label="Mínimo (R$)" inputMode="decimal" placeholder="700" value={form.orcamentoMin} onChange={v => setForm({ orcamentoMin: v })} error={errors.orcamento_min} />
          <Input label="Máximo (R$)" inputMode="decimal" placeholder="1500" value={form.orcamentoMax} onChange={v => setForm({ orcamentoMax: v })} error={errors.orcamento_max} />
        </div>
      </div>
      <CampoEscolha<TipoImovel>
        label="Tipo de imóvel preferido"
        value={form.tipoImovel}
        onChange={v => setForm({ tipoImovel: v })}
        error={errors.tipo_imovel}
        options={[
          { value: 'apartamento', label: 'Apartamento' },
          { value: 'casa', label: 'Casa' },
          { value: 'republica', label: 'República' },
          { value: 'indiferente', label: 'Indiferente' },
        ]}
      />
      <CampoQtdMoradores value={form.qtdMoradores} onChange={v => setForm({ qtdMoradores: v })} error={errors.qtd_moradores} />
    </div>
  );
}

function EtapaConvivencia({ form, setForm, errors }: PropsEtapa) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="grid md:grid-cols-2 gap-6">
        <CampoSimNao label="Você fuma?" value={form.fumante} onChange={v => setForm({ fumante: v })} error={errors.fumante} />
        <CampoSimNao label="Aceita pets?" value={form.pets} onChange={v => setForm({ pets: v })} error={errors.aceita_pets} />
      </div>
      <CampoEscolha<Visitas>
        label="Com que frequência recebe visitas?"
        value={form.visitas}
        onChange={v => setForm({ visitas: v })}
        error={errors.aceita_visitas}
        options={[
          { value: 'raramente', label: 'Raramente' },
          { value: 'as_vezes', label: 'Às vezes' },
          { value: 'frequentemente', label: 'Frequentemente' },
        ]}
      />
      <CampoEscolha<Horario>
        label="Qual é o seu perfil de horário?"
        value={form.horario}
        onChange={v => setForm({ horario: v })}
        error={errors.perfil_horario}
        options={[
          { value: 'madrugador', label: '🌅 Madrugador(a)' },
          { value: 'noturno', label: '🌙 Noturno(a)' },
          { value: 'flexivel', label: '☀️ Flexível' },
        ]}
      />
    </div>
  );
}

function EtapaHabitos({ form, setForm, errors }: PropsEtapa) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <CampoEscala label="Organização" value={form.organizacao} onChange={v => setForm({ organizacao: v })} error={errors.nivel_organizacao} />
      <CampoEscala label="Tolerância à bagunça" value={form.bagunca} onChange={v => setForm({ bagunca: v })} error={errors.tolerancia_bagunca} />
      <CampoEscala label="Tolerância a barulho" value={form.ruido} onChange={v => setForm({ ruido: v })} error={errors.nivel_ruido} />
      <CampoEscala label="Perfil social" value={form.social} onChange={v => setForm({ social: v })} error={errors.nivel_social} />
    </div>
  );
}

function PreviewFoto({ url, alt }: { url: string; alt: string }) {
  const u = url.trim();
  if (!u || !urlHttpValida(u)) return null;
  return (
    <div style={{ width: '100%', maxWidth: '220px', height: '124px', borderRadius: '12px', overflow: 'hidden', border: `1.5px solid ${C.border}`, marginTop: '8px' }}>
      <ImagemComFallback key={u} src={u} alt={alt} tipo="imovel" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}

function EtapaAnuncio({ form, setForm, errors }: PropsEtapa) {
  const setFoto = (i: number, v: string) => setForm({ fotos: form.fotos.map((f, idx) => (idx === i ? v : f)) });
  const remover = (i: number) => setForm({ fotos: form.fotos.filter((_, idx) => idx !== i) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Input label="Título do anúncio" placeholder="Ex: Quarto amplo próximo ao metrô" value={form.titulo} onChange={v => setForm({ titulo: v })} error={errors.titulo_anuncio} maxLength={LIM.titulo} />
      <CampoTexto label="Descrição do imóvel" placeholder="Descreva o imóvel, a vaga e as regras da casa..." value={form.descricaoImovel} onChange={v => setForm({ descricaoImovel: v })} max={LIM.descricao} error={errors.descricao_imovel} altura={110} />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <p style={{ ...ROTULO_ESTILO, margin: 0 }}>Fotos do imóvel (links)</p>
          <span style={{ fontSize: '12px', color: C.muted, fontFamily: FONTE_TEXTO }}>{form.fotos.length}/{LIM.fotos}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {form.fotos.map((url, i) => {
            const u = url.trim();
            const ruim = u !== '' && (u.length > LIM.url || !urlHttpValida(u));
            return (
              <div key={i}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <Input label={`Foto ${i + 1}`} placeholder="https://..." value={url} onChange={v => setFoto(i, v)} maxLength={LIM.url} error={ruim ? 'Informe um link http:// ou https:// válido.' : undefined} />
                  </div>
                  <button type="button" onClick={() => remover(i)} aria-label={`Remover foto ${i + 1}`} style={{ minWidth: '48px', minHeight: '48px', borderRadius: RAIO.campo, border: `1.5px solid ${C.borderStrong}`, background: C.card, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconeFechar tamanho={18} /></button>
                </div>
                <PreviewFoto url={url} alt={`Pré-visualização da foto ${i + 1}`} />
              </div>
            );
          })}
        </div>
        {form.fotos.length < LIM.fotos && (
          <button type="button" onClick={() => setForm({ fotos: [...form.fotos, ''] })} style={{ marginTop: '10px', padding: '10px 16px', minHeight: '44px', borderRadius: RAIO.botao, border: `2px dashed ${C.primary}`, background: 'none', color: C.primaryText, cursor: 'pointer', fontFamily: FONTE_TITULO, fontSize: '14px', fontWeight: 700 }}>
            + Adicionar foto
          </button>
        )}
        {errors.fotos_imovel && <span style={ERRO_ESTILO}>{errors.fotos_imovel}</span>}
      </div>
    </div>
  );
}

// ─── Screen: Profile Create ───────────────────────────────────────────────────

function ProfileCreateScreen({ nav, onPerfilCriado, tipo }: { nav: (s: Screen) => void; onPerfilCriado: (p: PerfilAPI) => void; tipo: string }) {
  const anuncio = tipo === 'oferecendo_vaga';
  const TOTAL_STEPS = anuncio ? 5 : 4;
  const [step, setStep] = useState(1);
  const [form, setFormState] = useState<PerfilForm>(FORM_VAZIO);
  const setForm = (p: Partial<PerfilForm>) => setFormState(f => ({ ...f, ...p }));

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Leva o foco/rolagem ao primeiro campo com erro (ex.: ao voltar para uma etapa anterior).
  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) return;
    const el = document.querySelector('[aria-invalid="true"]');
    if (el && 'scrollIntoView' in el) (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [fieldErrors, step]);

  const validarStep = (): boolean => {
    const erros = validarPerfil(form, CAMPOS_ETAPA[step] ?? [], anuncio);
    setFieldErrors(erros);
    setErro('');
    return Object.keys(erros).length === 0;
  };

  const handleProximo = () => {
    if (validarStep()) setStep(s => s + 1);
  };

  const handleConcluir = async () => {
    if (!validarStep()) return;
    setErro('');
    setLoading(true);
    try {
      const perfil = await apiCriarPerfil(montarPayload(form, anuncio));
      onPerfilCriado(perfil);
      nav('discovery');
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        const etapas = Object.keys(e.fieldErrors)
          .map(etapaDoCampo)
          .filter((n): n is number => n !== null && n <= TOTAL_STEPS);
        setFieldErrors(e.fieldErrors);
        if (etapas.length > 0) {
          // Volta para a primeira etapa que tem campo com erro e destaca o campo.
          setStep(Math.min(...etapas));
          setErro('Corrija os campos destacados e tente novamente.');
        } else {
          setErro(e.message);
        }
      } else {
        setErro(e instanceof Error ? e.message : 'Erro ao criar perfil.');
      }
    } finally {
      setLoading(false);
    }
  };

  const STEP_LABELS = ['Informações pessoais', 'Preferências de moradia', 'Estilo de convivência', 'Hábitos', 'Anúncio do imóvel'];
  const TITULOS = ['Sobre você', 'Preferências de moradia', 'Estilo de convivência', 'Seus hábitos', 'Anúncio do imóvel'];
  const props: PropsEtapa = { form, setForm, errors: fieldErrors };

  return (
    <div className="flex min-h-dvh bg-bg">
      <BrandPanel />

      {/* Painel do formulário */}
      <div className="flex-1 flex justify-center p-6 lg:p-10">
        <div className="w-full max-w-2xl flex flex-col">
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(i => (
                <div key={i} style={{ flex: 1, height: '6px', borderRadius: '3px', background: i <= step ? C.primary : C.border }} />
              ))}
            </div>
            <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', fontWeight: 600, color: C.muted, margin: 0 }}>
              Etapa {step} de {TOTAL_STEPS} — {STEP_LABELS[step - 1]}
            </p>
          </div>

          <div style={{ paddingTop: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ ...ESTILO_TITULO_TELA, margin: step >= 4 ? '0 0 6px' : '0 0 24px' }}>{TITULOS[step - 1]}</h2>
            {step === 4 && <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: '0 0 24px' }}>1 = mínimo · 5 = máximo</p>}
            {step === 5 && <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: '0 0 24px' }}>Opcional: você pode completar depois em Meu Perfil.</p>}

            {step === 1 && <EtapaPessoal {...props} />}
            {step === 2 && <EtapaMoradia {...props} />}
            {step === 3 && <EtapaConvivencia {...props} />}
            {step === 4 && <EtapaHabitos {...props} />}
            {step === 5 && anuncio && <EtapaAnuncio {...props} />}

            {erro && <MensagemErro>{erro}</MensagemErro>}

            {/* Rodapé */}
            <div className="flex flex-col md:flex-row gap-3 mt-auto pt-8">
              {step > 1 && <Btn label="Voltar" outline onClick={() => { setFieldErrors({}); setErro(''); setStep(s => s - 1); }} />}
              <Btn
                label={step === TOTAL_STEPS ? (loading ? 'Salvando…' : 'Concluir perfil') : 'Próxima etapa'}
                onClick={step < TOTAL_STEPS ? handleProximo : handleConcluir}
                disabled={step === TOTAL_STEPS && loading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Discovery ────────────────────────────────────────────────────────

// ─── Discovery Filters ───────────────────────────────────────────────────────

interface DiscoveryFilters {
  regiao: string;
  tipo_imovel: string;
  aceita_pets: 'sim' | 'nao' | 'indiferente';
  fumante: 'sim' | 'nao' | 'indiferente';
  orcamento_min: string;
  orcamento_max: string;
  score_min: number;
  ordenar: 'compatibilidade' | 'menor_preco' | 'maior_preco';
}
const EMPTY_FILTERS: DiscoveryFilters = {
  regiao: '', tipo_imovel: '', aceita_pets: 'indiferente',
  fumante: 'indiferente', orcamento_min: '', orcamento_max: '',
  score_min: 0, ordenar: 'compatibilidade',
};

function DiscoveryScreen({ nav, setMatchProfile, onSelectProfile, showFilters, setShowFilters, onMatch, tipo, regiao }: {
  tipo: string;
  regiao?: string;
  nav: (s: Screen) => void;
  setMatchProfile: (p: Profile) => void;
  onSelectProfile: (p: Profile) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  onMatch?: (matchId: number) => void;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [apiError, setApiError] = useState('');
  const [acaoErro, setAcaoErro] = useState('');
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  // Só a resposta da busca mais recente vale: com a digitação rápida, uma resposta antiga
  // (que chega depois) não pode sobrescrever a lista da busca atual.
  const buscaAtualRef = useRef(0);
  const [searchQ, setSearchQ] = useState<string>(() => {
    try { return sessionStorage.getItem('pm_disc_q') ?? ''; } catch { return ''; }
  });
  const [filters, setFilters] = useState<DiscoveryFilters>(() => {
    try {
      const s = sessionStorage.getItem('pm_disc_filters');
      return s ? (JSON.parse(s) as DiscoveryFilters) : EMPTY_FILTERS;
    } catch { return EMPTY_FILTERS; }
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sair da tela cancela a busca agendada (senão ela dispararia depois, até depois de sair da conta).
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // O título depende de quem está logado (vale também com a lista vazia).
  const tituloTela = tipo === 'buscando_vaga' ? 'Vagas para você'
    : tipo === 'oferecendo_vaga' ? 'Interessados na sua vaga'
    : 'Descoberta';

  const activeFiltersCount = [
    filters.regiao,
    filters.tipo_imovel,
    filters.aceita_pets !== 'indiferente' ? 'x' : '',
    filters.fumante !== 'indiferente' ? 'x' : '',
    filters.orcamento_min,
    filters.orcamento_max,
    filters.score_min > 0 ? 'x' : '',
    filters.ordenar !== 'compatibilidade' ? 'x' : '',
  ].filter(Boolean).length;

  const doFetch = (q: string, f: DiscoveryFilters) => {
    const busca = ++buscaAtualRef.current;
    setLoadingProfiles(true);
    setApiError('');
    setAcaoErro('');
    const params: DescobertaParams = {};
    if (q) params.q = q;
    if (f.regiao) params.regiao = [f.regiao];
    if (f.tipo_imovel) params.tipo_imovel = f.tipo_imovel;
    if (f.aceita_pets !== 'indiferente') params.aceita_pets = f.aceita_pets;
    if (f.fumante !== 'indiferente') params.fumante = f.fumante;
    if (f.orcamento_min) params.orcamento_min = numBR(f.orcamento_min);
    if (f.orcamento_max) params.orcamento_max = numBR(f.orcamento_max);
    if (f.score_min > 0) params.score_min = f.score_min;
    if (f.ordenar !== 'compatibilidade') params.ordenar = f.ordenar;
    listarDescoberta(params)
      .then(data => {
        if (busca !== buscaAtualRef.current) return;
        setProfiles(data.map(perfilDescobertoParaProfile));
        setLoadingProfiles(false);
      })
      .catch(err => {
        if (busca !== buscaAtualRef.current) return;
        setApiError(err instanceof ApiError ? err.message : 'Não foi possível carregar os perfis. Verifique sua conexão e tente novamente.');
        setLoadingProfiles(false);
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { doFetch(searchQ, filters); }, []);

  const handleSearchChange = (q: string) => {
    setSearchQ(q);
    sessionStorage.setItem('pm_disc_q', q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doFetch(q, filters), 400);
  };

  const handleApplyFilters = (newFilters: DiscoveryFilters) => {
    setShowFilters(false);
    setFilters(newFilters);
    sessionStorage.setItem('pm_disc_filters', JSON.stringify(newFilters));
    doFetch(searchQ, newFilters);
  };

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS);
    sessionStorage.removeItem('pm_disc_filters');
    sessionStorage.removeItem('pm_disc_q');
    setSearchQ('');
    doFetch('', EMPTY_FILTERS);
  };

  const removeFilterChip = (key: keyof DiscoveryFilters) => {
    let newFilters: DiscoveryFilters;
    if (key === 'aceita_pets' || key === 'fumante') newFilters = { ...filters, [key]: 'indiferente' as const };
    else if (key === 'score_min') newFilters = { ...filters, score_min: 0 };
    else if (key === 'ordenar') newFilters = { ...filters, ordenar: 'compatibilidade' };
    else newFilters = { ...filters, [key]: '' };
    setFilters(newFilters);
    sessionStorage.setItem('pm_disc_filters', JSON.stringify(newFilters));
    doFetch(searchQ, newFilters);
  };

  const removeProfile = (id: number) => setProfiles(ps => ps.filter(p => p.id !== id));

  const handleLike = async (p: Profile) => {
    if (loadingId !== null) return;
    setLoadingId(p.id);
    setAcaoErro('');
    try {
      const res = await enviarCurtida(p.id, 'curtir');
      if (res.match) {
        setMatchProfile(p);
        removeProfile(p.id);
        onMatch?.(res.match_data?.id ?? 0);
        nav('match');
        return;
      }
    } catch (err) {
      // Perfil que não está mais disponível (já avaliado, conta suspensa...) sai da lista;
      // qualquer outra falha (rede, servidor) mantém o card e avisa, para tentar de novo.
      if (!perfilIndisponivel(err)) {
        setAcaoErro(err instanceof ApiError ? err.message : 'Não foi possível registrar sua curtida. Tente novamente.');
        return;
      }
    } finally {
      setLoadingId(null);
    }
    removeProfile(p.id);
  };

  const handleDislike = async (p: Profile) => {
    if (loadingId !== null) return;
    setLoadingId(p.id);
    setAcaoErro('');
    try {
      await enviarCurtida(p.id, 'recusar');
    } catch (err) {
      if (!perfilIndisponivel(err)) {
        setAcaoErro(err instanceof ApiError ? err.message : 'Não foi possível registrar sua recusa. Tente novamente.');
        return;
      }
    } finally {
      setLoadingId(null);
    }
    removeProfile(p.id);
  };

  return (
    <div className="flex flex-col flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 8px', background: C.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <h1 style={ESTILO_TITULO_TELA}>{tituloTela}</h1>
            {regiao && <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted, margin: '2px 0 0' }}>📍 {regiao}</p>}
          </div>
          <button onClick={() => setShowFilters(true)} aria-label="Abrir filtros de busca" style={{
            position: 'relative', width: '44px', height: '44px', borderRadius: RAIO.botao,
            border: `1.5px solid ${activeFiltersCount > 0 ? C.primary : C.borderStrong}`,
            background: activeFiltersCount > 0 ? C.primarySoft : C.card,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeFiltersCount > 0 ? C.primaryText : C.text} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
            </svg>
            {activeFiltersCount > 0 && <Contador n={activeFiltersCount} style={{ position: 'absolute', top: '-6px', right: '-6px' }} />}
          </button>
        </div>
        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" aria-hidden="true"
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            value={searchQ}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar por nome, região..."
            aria-label="Buscar por nome ou região"
            style={{ ...estiloCampo({ compacto: true }), width: '100%', minHeight: '44px', padding: '10px 44px 10px 38px' }}
          />
          {searchQ && (
            <BotaoIcone ariaLabel="Limpar busca" onClick={() => handleSearchChange('')} style={{ position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)' }}>
              <IconeFechar tamanho={16} />
            </BotaoIcone>
          )}
        </div>
        {/* Active filter chips */}
        {activeFiltersCount > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
            {filters.regiao && <ChipFiltro rotulo={`Região: ${filters.regiao}`} onRemover={() => removeFilterChip('regiao')} />}
            {filters.tipo_imovel && <ChipFiltro rotulo={IMOVEL_LABEL[filters.tipo_imovel] ?? filters.tipo_imovel} onRemover={() => removeFilterChip('tipo_imovel')} />}
            {filters.aceita_pets !== 'indiferente' && <ChipFiltro rotulo={`Aceita pets: ${filters.aceita_pets === 'sim' ? 'Sim' : 'Não'}`} onRemover={() => removeFilterChip('aceita_pets')} />}
            {filters.fumante !== 'indiferente' && <ChipFiltro rotulo={`Fumante: ${filters.fumante === 'sim' ? 'Sim' : 'Não'}`} onRemover={() => removeFilterChip('fumante')} />}
            {filters.orcamento_min && <ChipFiltro rotulo={`Mínimo: ${moedaBR(numBR(filters.orcamento_min))}`} onRemover={() => removeFilterChip('orcamento_min')} />}
            {filters.orcamento_max && <ChipFiltro rotulo={`Máximo: ${moedaBR(numBR(filters.orcamento_max))}`} onRemover={() => removeFilterChip('orcamento_max')} />}
            {filters.score_min > 0 && <ChipFiltro rotulo={`Compatibilidade ≥ ${filters.score_min}%`} onRemover={() => removeFilterChip('score_min')} />}
            {filters.ordenar !== 'compatibilidade' && <ChipFiltro rotulo={filters.ordenar === 'menor_preco' ? 'Menor preço' : 'Maior preço'} onRemover={() => removeFilterChip('ordenar')} />}
          </div>
        )}
      </div>

      {/* Cards */}
      <div style={{ padding: '0 20px 20px', flex: 1 }}>
        {loadingProfiles && <EstadoCarregando texto="Carregando perfis…" altura="420px" />}
        {!loadingProfiles && apiError && <EstadoErro mensagem={apiError} onTentarNovamente={() => doFetch(searchQ, filters)} altura="420px" />}
        {!loadingProfiles && !apiError && profiles.length === 0 && (activeFiltersCount > 0 || searchQ) ? (
          <EstadoVazio
            titulo="Nenhum perfil com esses filtros."
            descricao="Tente outros termos ou remova alguns filtros."
            icone={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
            acao={{ rotulo: 'Limpar filtros', onClick: handleClearFilters }}
            altura="360px"
          />
        ) : (!loadingProfiles && !apiError && profiles.length === 0) ? (
          <EstadoVazio
            titulo="Ainda não há perfis para você."
            descricao="Volte mais tarde: novos perfis aparecem aqui assim que se cadastrarem."
            icone={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>}
            altura="420px"
          />
        ) : null}

        {acaoErro && <div style={{ marginBottom: '12px' }}><MensagemErro>{acaoErro}</MensagemErro></div>}

        {/* Mobile: single card */}
        {!loadingProfiles && !apiError && profiles.length > 0 && (() => {
          const p = profiles[0];
          const isLoading = loadingId === p.id;
          return (
            <div className="md:hidden">
              {p.tipo === 'oferecendo_vaga' ? (
                /* ── card de anúncio (Airbnb-style) ── */
                <div onClick={() => { onSelectProfile(p); nav('profile-detail'); }}
                  style={{ borderRadius: '24px', overflow: 'hidden', background: C.card, boxShadow: '0 12px 40px rgba(0,0,0,0.12)', cursor: 'pointer' }}>
                  <div style={{ position: 'relative', aspectRatio: '4/3' }}>
                    <ImagemComFallback src={p.fotosImovel?.[0]} alt={p.tituloAnuncio ?? p.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} tipo="imovel" />
                    <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                      <CompatBadge value={p.compat} sobreFoto />
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px 20px' }}>
                    <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '20px', fontWeight: 800, color: C.text, margin: '0 0 4px', lineHeight: 1.3, overflow: 'hidden', maxHeight: '2.6em' }}>
                      {p.tituloAnuncio ?? `Vaga em ${p.region}`}
                    </h2>
                    <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted, margin: '0 0 8px' }}>
                      📍 {p.region} · {IMOVEL_LABEL[p.tipoImovel] ?? p.tipoImovel} · {rotuloMoradores(p.qtdMoradores)}
                    </p>
                    <p style={{ fontFamily: FONTE_TITULO, fontSize: '22px', fontWeight: 800, color: C.text, margin: '0 0 10px' }}>
                      {p.budget} <span style={{ fontSize: '14px', fontWeight: 400, color: C.muted }}>/ mês</span>
                    </p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      {p.pets && <Tag label="Aceita pets" />}
                      {!p.smoker && <Tag label="Não fumante" />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
                      <ImagemComFallback src={p.fotoPerfilUrl} alt={p.name}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                        tipo="avatar" iniciais={p.name.charAt(0)} />
                      <span style={{ fontFamily: FONTE_TEXTO, fontSize: '12px', color: C.muted }}>
                        Anunciado por <strong style={{ color: C.text }}>{p.name.split(' ')[0]}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── card de pessoa (estilo original) ── */
                <div onClick={() => { onSelectProfile(p); nav('profile-detail'); }}
                  style={{ borderRadius: '28px', overflow: 'hidden', position: 'relative', height: '480px', cursor: 'pointer', boxShadow: '0 12px 40px rgba(0,0,0,0.14)' }}>
                  <ImagemComFallback src={p.photo} alt={p.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} tipo="avatar" iniciais={p.name.charAt(0)} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.88) 0%, rgba(42,36,32,0.2) 50%, transparent 80%)' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '26px', fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>{p.name}, {p.age}</h2>
                        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: 'rgba(255,255,255,0.9)', margin: 0 }}>📍 {p.region}</p>
                      </div>
                      <CompatBadge value={p.compat} sobreFoto />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      {p.tags.map(t => (
                        <span key={t} style={{ padding: '4px 10px', borderRadius: RAIO.selo, background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)', fontSize: '12px', fontWeight: 600, color: '#fff', fontFamily: FONTE_TEXTO }}>{t}</span>
                      ))}
                    </div>
                    {p.bio && <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.5 }}>{p.bio.length > 80 ? `${p.bio.slice(0, 80).trimEnd()}…` : p.bio}</p>}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '24px' }}>
                <button aria-label="Recusar perfil" onClick={() => handleDislike(p)} disabled={isLoading} style={{ width: '64px', height: '64px', borderRadius: '50%', border: `2px solid ${C.border}`, background: C.card, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', opacity: isLoading ? 0.6 : 1 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.danger} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <button aria-label="Curtir perfil" onClick={() => handleLike(p)} disabled={isLoading} style={{ width: '72px', height: '72px', borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px rgba(224,107,69,0.4)`, opacity: isLoading ? 0.6 : 1 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                </button>
                <button aria-label="Ver detalhes" onClick={() => { onSelectProfile(p); nav('profile-detail'); }} style={{ width: '64px', height: '64px', borderRadius: '50%', border: `2px solid ${C.border}`, background: C.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.mintText} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Tablet/Desktop: grid */}
        {!loadingProfiles && !apiError && profiles.length > 0 && (
          <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {profiles.map(p => {
              const isLoading = loadingId === p.id;
              return (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {p.tipo === 'oferecendo_vaga' ? (
                    /* ── card de anúncio desktop ── */
                    <div onClick={() => { onSelectProfile(p); nav('profile-detail'); }}
                      style={{ borderRadius: '24px', overflow: 'hidden', background: C.card, boxShadow: '0 8px 28px rgba(0,0,0,0.10)', cursor: 'pointer' }}>
                      <div style={{ position: 'relative', aspectRatio: '4/3' }}>
                        <ImagemComFallback src={p.fotosImovel?.[0]} alt={p.tituloAnuncio ?? p.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} tipo="imovel" />
                        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                          <CompatBadge value={p.compat} sobreFoto />
                        </div>
                      </div>
                      <div style={{ padding: '14px 16px 16px' }}>
                        <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 800, color: C.text, margin: '0 0 3px', lineHeight: 1.3, overflow: 'hidden', maxHeight: '2.6em' }}>
                          {p.tituloAnuncio ?? `Vaga em ${p.region}`}
                        </h2>
                        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '12px', color: C.muted, margin: '0 0 6px' }}>
                          📍 {p.region} · {IMOVEL_LABEL[p.tipoImovel] ?? p.tipoImovel} · {rotuloMoradores(p.qtdMoradores)}
                        </p>
                        <p style={{ fontFamily: FONTE_TITULO, fontSize: '17px', fontWeight: 800, color: C.text, margin: '0 0 8px' }}>
                          {p.budget} <span style={{ fontSize: '12px', fontWeight: 400, color: C.muted }}>/ mês</span>
                        </p>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          {p.pets && <Tag label="Aceita pets" />}
                          {!p.smoker && <Tag label="Não fumante" />}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '10px', borderTop: `1px solid ${C.border}` }}>
                          <ImagemComFallback src={p.fotoPerfilUrl} alt={p.name}
                            style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                            tipo="avatar" iniciais={p.name.charAt(0)} />
                          <span style={{ fontFamily: FONTE_TEXTO, fontSize: '12px', color: C.muted }}>
                            Anunciado por <strong style={{ color: C.text }}>{p.name.split(' ')[0]}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ── card de pessoa desktop (original) ── */
                    <div onClick={() => { onSelectProfile(p); nav('profile-detail'); }}
                      style={{ borderRadius: '24px', overflow: 'hidden', position: 'relative', height: '380px', cursor: 'pointer', boxShadow: '0 8px 28px rgba(0,0,0,0.12)' }}>
                      <ImagemComFallback src={p.photo} alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} tipo="avatar" iniciais={p.name.charAt(0)} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.85) 0%, rgba(42,36,32,0.15) 50%, transparent 80%)' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', marginBottom: '6px' }}>
                          <div>
                            <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>{p.name}, {p.age}</h2>
                            <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: 'rgba(255,255,255,0.9)', margin: 0 }}>📍 {p.region}</p>
                          </div>
                          <CompatBadge value={p.compat} sobreFoto />
                        </div>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {p.tags.slice(0, 3).map(t => (
                            <span key={t} style={{ padding: '3px 8px', borderRadius: RAIO.selo, background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)', fontSize: '12px', fontWeight: 600, color: '#fff', fontFamily: FONTE_TEXTO }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                    <button aria-label="Recusar perfil" onClick={() => handleDislike(p)} disabled={isLoading} style={{ width: '52px', height: '52px', borderRadius: '50%', border: `2px solid ${C.border}`, background: C.card, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', opacity: isLoading ? 0.6 : 1 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.danger} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <button aria-label="Curtir perfil" onClick={() => handleLike(p)} disabled={isLoading} style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 20px rgba(224,107,69,0.4)`, opacity: isLoading ? 0.6 : 1 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showFilters && (
        <FiltersModal
          filters={filters}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          onClose={() => setShowFilters(false)}
        />
      )}
    </div>
  );
}

// ─── Screen: Profile Detail ───────────────────────────────────────────────────

function ProfileDetailScreen({ nav, profile, backScreen, onLike, onRecusar }: {
  onRecusar?: (p: Profile) => Promise<void>;
  nav: (s: Screen) => void;
  profile: Profile;
  backScreen: Screen;
  onLike?: (p: Profile) => Promise<void>;
}) {
  const [liking, setLiking] = useState(false);
  const [erroAcao, setErroAcao] = useState('');
  // Vindo do chat (já há match) não faz sentido curtir/recusar: o detalhe é só leitura.
  const somenteLeitura = backScreen === 'chat';
  const mensagemDaFalha = (e: unknown) => (e instanceof ApiError ? e.message : 'Não foi possível concluir a ação. Tente novamente.');
  const handleRecusar = async () => {
    if (!onRecusar) { nav(backScreen); return; }
    setErroAcao('');
    setLiking(true);
    try { await onRecusar(profile); } catch (e) { setErroAcao(mensagemDaFalha(e)); } finally { setLiking(false); }
  };
  const [fotoAtiva, setFotoAtiva] = useState<string>(profile.fotosImovel?.[0] ?? '');
  const [showDenuncia, setShowDenuncia] = useState(false);

  useEffect(() => {
    setFotoAtiva(profile.fotosImovel?.[0] ?? '');
  }, [profile.id]);

  const handleLike = async () => {
    if (!onLike || liking) return;
    setErroAcao('');
    setLiking(true);
    try {
      await onLike(profile);
    } catch (e) {
      setErroAcao(mensagemDaFalha(e));
    } finally {
      setLiking(false);
    }
  };

  if (profile.tipo === 'oferecendo_vaga') {
    const fotosImovel = profile.fotosImovel ?? [];
    const fotoSrc = fotoAtiva || fotosImovel[0];
    return (
      <div className="flex flex-col flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
        {/* galeria de fotos */}
        <div style={{ position: 'relative', background: '#000' }}>
          <ImagemComFallback src={fotoSrc} alt={profile.tituloAnuncio ?? profile.name}
            style={{ width: '100%', height: '300px', objectFit: 'cover', display: 'block' }} tipo="imovel" />
          <BotaoIcone ariaLabel="Voltar" onClick={() => nav(backScreen)} cor="#fff" fundo="rgba(42,36,32,0.45)" style={{ position: 'absolute', top: '16px', left: '16px', backdropFilter: 'blur(8px)' }}>
            <IconeVoltar />
          </BotaoIcone>
          {fotosImovel.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', padding: '10px 16px', overflowX: 'auto', background: 'rgba(0,0,0,0.55)' }}>
              {fotosImovel.map((f, i) => (
                <button key={i} onClick={() => setFotoAtiva(f)} aria-label={`Ver foto ${i + 1}`} aria-pressed={fotoAtiva === f} style={{ flexShrink: 0, padding: 0, border: `2px solid ${fotoAtiva === f ? '#fff' : 'transparent'}`, borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', background: 'none' }}>
                  <ImagemComFallback src={f} alt={`Foto ${i + 1}`} tipo="imovel" style={{ width: '64px', height: '48px', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* informações */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: '16px' }}>
            <h1 style={{ fontFamily: FONTE_TITULO, fontSize: '26px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>
              {profile.tituloAnuncio || `Vaga em ${profile.region}`}
            </h1>
            <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: '0 0 12px' }}>📍 {profile.region}</p>
            <p style={{ fontFamily: FONTE_TITULO, fontSize: '26px', fontWeight: 800, color: C.text, margin: 0 }}>
              {profile.budget} <span style={{ fontSize: '16px', fontWeight: 400, color: C.muted }}>/ mês</span>
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <CompatBadge value={profile.compat} large />
          </div>

          {profile.descricaoImovel && (
            <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.text, lineHeight: 1.7, marginBottom: '24px' }}>
              {profile.descricaoImovel}
            </p>
          )}

          {/* Sobre a vaga */}
          <CartaoSecao titulo="Sobre a vaga">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <LinhaInfo label="Tipo de imóvel" value={IMOVEL_LABEL[profile.tipoImovel] ?? profile.tipoImovel} />
              <LinhaInfo label="Moradores" value={rotuloMoradores(profile.qtdMoradores)} />
              <LinhaInfo label="Aceita pets" value={profile.pets ? 'Sim' : 'Não'} />
              <LinhaInfo label="Fumantes" value={profile.smoker ? 'Permitido' : 'Não permitido'} />
            </div>
          </CartaoSecao>

          {/* Anunciado por */}
          <div style={{ background: C.card, borderRadius: RAIO.card, padding: '16px 20px', marginBottom: '24px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ImagemComFallback src={profile.fotoPerfilUrl} alt={profile.name}
              style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
              tipo="avatar" iniciais={profile.name.charAt(0)} />
            <div>
              <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted, margin: '0 0 2px' }}>Anunciado por</p>
              <p style={{ fontFamily: FONTE_TITULO, fontSize: '15px', fontWeight: 700, color: C.text, margin: 0 }}>
                {profile.name.split(' ')[0]}, {profile.age} anos
              </p>
            </div>
          </div>

          {erroAcao && <div style={{ marginBottom: '12px' }}><MensagemErro>{erroAcao}</MensagemErro></div>}
          {!somenteLeitura && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <Btn label="✕ Recusar" outline onClick={handleRecusar} disabled={liking} />
              <Btn label={liking ? 'Enviando…' : '💛 Tenho interesse'} onClick={onLike ? handleLike : () => nav('match')} disabled={liking} />
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <button onClick={() => setShowDenuncia(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontFamily: FONTE_TEXTO, fontSize: '14px', fontWeight: 700, padding: '12px 8px', minHeight: '44px', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
              Denunciar este anúncio
            </button>
          </div>
        </div>
      {showDenuncia && profile.usuarioId && (
        <ReportModal denunciadoUsuarioId={profile.usuarioId} onClose={() => setShowDenuncia(false)} />
      )}
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
      {/* Photo column */}
      <div className="relative h-[340px] lg:h-screen lg:sticky lg:top-0 lg:w-[420px] lg:flex-shrink-0">
        <ImagemComFallback src={profile.photo} alt={profile.name} tipo="avatar" iniciais={profile.name.charAt(0)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.6) 0%, transparent 60%)' }} />
        <BotaoIcone ariaLabel="Voltar" onClick={() => nav(backScreen)} cor="#fff" fundo="rgba(42,36,32,0.45)" style={{ position: 'absolute', top: '16px', left: '16px', backdropFilter: 'blur(8px)' }}>
          <IconeVoltar />
        </BotaoIcone>
        {/* Desktop: name overlay on photo */}
        <div className="hidden lg:block" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '28px' }}>
          <h1 style={{ fontFamily: FONTE_TITULO, fontSize: '32px', fontWeight: 800, color: '#fff', margin: '0 0 4px', textShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>{profile.name}, {profile.age}</h1>
          <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: 'rgba(255,255,255,0.92)', margin: 0 }}>📍 {profile.region}</p>
        </div>
      </div>

      {/* Info column */}
      <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
        {/* Mobile: name shown here */}
        <div className="lg:hidden" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>{profile.name}, {profile.age}</h2>
            <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: 0 }}>📍 {profile.region}</p>
          </div>
          <CompatBadge value={profile.compat} large />
        </div>
        {/* Desktop: compat badge */}
        <div className="hidden lg:flex" style={{ justifyContent: 'flex-end', marginBottom: '16px' }}>
          <CompatBadge value={profile.compat} large />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {profile.tags.map(t => <Tag key={t} label={t} />)}
        </div>

        {profile.bio && <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.text, lineHeight: 1.7, marginBottom: '24px' }}>{profile.bio}</p>}

        <CartaoSecao titulo="Preferências de moradia">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <LinhaInfo label="Orçamento" value={profile.budget} />
            <LinhaInfo label="Tipo de imóvel" value={IMOVEL_LABEL[profile.tipoImovel] ?? profile.tipoImovel} />
            <LinhaInfo label="Moradores" value={rotuloMoradores(profile.qtdMoradores)} />
            <LinhaInfo label="Fumante" value={profile.smoker ? 'Sim' : 'Não'} />
            <LinhaInfo label="Aceita pets" value={profile.pets ? 'Sim' : 'Não'} />
          </div>
        </CartaoSecao>

        <CartaoSecao titulo="Convivência">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <LinhaInfo label="Horário" value={HORARIO_LABEL[profile.horario] ?? profile.horario} />
            <LinhaInfo label="Visitas" value={VISITAS_LABEL[profile.visitas] ?? profile.visitas} />
          </div>
        </CartaoSecao>

        <CartaoSecao titulo="Hábitos" style={{ marginBottom: '24px' }}>
          <ListaHabitos valores={[profile.organized, profile.messy, profile.ruido, profile.social]} />
        </CartaoSecao>

        {erroAcao && <div style={{ marginBottom: '12px' }}><MensagemErro>{erroAcao}</MensagemErro></div>}
        {!somenteLeitura && <Btn label={liking ? 'Enviando…' : '💛 Curtir perfil'} onClick={onLike ? handleLike : () => nav('match')} />}
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button onClick={() => setShowDenuncia(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontFamily: FONTE_TEXTO, fontSize: '14px', fontWeight: 700, padding: '12px 8px', minHeight: '44px', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
            Denunciar este perfil
          </button>
        </div>
      </div>
    {showDenuncia && profile.usuarioId && (
      <ReportModal denunciadoUsuarioId={profile.usuarioId} onClose={() => setShowDenuncia(false)} />
    )}
    </div>
  );
}

// ─── Filters Modal ────────────────────────────────────────────────────────────

function FiltersModal({ filters, onApply, onClear, onClose }: {
  filters: DiscoveryFilters;
  onApply: (f: DiscoveryFilters) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<DiscoveryFilters>({ ...filters });

  const set = <K extends keyof DiscoveryFilters>(k: K, v: DiscoveryFilters[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  const triBtn = (
    label: string,
    field: 'aceita_pets' | 'fumante',
  ) => (
    <div>
      <p style={ROTULO_ESTILO}>{label}</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        {(['indiferente', 'sim', 'nao'] as const).map(v => {
          const active = draft[field] === v;
          const lbl = v === 'indiferente' ? 'Indiferente' : v === 'sim' ? 'Sim' : 'Não';
          return (
            <button key={v} type="button" onClick={() => set(field, v)} aria-pressed={active} style={{ ...estiloOpcao(active), flex: 1, padding: '10px', fontSize: '14px' }}>
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );

  const TIPO_IMOVEL_OPTS = [
    { value: '', label: 'Qualquer' },
    { value: 'apartamento', label: 'Apartamento' },
    { value: 'casa', label: 'Casa' },
    { value: 'republica', label: 'República' },
    { value: 'indiferente', label: 'Indiferente' },
  ];

  return (
    <Modal
      titulo="Filtros" ariaLabel="Filtros de busca" rotuloFechar="Fechar filtros" onFechar={onClose} folha larguraMax="480px"
      rodape={(
        <div style={{ display: 'flex', gap: '12px' }}>
          <Btn label="Limpar filtros" outline onClick={onClear} />
          <Btn label="Aplicar filtros" onClick={() => onApply(draft)} />
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Input label="Região" placeholder="Ex: Boa Viagem, Casa Forte..." value={draft.regiao} onChange={v => set('regiao', v)} />

        <div>
          <p style={ROTULO_ESTILO}>Tipo de imóvel</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {TIPO_IMOVEL_OPTS.map(opt => (
              <Chip key={opt.value} ativo={draft.tipo_imovel === opt.value} onClick={() => set('tipo_imovel', opt.value)}>{opt.label}</Chip>
            ))}
          </div>
        </div>

        {triBtn('Aceita pets', 'aceita_pets')}
        {triBtn('Fumante', 'fumante')}

        <div>
          <p style={ROTULO_ESTILO}>Faixa de orçamento (R$)</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Input label="Mínimo" inputMode="decimal" placeholder="500" value={draft.orcamento_min} onChange={v => set('orcamento_min', v)} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="Máximo" inputMode="decimal" placeholder="2000" value={draft.orcamento_max} onChange={v => set('orcamento_max', v)} />
            </div>
          </div>
        </div>

        <div>
          <p style={ROTULO_ESTILO}>
            Compatibilidade mínima: <span style={{ color: C.primaryText }}>{draft.score_min}%</span>
          </p>
          <input
            type="range" min={0} max={100} step={5}
            value={draft.score_min}
            onChange={e => set('score_min', parseInt(e.target.value))}
            aria-label="Compatibilidade mínima"
            style={{ width: '100%', accentColor: C.primaryDark, minHeight: '32px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTE_TEXTO, fontSize: '12px', color: C.muted, marginTop: '2px' }}>
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>

        <div>
          <p style={ROTULO_ESTILO}>Ordenar por</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {([
              { value: 'compatibilidade', label: 'Mais compatível' },
              { value: 'menor_preco', label: 'Menor preço' },
              { value: 'maior_preco', label: 'Maior preço' },
            ] as const).map(opt => (
              <Chip key={opt.value} ativo={draft.ordenar === opt.value} onClick={() => set('ordenar', opt.value)}>{opt.label}</Chip>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Screen: Notifications ───────────────────────────────────────────────────

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `há ${horas} hora${horas !== 1 ? 's' : ''}`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `há ${dias} dia${dias !== 1 ? 's' : ''}`;
  const meses = Math.floor(dias / 30);
  return `há ${meses} mês${meses !== 1 ? 'es' : ''}`;
}

function NotificationsScreen({ nav, setCurrentChat, setActiveChatMatchId, meuPerfilId }: {
  nav: (s: Screen) => void;
  setCurrentChat: (p: Profile) => void;
  setActiveChatMatchId: (id: number) => void;
  meuPerfilId: number | null;
}) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = () => {
    setLoading(true);
    setErro('');
    const lastVisit = sessionStorage.getItem('pm_notif_last_visit');
    const agora = new Date().toISOString();
    listarMatches()
      .then(data => {
        const cutoff = lastVisit ? new Date(lastVisit) : null;
        const novos = cutoff ? data.filter(m => new Date(m.data_match) > cutoff) : data;
        // Grava a visita só depois de usar o corte anterior: no StrictMode (dev) o efeito roda duas
        // vezes e a segunda execução leria a visita recém-gravada, esvaziando a lista.
        sessionStorage.setItem('pm_notif_last_visit', agora);
        setMatches(novos);
        setLoading(false);
      })
      .catch((e: Error) => { setErro(e.message); setLoading(false); });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, []);

  const abrirChat = (m: MatchData) => {
    const outro = m.perfil_a.id === meuPerfilId ? m.perfil_b : m.perfil_a;
    setCurrentChat(perfilBasicoParaProfile(outro, m.score));
    setActiveChatMatchId(m.id);
    nav('chat');
  };

  return (
    <div className="flex flex-col flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
      <div style={{ padding: '20px 24px 12px' }}>
        <h1 style={{ ...ESTILO_TITULO_TELA, margin: '0 0 4px' }}>Notificações</h1>
        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted, margin: 0, minHeight: '18px' }}>
          {loading || erro ? '' : matches.length === 0 ? 'Tudo em dia.' : `${matches.length} novo${matches.length !== 1 ? 's' : ''} match${matches.length !== 1 ? 'es' : ''}`}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <EstadoCarregando texto="Carregando notificações…" />}

        {!loading && erro && <EstadoErro mensagem={erro} onTentarNovamente={carregar} />}

        {!loading && !erro && matches.length === 0 && (
          <EstadoVazio
            titulo="Nenhuma novidade"
            descricao="Quando alguém curtir você de volta, o match aparece aqui."
            icone={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}
            acao={{ rotulo: 'Ir para a Descoberta', onClick: () => nav('discovery') }}
          />
        )}

        {!loading && !erro && matches.map(m => {
          const outro = m.perfil_a.id === meuPerfilId ? m.perfil_b : m.perfil_a;
          const compat = Math.round(m.score * 100);
          const level = getCompatLevel(compat);
          const foto = fotoDaPessoa(outro);
          return (
            <button
              key={m.id}
              onClick={() => abrirChat(m)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 24px', minHeight: '72px', background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div style={{ flexShrink: 0, width: '58px', height: '58px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${level.color}` }}>
                <ImagemComFallback src={foto} alt={outro.nome} tipo="avatar" iniciais={outro.nome.charAt(0)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 700, color: C.text }}>
                    Novo match com {outro.nome}
                  </span>
                  <span title={dataBR(m.data_match)} style={{ fontFamily: FONTE_TEXTO, fontSize: '12px', color: C.muted, flexShrink: 0, marginLeft: '8px' }}>
                    {tempoRelativo(m.data_match)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Selo tom={level.tom}>{compat}% compatível</Selo>
                  <span style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted }}>
                    Abrir conversa →
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Screen: Match ────────────────────────────────────────────────────────────

function MatchScreen({ nav, profile, setCurrentChat }: {
  nav: (s: Screen) => void;
  profile: Profile;
  setCurrentChat: (p: Profile) => void;
}) {
  const primeiroNome = profile.name.split(' ')[0];
  const eAnuncio = profile.tipo === 'oferecendo_vaga';

  return (
    <div
      className="flex flex-col flex-1 items-center justify-center"
      style={{ background: C.bg, padding: '32px 16px', minHeight: '100dvh', overflowY: 'auto' }}
    >
      {/* Cabeçalho */}
      <div style={{ textAlign: 'center', marginBottom: '24px', maxWidth: '420px', width: '100%' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%',
          background: `${C.mint}22`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 14px',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.mintText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <h1 style={{ ...ESTILO_TITULO_TELA, margin: '0 0 8px' }}>
          Interesse mútuo confirmado
        </h1>
        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: 0, lineHeight: 1.5 }}>
          Vocês dois demonstraram interesse. Conversem para combinar os detalhes da vaga.
        </p>
      </div>

      {/* Cartão */}
      <div style={{
        width: '100%', maxWidth: '420px',
        background: C.card, borderRadius: RAIO.card,
        border: `1px solid ${C.border}`,
        boxShadow: SOMBRA.card,
        overflow: 'hidden',
        marginBottom: '20px',
      }}>
        {eAnuncio ? (
          <>
            {/* Foto 4:3 */}
            <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden' }}>
              <ImagemComFallback
                src={profile.fotosImovel?.[0]}
                alt={profile.tituloAnuncio ?? profile.name}
                tipo="imovel"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            {/* Informações */}
            <div style={{ padding: '18px 20px 20px' }}>
              <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '17px', fontWeight: 800, color: C.text, margin: '0 0 5px' }}>
                {profile.tituloAnuncio ?? profile.name}
              </h2>
              <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted, margin: '0 0 8px' }}>
                📍 {profile.region} · {IMOVEL_LABEL[profile.tipoImovel] ?? profile.tipoImovel} · {rotuloMoradores(profile.qtdMoradores)}
              </p>
              <p style={{ fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 12px' }}>
                {profile.budget}
                <span style={{ fontFamily: FONTE_TEXTO, fontWeight: 400, fontSize: '13px', color: C.muted }}> / mês</span>
              </p>
              <div style={{ marginBottom: '14px' }}><CompatBadge value={profile.compat} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                  <ImagemComFallback
                    src={profile.fotoPerfilUrl}
                    alt={primeiroNome}
                    tipo="avatar"
                    iniciais={primeiroNome.charAt(0)}
                    style={{ width: '28px', height: '28px', objectFit: 'cover' }}
                  />
                </div>
                <span style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted }}>
                  Anunciado por <strong style={{ color: C.text }}>{primeiroNome}</strong>
                </span>
              </div>
            </div>
          </>
        ) : (
          /* Perfil de pessoa */
          <div style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${C.border}` }}>
              <ImagemComFallback
                src={profile.fotoPerfilUrl ?? profile.photo}
                alt={profile.name}
                tipo="avatar"
                iniciais={profile.name.charAt(0)}
                style={{ width: '80px', height: '80px', objectFit: 'cover' }}
              />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '20px', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
                {profile.name}
              </h2>
              <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: 0 }}>
                {profile.age} anos · {profile.region}
              </p>
            </div>
            <CompatBadge value={profile.compat} />
          </div>
        )}
      </div>

      {/* Botões */}
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Btn label="Enviar mensagem" onClick={() => { setCurrentChat(profile); nav('chat'); }} />
        <Btn label="Ver meus matches" outline onClick={() => nav('matches')} />
        <Botao variante="texto" larguraTotal onClick={() => nav('discovery')}>Continuar buscando</Botao>
      </div>
    </div>
  );
}

// ─── Screen: Matches List ─────────────────────────────────────────────────────

function conversaParaProfile(c: Conversa): Profile {
  const p = c.outro_perfil;
  return {
    id: p.id,
    name: p.nome,
    age: p.idade,
    region: p.regiao,
    bio: '',
    compat: Math.round(c.score * 100),
    photo: fotoDaPessoa(p),
    tags: [],
    budget: '',
    smoker: false, pets: false, organized: 3, messy: 3,
    horario: 'flexivel', ruido: 3, social: 3,
    visitas: 'as_vezes', tipoImovel: 'indiferente', qtdMoradores: 2,
    usuarioId: p.usuario_id,
  };
}

function MatchesScreen({ nav, setCurrentChat, setActiveChatMatchId }: {
  nav: (s: Screen) => void;
  setCurrentChat: (p: Profile) => void;
  setActiveChatMatchId: (id: number) => void;
}) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [search, setSearch] = useState('');
  const [naoLidas, setNaoLidas] = useState(false);
  const matchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current); }, []);

  const carregar = (q: string, nl: boolean) => {
    setLoading(true);
    setErro('');
    listarConversas({ q: q || undefined, nao_lidas: nl || undefined })
      .then(data => { setConversas(data); setLoading(false); })
      .catch((e: Error) => { setErro(e.message); setLoading(false); });
  };

  useEffect(() => { carregar('', false); }, []); // eslint-disable-line

  const handleMatchSearch = (q: string) => {
    setSearch(q);
    if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);
    matchDebounceRef.current = setTimeout(() => carregar(q, naoLidas), 400);
  };

  const handleNaoLidasToggle = (v: boolean) => {
    setNaoLidas(v);
    carregar(search, v);
  };

  const abrirChat = (c: Conversa) => {
    setCurrentChat(conversaParaProfile(c));
    setActiveChatMatchId(c.match_id);
    nav('chat');
  };

  return (
    <div className="flex flex-col flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
      <div style={{ padding: '20px 24px 12px' }}>
        <h1 style={{ ...ESTILO_TITULO_TELA, margin: '0 0 4px' }}>Seus Matches</h1>
        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted, margin: 0, minHeight: '18px' }}>
          {loading || erro ? '' : `${conversas.length} conversa${conversas.length !== 1 ? 's' : ''}`}
        </p>
        {/* Search + nao_lidas */}
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" aria-hidden="true"
              style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="search"
              value={search}
              onChange={e => handleMatchSearch(e.target.value)}
              placeholder="Buscar conversa..."
              aria-label="Buscar conversa"
              style={{ ...estiloCampo({ compacto: true }), width: '100%', minHeight: '44px', padding: '10px 12px 10px 38px' }}
            />
          </div>
          <Chip ativo={naoLidas} onClick={() => handleNaoLidasToggle(!naoLidas)}>Só não lidas</Chip>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <EstadoCarregando texto="Carregando conversas…" />}

        {!loading && erro && <EstadoErro mensagem={erro} onTentarNovamente={() => carregar(search, naoLidas)} />}

        {!loading && !erro && conversas.length === 0 && (search || naoLidas) && (
          <EstadoVazio titulo="Nenhuma conversa encontrada" descricao="Tente outros termos ou remova os filtros aplicados." />
        )}
        {!loading && !erro && conversas.length === 0 && !search && !naoLidas && (
          <EstadoVazio
            titulo="Você ainda não tem matches"
            descricao="Curta perfis na Descoberta. Quando alguém curtir você de volta, a conversa aparece aqui."
            icone={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>}
            acao={{ rotulo: 'Ir para a Descoberta', onClick: () => nav('discovery') }}
          />
        )}

        {/* Mobile: lista */}
        {!loading && !erro && (
          <div className="md:hidden" style={{ paddingTop: '8px' }}>
            {conversas.map(c => {
              const profile = conversaParaProfile(c);
              const level = getCompatLevel(profile.compat);
              const preview = c.ultima_mensagem?.conteudo ?? 'Diga olá! 👋';
              return (
                <button key={c.match_id} onClick={() => abrirChat(c)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 24px', minHeight: '72px', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: '58px', height: '58px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${level.color}` }}>
                      <ImagemComFallback src={profile.photo} alt={profile.name} tipo="avatar" iniciais={profile.name.charAt(0)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{
                      position: 'absolute', bottom: '-4px', right: '-6px',
                      background: '#fff', borderRadius: '10px', border: `2px solid ${level.color}`,
                      padding: '0 5px', fontSize: '11px', fontWeight: 800,
                      fontFamily: FONTE_TITULO, color: level.texto, lineHeight: '16px',
                    }}>
                      {profile.compat}%
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 700, color: C.text }}>{profile.name}</span>
                      {c.nao_lidas > 0 && <Contador n={c.nao_lidas} rotulo={textoNaoLidas(c.nao_lidas, 'mensagem não lida', 'mensagens não lidas')} style={{ flexShrink: 0 }} />}
                    </div>
                    <p style={{
                      fontFamily: FONTE_TEXTO, fontSize: '13px',
                      color: c.nao_lidas > 0 ? C.text : C.muted,
                      fontWeight: c.nao_lidas > 0 ? 700 : 400,
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {preview}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Tablet/Desktop: grid */}
        {!loading && !erro && (
          <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {conversas.map(c => {
              const profile = conversaParaProfile(c);
              const level = getCompatLevel(profile.compat);
              const preview = c.ultima_mensagem?.conteudo ?? 'Diga olá! 👋';
              return (
                <button key={c.match_id} onClick={() => abrirChat(c)} style={{
                  display: 'flex', flexDirection: 'column', background: C.card,
                  border: `1px solid ${C.border}`, borderRadius: RAIO.card, overflow: 'hidden',
                  cursor: 'pointer', textAlign: 'left', padding: 0,
                  boxShadow: SOMBRA.card, position: 'relative',
                }}>
                  {c.nao_lidas > 0 && (
                    <Selo tom="coral" style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 2, background: C.primaryDark, color: '#fff' }}>
                      <span aria-hidden="true">{c.nao_lidas} nova{c.nao_lidas !== 1 ? 's' : ''}</span>
                      <span className="sr-only">{textoNaoLidas(c.nao_lidas, 'mensagem não lida', 'mensagens não lidas')}</span>
                    </Selo>
                  )}
                  <div style={{ position: 'relative', height: '210px', flexShrink: 0 }}>
                    <ImagemComFallback src={profile.photo} alt={profile.name} tipo="avatar" iniciais={profile.name.charAt(0)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} />
                    <Selo tom={level.tom} style={{ position: 'absolute', top: '10px', left: '10px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                      {level.label} · {profile.compat}%
                    </Selo>
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>
                      <span style={{ fontFamily: FONTE_TITULO, fontSize: '15px', fontWeight: 700, color: C.text }}>{profile.name}</span>
                      <span style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted, marginLeft: '6px' }}>{profile.age} anos · {profile.region}</span>
                    </div>
                    <p style={{
                      fontFamily: FONTE_TEXTO, fontSize: '13px',
                      color: c.nao_lidas > 0 ? C.text : C.muted,
                      fontWeight: c.nao_lidas > 0 ? 700 : 400,
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {preview}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Screen: Chat ─────────────────────────────────────────────────────────────

/** Junta mensagens novas às atuais sem repetir ids (o envio e o polling podem trazer a mesma mensagem). */
function juntarMensagens(atuais: MensagemAPI[], novas: MensagemAPI[]): MensagemAPI[] {
  const ids = new Set(atuais.map(m => m.id));
  const inedit = novas.filter(m => !ids.has(m.id));
  return inedit.length > 0 ? [...atuais, ...inedit] : atuais;
}

function ChatScreen({ nav, profile, matchId, meuPerfilId, showReport, setShowReport, onVerPerfil }: {
  onVerPerfil: () => void;
  nav: (s: Screen) => void;
  profile: Profile;
  matchId: number;
  meuPerfilId: number;
  showReport: boolean;
  setShowReport: (v: boolean) => void;
}) {
  const [messages, setMessages] = useState<MensagemAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [semConexao, setSemConexao] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number>(0);
  const loadedRef = useRef(false);

  const carregarMensagens = () => {
    setLoading(true);
    setErro('');
    listarMensagens(matchId)
      .then(msgs => {
        setMessages(msgs);
        lastIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
        loadedRef.current = true;
        setLoading(false);
      })
      .catch((e: Error) => { setErro(e.message); setLoading(false); });
  };

  // Carga inicial
  useEffect(() => {
    loadedRef.current = false;
    carregarMensagens();
  }, [matchId]);

  // Polling a cada 4 s — só mensagens novas, pausa quando aba está oculta
  useEffect(() => {
    const poll = async () => {
      if (!loadedRef.current || document.hidden) return;
      try {
        const novas = await listarMensagens(matchId, lastIdRef.current);
        setSemConexao(false);
        if (novas.length > 0) {
          setMessages(prev => juntarMensagens(prev, novas));
          lastIdRef.current = Math.max(lastIdRef.current, novas[novas.length - 1].id);
        }
      } catch { setSemConexao(true); /* o próximo ciclo tenta de novo */ }
    };
    const timer = setInterval(poll, 4000);
    return () => clearInterval(timer);
  }, [matchId]);

  // Rola para a última mensagem ao receber novas
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const texto = input.trim();
    if (!texto || sending) return;
    setSending(true);
    setSendError('');
    setInput('');
    try {
      const nova = await enviarMensagem(matchId, texto);
      setMessages(prev => juntarMensagens(prev, [nova]));
      lastIdRef.current = Math.max(lastIdRef.current, nova.id);
    } catch (e: unknown) {
      setInput(texto);
      setSendError(e instanceof Error ? e.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Hoje: só a hora. Outros dias: data e hora (dd/mm hh:mm).
  const formatTime = (dt: string) => {
    const d = new Date(dt);
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString()
      ? hora
      : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`;
  };

  return (
    <div className="flex flex-col flex-1" style={{ background: C.bg, overflow: 'hidden' }}>
      <div className="flex flex-col flex-1 w-full max-w-3xl mx-auto" style={{ overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', background: C.card, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <BotaoIcone ariaLabel="Voltar" onClick={() => nav('matches')}>
            <IconeVoltar tamanho={22} />
          </BotaoIcone>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.primary}` }}>
            <ImagemComFallback src={profile.photo} alt={profile.name} tipo="avatar" iniciais={profile.name.charAt(0)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</p>
            <CompatBadge value={profile.compat} />
          </div>
          <div style={{ position: 'relative' }}>
            <BotaoIcone ariaLabel="Mais opções" onClick={() => setShowMenu(m => !m)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </BotaoIcone>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: '48px', background: C.card, borderRadius: RAIO.botao, boxShadow: SOMBRA.menu, border: `1px solid ${C.border}`, zIndex: 50, minWidth: '180px', overflow: 'hidden' }}>
                {['Ver perfil', 'Denunciar'].map(opt => (
                  <button key={opt} onClick={() => { setShowMenu(false); if (opt === 'Denunciar') setShowReport(true); if (opt === 'Ver perfil') onVerPerfil(); }} style={{
                    display: 'block', width: '100%', padding: '12px 16px', minHeight: '48px',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontFamily: FONTE_TEXTO, fontSize: '15px', fontWeight: 700,
                    color: opt === 'Denunciar' ? C.danger : C.text,
                  }}>{opt}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading && <EstadoCarregando texto="Carregando mensagens…" />}
          {!loading && erro && <EstadoErro mensagem={erro} onTentarNovamente={carregarMensagens} />}
          {!loading && !erro && messages.length === 0 && (
            <EstadoVazio titulo="Nenhuma mensagem ainda" descricao="Diga olá! Combinem os detalhes da vaga por aqui." />
          )}
          {messages.map(msg => {
            const isMe = msg.remetente_id === meuPerfilId;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '70%', padding: '11px 15px',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMe ? C.primaryDark : C.card,
                  color: isMe ? '#fff' : C.text,
                  border: isMe ? 'none' : `1px solid ${C.border}`,
                  boxShadow: '0 2px 8px rgba(42,36,32,0.06)',
                }}>
                  <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', lineHeight: 1.5, margin: '0 0 4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.conteudo}</p>
                  <p style={{ fontFamily: FONTE_TEXTO, fontSize: '11px', color: isMe ? 'rgba(255,255,255,0.88)' : C.muted, margin: 0, textAlign: 'right' }}>
                    {formatTime(msg.data_envio)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {semConexao && (
          <div role="status" style={{ padding: '6px 16px', background: C.bg, borderTop: `1px solid ${C.border}`, textAlign: 'center' }}>
            <p style={{ fontFamily: FONTE_TEXTO, fontSize: '12px', color: C.muted, margin: 0 }}>Sem conexão, tentando novamente…</p>
          </div>
        )}

        {/* Erro de envio */}
        {sendError && (
          <div role="alert" style={{ padding: '8px 16px', background: C.dangerSoft, borderTop: `1px solid ${C.danger}30` }}>
            <p style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.danger, margin: 0 }}>{sendError}</p>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '10px 14px 24px', background: C.card, borderTop: `1px solid ${C.border}`, display: 'flex', gap: '10px', alignItems: 'flex-end', flexShrink: 0 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem..."
              aria-label="Mensagem"
              maxLength={1000}
              rows={1}
              style={{
                ...estiloCampo({ fundo: C.bg }), width: '100%', minHeight: '46px', padding: '12px 18px', borderRadius: '23px',
                resize: 'none', display: 'block',
              }}
            />
            {input.length > 900 && (
              <span style={{ position: 'absolute', bottom: '-16px', right: '8px', fontSize: '11px', color: input.length >= 1000 ? C.danger : C.muted, fontFamily: FONTE_TEXTO }}>
                {input.length}/1000
              </span>
            )}
          </div>
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            aria-label="Enviar mensagem"
            style={{
              width: '46px', height: '46px', borderRadius: '50%', border: 'none',
              background: sending || !input.trim() ? C.borderStrong : C.primaryDark,
              cursor: sending || !input.trim() ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
            {sending ? (
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            )}
          </button>
        </div>
      </div>

      {showReport && <ReportModal denunciadoUsuarioId={profile.usuarioId ?? 0} onClose={() => setShowReport(false)} />}
    </div>
  );
}

// ─── Screen: My Profile ───────────────────────────────────────────────────────

function MyProfileScreen({ meuPerfil, tipo, onPerfilAtualizado, onPerfilExcluido, onLogout }: {
  onLogout: () => void;
  meuPerfil: PerfilAPI | null;
  tipo: string;
  onPerfilAtualizado: (p: PerfilAPI) => void;
  onPerfilExcluido: () => void;
}) {
  const anuncio = tipo === 'oferecendo_vaga';
  const [editing, setEditing] = useState(false);
  const [form, setFormState] = useState<PerfilForm>(FORM_VAZIO);
  const setForm = (p: Partial<PerfilForm>) => setFormState(f => ({ ...f, ...p }));
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (meuPerfil) setFormState(perfilParaForm(meuPerfil));
  }, [meuPerfil]);

  const cancelarEdicao = () => {
    if (meuPerfil) setFormState(perfilParaForm(meuPerfil));
    setEditFieldErrors({});
    setErro('');
    setEditing(false);
  };

  const salvar = async () => {
    if (!meuPerfil) return;
    const todos = Object.values(CAMPOS_ETAPA).flat();
    const erros = validarPerfil(form, todos, anuncio);
    setEditFieldErrors(erros);
    if (Object.keys(erros).length > 0) {
      setErro('Corrija os campos destacados e tente novamente.');
      return;
    }

    setErro('');
    setLoading(true);
    try {
      const atualizado = await apiAtualizarPerfil(meuPerfil.id, montarPayload(form, anuncio));
      onPerfilAtualizado(atualizado);
      setEditing(false);
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setEditFieldErrors(e.fieldErrors);
        setErro(Object.keys(e.fieldErrors).length > 0 ? 'Corrija os campos destacados e tente novamente.' : e.message);
      } else {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
      }
    } finally {
      setLoading(false);
    }
  };

  const excluir = async () => {
    if (!meuPerfil) return;
    setErro('');
    setLoading(true);
    try {
      await apiExcluirPerfil(meuPerfil.id);
      onPerfilExcluido();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir perfil.');
      setShowDeleteModal(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => onLogout();

  if (!meuPerfil) {
    return <div className="flex flex-1 items-center justify-center" style={{ background: C.bg }}><EstadoCarregando texto="Carregando perfil…" /></div>;
  }

  return (
    <div className="flex flex-col flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
      <div style={{ padding: '20px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <h1 style={ESTILO_TITULO_TELA}>Meu Perfil</h1>
        {editing
          ? <div style={{ display: 'flex', gap: '8px' }}>
              <Botao variante="neutro" tamanho="compacto" onClick={cancelarEdicao} disabled={loading}>Cancelar</Botao>
              <Botao tamanho="compacto" onClick={salvar} disabled={loading}>{loading ? 'Salvando…' : 'Salvar'}</Botao>
            </div>
          : <Botao variante="secundario" tamanho="compacto" onClick={() => setEditing(true)}>Editar</Botao>
        }
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        <div className="lg:flex lg:gap-8 lg:items-start">

          {/* Coluna esquerda: avatar + tags (no desktop as tags ficam aqui) */}
          <div className="lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-6">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '20px', background: C.card, borderRadius: RAIO.card, border: `1px solid ${C.border}` }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${C.primary}`, flexShrink: 0 }}>
                <ImagemComFallback src={fotoDaPessoa(meuPerfil)} alt={meuPerfil.nome} tipo="avatar" iniciais={meuPerfil.nome.charAt(0)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontFamily: FONTE_TITULO, fontSize: '20px', fontWeight: 800, color: C.text, margin: '0 0 2px' }}>{meuPerfil.nome}</h2>
                <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: '0 0 6px' }}>{meuPerfil.idade} anos · {meuPerfil.regiao}</p>
                <Selo tom={anuncio ? 'mint' : 'coral'}>{anuncio ? 'Oferecendo vaga' : 'Buscando vaga'}</Selo>
              </div>
            </div>

            {/* Tags no desktop (só no modo de visualização) */}
            {!editing && (
              <div className="hidden lg:flex" style={{ gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {buildTags(meuPerfil).map(t => <Tag key={t} label={t} />)}
              </div>
            )}
          </div>

          {/* Coluna direita: conteúdo + ações */}
          <div className="flex-1">
            {erro && <div style={{ marginBottom: '12px' }}><MensagemErro>{erro}</MensagemErro></div>}

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
                <EtapaPessoal form={form} setForm={setForm} errors={editFieldErrors} />
                <EtapaMoradia form={form} setForm={setForm} errors={editFieldErrors} />
                <EtapaConvivencia form={form} setForm={setForm} errors={editFieldErrors} />
                <EtapaHabitos form={form} setForm={setForm} errors={editFieldErrors} />
                {anuncio && (
                  <div>
                    <h3 style={{ fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 800, color: C.text, margin: '0 0 14px' }}>Anúncio do imóvel</h3>
                    <EtapaAnuncio form={form} setForm={setForm} errors={editFieldErrors} />
                  </div>
                )}
              </div>
            ) : (
              <>
                <CartaoSecao titulo="Sobre mim">
                  <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: meuPerfil.bio ? C.text : C.muted, lineHeight: 1.7, margin: 0 }}>{meuPerfil.bio || 'Você ainda não escreveu uma apresentação.'}</p>
                </CartaoSecao>

                <CartaoSecao titulo="Preferências de moradia">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <LinhaInfo label="Orçamento" value={faixaMoedaBR(meuPerfil.orcamento_min, meuPerfil.orcamento_max)} />
                    <LinhaInfo label="Tipo de imóvel" value={IMOVEL_LABEL[meuPerfil.tipo_imovel] ?? meuPerfil.tipo_imovel} />
                    <LinhaInfo label="Moradores" value={rotuloMoradores(meuPerfil.qtd_moradores)} />
                    <LinhaInfo label="Fumante" value={meuPerfil.fumante ? 'Sim' : 'Não'} />
                    <LinhaInfo label="Aceita pets" value={meuPerfil.aceita_pets ? 'Sim' : 'Não'} />
                  </div>
                </CartaoSecao>

                <CartaoSecao titulo="Convivência">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <LinhaInfo label="Horário" value={HORARIO_LABEL[meuPerfil.perfil_horario]} />
                    <LinhaInfo label="Visitas" value={VISITAS_LABEL[meuPerfil.aceita_visitas]} />
                  </div>
                </CartaoSecao>

                <CartaoSecao titulo="Hábitos">
                  <ListaHabitos valores={[meuPerfil.nivel_organizacao, meuPerfil.tolerancia_bagunca, meuPerfil.nivel_ruido, meuPerfil.nivel_social]} />
                </CartaoSecao>

                {anuncio && meuPerfil && (meuPerfil.titulo_anuncio || meuPerfil.descricao_imovel || (meuPerfil.fotos_imovel?.length ?? 0) > 0) && (
                  <CartaoSecao titulo="Meu anúncio">
                    {meuPerfil.titulo_anuncio && <p style={{ fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>{meuPerfil.titulo_anuncio}</p>}
                    {meuPerfil.descricao_imovel && <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.text, lineHeight: 1.7, margin: '0 0 12px' }}>{meuPerfil.descricao_imovel}</p>}
                    {(meuPerfil.fotos_imovel?.length ?? 0) > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {meuPerfil.fotos_imovel!.map((u, i) => (
                          <div key={u + i} style={{ width: '112px', height: '84px', borderRadius: RAIO.campo, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                            <ImagemComFallback src={u} alt={`Foto ${i + 1} do imóvel`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </CartaoSecao>
                )}

                {/* Tags no celular */}
                <div className="lg:hidden" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                  {buildTags(meuPerfil).map(t => <Tag key={t} label={t} />)}
                </div>
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Btn label="Sair da conta" outline onClick={handleLogout} />
              {meuPerfil && <Btn label="Excluir perfil" danger outline onClick={() => setShowDeleteModal(true)} />}
            </div>
            {showDeleteModal && (
              <DeleteProfileModal
                onClose={() => setShowDeleteModal(false)}
                onConfirm={excluir}
                loading={loading}
              />
            )}
          </div>

        </div>
      </div>

    </div>
  );
}

// ─── Delete Profile Modal ─────────────────────────────────────────────────────

function DeleteProfileModal({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <Modal titulo="Excluir perfil?" ariaLabel="Excluir perfil" rotuloFechar="Fechar" onFechar={onClose} podeFechar={!loading} larguraMax="420px">
      <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.muted, margin: '0 0 24px', lineHeight: 1.6 }}>
        Ao excluir seu perfil, você perderá todas as suas curtidas, matches e conversas. Esta ação não pode ser desfeita.
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <Btn label="Cancelar" outline onClick={onClose} disabled={loading} />
        <Btn label={loading ? 'Excluindo…' : 'Excluir definitivamente'} danger onClick={onConfirm} disabled={loading} />
      </div>
    </Modal>
  );
}

// ─── Report Modal ─────────────────────────────────────────────────────────────

const MOTIVOS_UI = [
  { value: 'spam', label: 'Spam' },
  { value: 'ofensivo', label: 'Conteúdo ofensivo' },
  { value: 'falso', label: 'Perfil falso' },
  { value: 'outro', label: 'Outro' },
];

function ReportModal({ onClose, denunciadoUsuarioId }: { onClose: () => void; denunciadoUsuarioId: number }) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const fecharEmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (fecharEmRef.current) clearTimeout(fecharEmRef.current); }, []);

  const handleEnviar = async () => {
    if (!motivo) { setErro('Selecione um motivo.'); return; }
    setErro('');
    setLoading(true);
    try {
      await criarDenuncia(denunciadoUsuarioId, motivo, descricao);
      setSucesso(true);
      fecharEmRef.current = setTimeout(onClose, 2500);
    } catch (e: unknown) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível enviar a denúncia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal titulo="Denunciar usuário" rotuloFechar="Fechar denúncia" onFechar={onClose} folha={!sucesso} larguraMax="440px">
      {sucesso ? (
        <div role="status" style={{ textAlign: 'center', padding: '16px 0 8px' }}>
          <p style={{ fontFamily: FONTE_TITULO, fontSize: '18px', fontWeight: 800, color: C.mintText, margin: '0 0 8px' }}>Denúncia enviada!</p>
          <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: 0 }}>Nossa equipe vai analisar.</p>
        </div>
      ) : (
        <>
          <p style={{ ...ROTULO_ESTILO, marginBottom: '10px' }}>Motivo</p>
          <div role="group" aria-label="Motivo da denúncia" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {MOTIVOS_UI.map(m => (
              <button key={m.value} type="button" aria-pressed={motivo === m.value} onClick={() => { setMotivo(m.value); setErro(''); }} style={{
                padding: '12px 16px', borderRadius: RAIO.campo, cursor: 'pointer', textAlign: 'left', minHeight: '48px',
                border: `2px solid ${motivo === m.value ? C.danger : C.border}`,
                background: motivo === m.value ? C.dangerSoft : C.card,
                color: motivo === m.value ? C.danger : C.text,
                fontFamily: FONTE_TEXTO, fontSize: '15px', fontWeight: 700,
              }}>
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <CampoTexto label="Descrição (opcional)" placeholder="Descreva o ocorrido com mais detalhes..." value={descricao} onChange={v => setDescricao(v.slice(0, 500))} max={500} altura={88} />
          </div>

          {erro && <div style={{ marginBottom: '12px' }}><MensagemErro>{erro}</MensagemErro></div>}

          <div style={{ display: 'flex', gap: '10px' }}>
            <Btn label="Cancelar" outline onClick={onClose} />
            <Btn label={loading ? 'Enviando…' : 'Enviar denúncia'} danger onClick={handleEnviar} disabled={loading} />
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function getParam(name: string) {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

// Navegação: a tela atual fica na URL (?screen=...) e no histórico do navegador.
// As telas de recuperação de senha são públicas: quem está logado e abre o link continua nela (a senha nova encerra a sessão).
const TELAS_PUBLICAS: Screen[] = ['welcome', 'login', 'register', 'esqueci-senha', 'redefinir-senha'];
const TELAS_DE_ABA: Screen[] = ['discovery', 'notifications', 'matches', 'profile'];
// Dependem de estado em memória (perfil/conversa escolhidos): ao abrir direto pela URL, voltam à tela-mãe.
const TELA_SEM_ESTADO: Partial<Record<Screen, Screen>> = { 'profile-detail': 'discovery', match: 'matches', chat: 'matches' };

const TITULO_DA_TELA: Record<Screen, string> = {
  welcome: '', login: 'Entrar', register: 'Criar conta', 'esqueci-senha': 'Esqueci minha senha', 'redefinir-senha': 'Nova senha', 'profile-create': 'Criar perfil',
  discovery: 'Descoberta', 'profile-detail': 'Detalhes', match: 'Interesse mútuo', matches: 'Matches',
  chat: 'Conversa', profile: 'Meu Perfil', notifications: 'Notificações', admin: 'Painel administrativo',
};

function temSessao(): boolean {
  try { return !!sessionStorage.getItem('pm_access'); } catch { return false; }
}

function registrarTelaNaUrl(s: Screen, substituir: boolean, matchId?: number) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('screen', s);
    // O link do e-mail traz uid e token: saem da URL logo que são lidos (histórico e barra de endereço não os guardam).
    url.searchParams.delete('uid');
    url.searchParams.delete('token');
    // O chat guarda o id do match na URL para a conversa poder ser reaberta ao recarregar.
    if (s === 'chat' && matchId) url.searchParams.set('match', String(matchId));
    else url.searchParams.delete('match');
    const estado = { screen: s, match: s === 'chat' ? matchId : undefined };
    if (substituir) window.history.replaceState(estado, '', url);
    else window.history.pushState(estado, '', url);
  } catch { /* ambiente sem history */ }
}

export default function App() {
  const telaDaUrl = (getParam('screen') as Screen) || (temSessao() ? 'discovery' : 'welcome');
  const initialScreen: Screen = temSessao()
    ? (telaDaUrl === 'chat' && Number(getParam('match')) > 0 ? 'chat' : (TELA_SEM_ESTADO[telaDaUrl] ?? telaDaUrl))
    : telaDaUrl;
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [restaurando, setRestaurando] = useState<boolean>(temSessao());
  const [tab, setTab] = useState<Tab>(
    (initialScreen === 'discovery' || initialScreen === 'notifications' || initialScreen === 'matches' || initialScreen === 'profile')
      ? (initialScreen as Tab)
      : 'discovery'
  );
  const [matchProfile, setMatchProfile] = useState<Profile>(PERFIL_VAZIO);
  const [selectedProfile, setSelectedProfile] = useState<Profile>(PERFIL_VAZIO);
  const [currentChat, setCurrentChat] = useState<Profile>(PERFIL_VAZIO);
  const matchNaUrl = Number(getParam('match')) || 0;
  // uid e token do link de redefinição de senha: lidos uma vez e guardados em memória (a URL é limpa em seguida).
  const [linkSenha] = useState(() => ({ uid: getParam('uid') ?? '', token: getParam('token') ?? '' }));
  const matchRef = useRef<number>(0);
  const [activeChatMatchId, setActiveChatMatchIdState] = useState<number>(0);
  // Atualiza a ref de forma síncrona: a URL do chat é gravada logo depois, no mesmo clique.
  const setActiveChatMatchId = (id: number) => { matchRef.current = id; setActiveChatMatchIdState(id); };
  const [showFilters, setShowFilters] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [meuPerfil, setMeuPerfil] = useState<PerfilAPI | null>(null);
  const [meuTipo, setMeuTipo] = useState('');
  const [matchesKey, setMatchesKey] = useState(0);
  const [notifsKey, setNotifsKey] = useState(0);
  const [notifsCount, setNotifsCount] = useState(0);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState('');
  const [prevScreen, setPrevScreen] = useState<Screen>('discovery');

  const nav = (s: Screen) => {
    setScreen(s);
    if (s !== screen) registrarTelaNaUrl(s, false, matchRef.current);
    if (s === 'discovery' || s === 'notifications' || s === 'matches' || s === 'profile') setTab(s as Tab);
    if (s === 'matches') setMatchesKey(k => k + 1);
    if (s === 'notifications') { setNotifsKey(k => k + 1); setNotifsCount(0); }
  };

  const atualizarNotifsCount = async () => {
    try {
      const ms = await listarMatches();
      const lastVisit = sessionStorage.getItem('pm_notif_last_visit');
      const cutoff = lastVisit ? new Date(lastVisit) : null;
      const count = cutoff ? ms.filter(m => new Date(m.data_match) > cutoff).length : ms.length;
      setNotifsCount(count);
    } catch { /* silent */ }
  };

  const handleLogout = () => {
    sairDaConta();
    setMeuPerfil(null);
    setMeuTipo('');
    setNotifsCount(0);
    setActiveChatMatchId(0);
    setCurrentChat(PERFIL_VAZIO);
    setSelectedProfile(PERFIL_VAZIO);
    setSessionExpiredMsg('');
    nav('welcome');
  };

  useEffect(() => {
    setOn401(() => {
      setMeuPerfil(null);
      setMeuTipo('');
      setNotifsCount(0);
      setActiveChatMatchId(0);
      setCurrentChat(PERFIL_VAZIO);
      setSelectedProfile(PERFIL_VAZIO);
      setSessionExpiredMsg('Sua sessão expirou. Entre novamente.');
      setScreen('login');
      registrarTelaNaUrl('login', true);
      setTab('discovery');
    });
  }, []);

  // Estado inicial da URL no histórico + botão voltar/avançar do navegador.
  useEffect(() => {
    registrarTelaNaUrl(initialScreen, true, matchNaUrl);
    const onPop = (e: PopStateEvent) => {
      const est = e.state as { screen?: Screen; match?: number } | null;
      const s = (est?.screen ?? (getParam('screen') as Screen | null) ?? 'welcome') as Screen;
      // Um item de chat do histórico só vale se for a conversa que está carregada; senão, volta aos matches.
      if (s === 'chat' && est?.match !== matchRef.current) {
        setScreen('matches');
        registrarTelaNaUrl('matches', true);
        return;
      }
      setScreen(s);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada tela abre no topo (a rolagem da tela anterior não deve ser herdada).
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);

  // Título da aba do navegador conforme a tela.
  useEffect(() => {
    const t = TITULO_DA_TELA[screen];
    document.title = t ? `${t} · PlaceMatch` : 'PlaceMatch — Encontre quem combina com seu jeito de morar';
  }, [screen]);

  // A aba do menu acompanha a tela atual (também ao voltar pelo navegador).
  useEffect(() => {
    if (TELAS_DE_ABA.includes(screen)) setTab(screen as Tab);
  }, [screen]);

  // Restaura a sessão ao abrir/recarregar: tipo do usuário (/api/auth/me/) e perfil.
  useEffect(() => {
    if (!temSessao()) { setRestaurando(false); return; }
    let ativo = true;
    (async () => {
      try {
        const usuario = await buscarMeuUsuario();
        if (!ativo) return;
        setMeuTipo(usuario.tipo);
        if (usuario.tipo === 'administrador') {
          setScreen(s => (TELAS_PUBLICAS.includes(s) ? s : 'admin'));
        } else {
          const perfis = await listarPerfis();
          if (!ativo) return;
          const perfil = perfis.find(p => p.usuario === usuario.id) ?? null;
          setMeuPerfil(perfil);
          if (perfil) void atualizarNotifsCount();
          setScreen(s => {
            if (TELAS_PUBLICAS.includes(s)) return s;
            if (!perfil) return 'profile-create';
            return s === 'profile-create' || s === 'admin' ? 'discovery' : s;
          });
          // Chat aberto direto pela URL (?screen=chat&match=<id>): recarrega a conversa do match.
          if (perfil && telaDaUrl === 'chat' && matchNaUrl > 0) {
            try {
              const ms = await listarMatches();
              const m = ms.find(x => x.id === matchNaUrl);
              if (!ativo) return;
              if (m) {
                const outro = m.perfil_a.id === perfil.id ? m.perfil_b : m.perfil_a;
                setCurrentChat(perfilBasicoParaProfile(outro, m.score));
                setActiveChatMatchId(m.id);
              } else {
                setScreen('matches');
                registrarTelaNaUrl('matches', true);
              }
            } catch {
              setScreen('matches');
              registrarTelaNaUrl('matches', true);
            }
          }
        }
      } catch { /* 401: a sessão inválida já foi tratada por onOn401 (volta ao login) */ }
      finally { if (ativo) setRestaurando(false); }
    })();
    return () => { ativo = false; };
  }, []);

  // Guarda de rotas: tela interna exige sessão; o painel admin só para administrador;
  // o administrador não usa as telas de usuário.
  useEffect(() => {
    if (restaurando) return;
    const publica = TELAS_PUBLICAS.includes(screen);
    const logado = temSessao();
    if (!publica && !logado) { setScreen('login'); registrarTelaNaUrl('login', true); return; }
    if (logado && meuTipo) {
      if (meuTipo === 'administrador' && !publica && screen !== 'admin') { setScreen('admin'); registrarTelaNaUrl('admin', true); }
      else if (meuTipo !== 'administrador' && screen === 'admin') { setScreen('discovery'); registrarTelaNaUrl('discovery', true); }
    }
  }, [screen, meuTipo, restaurando]);

  const handleLoginSuccess = async () => {
    try {
      const usuario = await buscarMeuUsuario();
      setMeuTipo(usuario.tipo);
      if (usuario.tipo === 'administrador') {
        nav('admin');
        return;
      }
      const perfis = await listarPerfis();
      const perfil = perfis.find(p => p.usuario === usuario.id) ?? null;
      setMeuPerfil(perfil);
      if (perfil) void atualizarNotifsCount();
      nav(perfil ? 'discovery' : 'profile-create');
    } catch {
      // Não deu para carregar a conta (rede/servidor): desfaz o login e avisa na tela de entrada.
      // Mandar a pessoa para "Criar perfil" faria quem já tem perfil achar que perdeu os dados.
      sairDaConta();
      throw new ApiError('Não foi possível carregar sua conta. Verifique sua conexão e tente novamente.');
    }
  };

  if (restaurando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <EstadoCarregando />
      </div>
    );
  }

  // Tela efetivamente exibida: a guarda de rotas acima corrige o estado logo em seguida,
  // mas a tela proibida nunca chega a ser desenhada.
  const logado = temSessao();
  const ehAdmin = meuTipo === 'administrador';
  const permitida = TELAS_PUBLICAS.includes(screen) || (logado && (screen === 'admin' ? ehAdmin : !ehAdmin));
  const telaAtual: Screen = permitida ? screen : (!logado ? 'login' : ehAdmin ? 'admin' : 'discovery');

  return (
    <AppShell screen={telaAtual} tab={tab} setTab={setTab} nav={nav} onLogout={handleLogout} notifsCount={notifsCount}>
      {telaAtual === 'admin' && <AdminPanel nav={nav} onLogout={handleLogout} />}
      {telaAtual === 'welcome' && <WelcomeScreen nav={nav} />}
      {telaAtual === 'login' && <LoginScreen nav={nav} onLoginSuccess={handleLoginSuccess} loginMsg={sessionExpiredMsg} />}
      {telaAtual === 'esqueci-senha' && <EsqueciSenhaScreen nav={nav} />}
      {telaAtual === 'redefinir-senha' && (
        <RedefinirSenhaScreen
          nav={nav}
          uid={linkSenha.uid}
          token={linkSenha.token}
          onSenhaRedefinida={() => {
            // A API encerrou todas as sessões da conta: limpa a sessão desta aba (se havia uma) e o estado em memória.
            sairDaConta();
            setMeuPerfil(null); setMeuTipo(''); setNotifsCount(0); setActiveChatMatchId(0);
            setCurrentChat(PERFIL_VAZIO); setSelectedProfile(PERFIL_VAZIO); setSessionExpiredMsg('');
          }}
        />
      )}
      {telaAtual === 'register' && <RegisterScreen nav={nav} onLoginSuccess={handleLoginSuccess} onContaCriadaSemLogin={(aviso) => { setSessionExpiredMsg(aviso); nav('login'); }} />}
      {telaAtual === 'profile-create' && (
        <ProfileCreateScreen nav={nav} tipo={meuTipo} onPerfilCriado={(p) => setMeuPerfil(p)} />
      )}
      {telaAtual === 'discovery' && (
        <DiscoveryScreen
          tipo={meuTipo}
          regiao={meuPerfil?.regiao}
          nav={nav}
          setMatchProfile={setMatchProfile}
          onSelectProfile={(p) => { setSelectedProfile(p); setPrevScreen(screen); }}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          onMatch={(matchId) => { setActiveChatMatchId(matchId); setMatchesKey(k => k + 1); setNotifsCount(n => n + 1); }}
        />
      )}
      {telaAtual === 'profile-detail' && (
        <ProfileDetailScreen
          nav={nav}
          profile={selectedProfile}
          backScreen={prevScreen}
          onRecusar={async (p) => {
            // Falha de rede/servidor: o erro sobe para a tela de detalhe, que avisa e permite tentar de novo.
            try { await enviarCurtida(p.id, 'recusar'); } catch (e) { if (!perfilIndisponivel(e)) throw e; }
            nav('discovery');
          }}
          onLike={async (p) => {
            try {
              const res = await enviarCurtida(p.id, 'curtir');
              if (res.match) {
                setMatchProfile(p);
                if (res.match_data) setActiveChatMatchId(res.match_data.id);
                setMatchesKey(k => k + 1);
                setNotifsCount(n => n + 1);
                nav('match');
              } else {
                nav('discovery');
              }
            } catch (e) {
              if (!perfilIndisponivel(e)) throw e;
              nav('discovery');
            }
          }}
        />
      )}
      {telaAtual === 'match' && <MatchScreen nav={nav} profile={matchProfile} setCurrentChat={setCurrentChat} />}
      {telaAtual === 'matches' && (
        <MatchesScreen key={matchesKey} nav={nav} setCurrentChat={setCurrentChat} setActiveChatMatchId={setActiveChatMatchId} />
      )}
      {telaAtual === 'notifications' && (
        <NotificationsScreen key={notifsKey} nav={nav} setCurrentChat={setCurrentChat} setActiveChatMatchId={setActiveChatMatchId} meuPerfilId={meuPerfil?.id ?? null} />
      )}
      {telaAtual === 'chat' && (
        <ChatScreen nav={nav} profile={currentChat} matchId={activeChatMatchId} meuPerfilId={meuPerfil?.id ?? 0} showReport={showReport} setShowReport={setShowReport}
          onVerPerfil={async () => {
            // Dados reais do outro participante (a lista de conversas só traz um resumo).
            try {
              const ms = await listarMatches();
              const m = ms.find(x => x.id === activeChatMatchId);
              if (m) {
                const outro = m.perfil_a.id === meuPerfil?.id ? m.perfil_b : m.perfil_a;
                setSelectedProfile(perfilBasicoParaProfile(outro, m.score));
                setPrevScreen('chat');
                nav('profile-detail');
                return;
              }
            } catch { /* usa o resumo da conversa */ }
            setSelectedProfile(currentChat);
            setPrevScreen('chat');
            nav('profile-detail');
          }} />
      )}
      {telaAtual === 'profile' && (
        <MyProfileScreen
          meuPerfil={meuPerfil}
          tipo={meuTipo}
          onLogout={handleLogout}
          onPerfilAtualizado={(p) => setMeuPerfil(p)}
          onPerfilExcluido={() => { setMeuPerfil(null); nav('profile-create'); }}
        />
      )}
    </AppShell>
  );
}
