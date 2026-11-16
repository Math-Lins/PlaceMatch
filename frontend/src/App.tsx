import { useState, useEffect, useRef } from 'react';
import {
  login as apiLogin,
  registrar as apiRegistrar,
  buscarMeuUsuario,
  listarPerfis,
  criarPerfil as apiCriarPerfil,
  atualizarPerfil as apiAtualizarPerfil,
  excluirPerfil as apiExcluirPerfil,
  logout,
  setOn401,
  ApiError,
  listarDescoberta,
  enviarCurtida,
  listarMatches,
  listarConversas,
  listarMensagens,
  enviarMensagem,
  criarDenuncia,
} from './api';
import type { Perfil as PerfilAPI, PerfilPayload, PerfilDescoberto, PerfilBasico, MatchData, Conversa, MensagemAPI, DescobertaParams } from './api';
import AdminPanel from './admin/AdminPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Screen =
  | 'welcome'
  | 'login'
  | 'register'
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

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROFILES: Profile[] = [
  {
    id: 1,
    name: 'Ana Luísa',
    age: 23,
    region: 'Vila Madalena',
    bio: 'Estudante de arquitetura, adoro cozinhar aos fins de semana e tenho uma gata chamada Biscuit. Procuro alguém tranquilo e que respeite espaço pessoal.',
    compat: 89,
    photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=1000&fit=crop&auto=format',
    tags: ['Não fumante', 'Aceita pets', 'Madrugadora'],
    budget: 'R$ 800 – R$ 1.400',
    smoker: false,
    pets: true,
    organized: 4,
    messy: 2,
    horario: 'madrugador',
    ruido: 2,
    social: 3,
    visitas: 'as_vezes',
    tipoImovel: 'apartamento',
    qtdMoradores: 2,
    lastMsg: 'Oi! Vi que você também é da Vila Madalena 😊',
    lastTime: '14:32',
  },
  {
    id: 2,
    name: 'Pedro Henrique',
    age: 26,
    region: 'Pinheiros',
    bio: 'Dev front-end trabalhando remoto. Sou tranquilo, gosto de música lo-fi e cuido bem dos espaços comuns. Não fumo e prefiro ambientes organizados.',
    compat: 74,
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=1000&fit=crop&auto=format',
    tags: ['Não fumante', 'Sem pets', 'Noturno'],
    budget: 'R$ 1.000 – R$ 1.800',
    smoker: false,
    pets: false,
    organized: 5,
    messy: 1,
    horario: 'noturno',
    ruido: 1,
    social: 2,
    visitas: 'raramente',
    tipoImovel: 'apartamento',
    qtdMoradores: 2,
    lastMsg: 'Que legal, você trabalha na área de tech também?',
    lastTime: '10:15',
  },
  {
    id: 3,
    name: 'Camila Souza',
    age: 24,
    region: 'Consolação',
    bio: 'Mestranda em comunicação, vivia em intercâmbio até ano passado. Gosto de ambientes aconchegantes, faço yoga e tenho um cachorrinho chamado Tofu.',
    compat: 92,
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop&auto=format',
    tags: ['Não fumante', 'Aceita pets', 'Flexível'],
    budget: 'R$ 900 – R$ 1.600',
    smoker: false,
    pets: true,
    organized: 3,
    messy: 3,
    horario: 'flexivel',
    ruido: 3,
    social: 4,
    visitas: 'frequentemente',
    tipoImovel: 'casa',
    qtdMoradores: 3,
    lastMsg: 'Adorei seu perfil! A gente tem muito em comum',
    lastTime: 'Ontem',
  },
];

const MY_PROFILE: Profile = {
  id: 0,
  name: 'Você',
  age: 25,
  region: 'Jardins',
  bio: 'Procuro um lugar tranquilo perto do trabalho. Gosto de cozinhar, sou organizado e respeito muito o espaço dos outros.',
  compat: 100,
  photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&h=1000&fit=crop&auto=format',
  tags: ['Não fumante', 'Sem pets', 'Organizado'],
  budget: 'R$ 800 – R$ 1.500',
  smoker: false,
  pets: false,
  organized: 4,
  messy: 2,
  horario: 'madrugador',
  ruido: 2,
  social: 3,
  visitas: 'as_vezes',
  tipoImovel: 'apartamento',
  qtdMoradores: 2,
};

// Fotos usadas enquanto o backend não tem campo de foto no perfil
const PLACEHOLDER_PHOTOS = [
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=1000&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=1000&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&h=1000&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&h=1000&fit=crop&auto=format',
];

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

function perfilDescobertoParaProfile(p: PerfilDescoberto): Profile {
  const min = Number(p.orcamento_min);
  const max = Number(p.orcamento_max);
  const budget = min === max
    ? `R$ ${min.toLocaleString('pt-BR')}`
    : `R$ ${min.toLocaleString('pt-BR')} – ${max.toLocaleString('pt-BR')}`;
  return {
    id: p.id,
    name: p.nome,
    age: p.idade,
    region: p.regiao,
    bio: p.bio,
    compat: Math.round(p.score * 100),
    photo: p.fotos_imovel?.[0] ?? PLACEHOLDER_PHOTOS[p.id % PLACEHOLDER_PHOTOS.length],
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
  if (!p) return PROFILES[0];
  const min = Number(p.orcamento_min);
  const max = Number(p.orcamento_max);
  const budget = min === max
    ? `R$ ${min.toLocaleString('pt-BR')}`
    : `R$ ${min.toLocaleString('pt-BR')} – ${max.toLocaleString('pt-BR')}`;
  return {
    id: p.id,
    name: p.nome,
    age: p.idade,
    region: p.regiao,
    bio: p.bio,
    compat: Math.round(score * 100),
    photo: p.fotos_imovel?.[0] ?? PLACEHOLDER_PHOTOS[p.id % PLACEHOLDER_PHOTOS.length],
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


// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  primary: '#E06B45',
  primaryLight: '#F0896A',
  primaryDark: '#C4512E',
  mint: '#5DBF96',
  mintLight: '#80D4B0',
  bg: '#FBF8F5',
  card: '#FFFFFF',
  text: '#2A2420',
  muted: '#8A7E78',
  border: '#EDE8E3',
  danger: '#E05555',
};

// ─── Shared UI Components ─────────────────────────────────────────────────────


function Btn({ label, onClick, outline = false, danger = false, small = false, disabled = false, style: extraStyle }: {
  label: string; onClick?: () => void; outline?: boolean; danger?: boolean; small?: boolean; disabled?: boolean; style?: React.CSSProperties;
}) {
  const bg = danger ? C.danger : outline ? 'transparent' : C.primary;
  const color = outline ? (danger ? C.danger : C.primary) : '#fff';
  const border = outline ? `2px solid ${danger ? C.danger : C.primary}` : 'none';
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      width: '100%', padding: small ? '10px 16px' : '15px 16px',
      background: bg, color, border, borderRadius: '16px',
      fontSize: small ? '14px' : '16px', fontWeight: 700,
      fontFamily: 'Outfit,sans-serif', cursor: disabled ? 'not-allowed' : 'pointer', minHeight: '44px',
      transition: 'opacity 0.15s', opacity: disabled ? 0.6 : 1, ...extraStyle,
    }}
      className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      onMouseDown={e => { if (!disabled) e.currentTarget.style.opacity = '0.8'; }}
      onMouseUp={e => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
    >
      {label}
    </button>
  );
}

function Input({ label, type = 'text', placeholder, value, onChange, error, maxLength }: {
  label: string; type?: string; placeholder?: string; value?: string; onChange?: (v: string) => void; error?: string; maxLength?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: C.muted, fontFamily: 'Nunito,sans-serif' }}>{label}</label>
        {maxLength !== undefined && (
          <span style={{ fontSize: '12px', color: (value?.length ?? 0) >= maxLength ? C.danger : C.muted, fontFamily: 'Nunito,sans-serif' }}>{value?.length ?? 0}/{maxLength}</span>
        )}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        aria-invalid={!!error}
        onChange={e => onChange?.(e.target.value)}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          padding: '14px 16px', borderRadius: '14px', border: `1.5px solid ${error ? C.danger : C.border}`,
          background: C.card, fontSize: '15px', fontFamily: 'Nunito,sans-serif', color: C.text,
          outline: 'none',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = C.primary)}
        onBlur={e => (e.currentTarget.style.borderColor = error ? C.danger : C.border)}
      />
      {error && <span style={{ fontSize: '12px', color: C.danger, fontFamily: 'Nunito,sans-serif' }}>{error}</span>}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  const isMint = label.includes('Aceita') || label.includes('Organiz') || label.includes('Tranquil');
  return (
    <span style={{
      padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
      background: isMint ? '#E6F7F0' : '#FFF0EB',
      color: isMint ? C.mint : C.primary,
      fontFamily: 'Nunito,sans-serif', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function CompatBadge({ value, large = false }: { value: number; large?: boolean }) {
  const color = value >= 85 ? C.mint : value >= 70 ? C.primary : '#E0A840';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: large ? '6px 14px' : '4px 10px',
      borderRadius: '20px', background: `${color}20`,
      fontSize: large ? '16px' : '13px', fontWeight: 700,
      color, fontFamily: 'Outfit,sans-serif',
    }}>
      ❤️ {value}% compatível
    </span>
  );
}

const COMPAT_LEVELS = [
  { min: 0,  max: 20,  label: 'Baixa compatibilidade',    color: '#E05555' },
  { min: 20, max: 40,  label: 'Compatibilidade regular',  color: '#E0A840' },
  { min: 40, max: 60,  label: 'Boa compatibilidade',      color: C.primary },
  { min: 60, max: 80,  label: 'Alta compatibilidade',     color: '#5DBF96' },
  { min: 80, max: 101, label: 'Combinação perfeita',      color: '#2EA874' },
];

function getCompatLevel(value: number) {
  return COMPAT_LEVELS.find(l => value >= l.min && value < l.max) ?? COMPAT_LEVELS[4];
}

function CompatMeter({ value }: { value: number }) {
  const level = getCompatLevel(value);
  const filledBars = COMPAT_LEVELS.indexOf(level) + 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: level.color }}>
          {level.label}
        </span>
        <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 800, color: level.color }}>
          {value}%
        </span>
      </div>
      <div style={{ display: 'flex', gap: '3px' }}>
        {COMPAT_LEVELS.map((l, i) => (
          <div key={i} style={{
            flex: 1, height: '6px', borderRadius: '3px',
            background: i < filledBars ? level.color : C.border,
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
    </div>
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
  const base: React.CSSProperties = {
    ...style,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    background: `linear-gradient(135deg, ${C.primary} 0%, ${C.mint} 100%)`,
  };
  if (!src || erro) {
    return tipo === 'avatar' ? (
      <div style={{ ...base, color: '#fff', fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: '11px' }}>
        {(iniciais || alt.charAt(0) || '?').toUpperCase()}
      </div>
    ) : (
      <div style={base}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)">
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
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          width: '32px', height: '6px', borderRadius: '3px',
          background: i <= value ? C.primary : C.border,
        }}/>
      ))}
    </div>
  );
}

// ─── Bottom Navigation ─────────────────────────────────────────────────────────

function BottomNav({ tab, setTab, notifsCount }: { tab: Tab; setTab: (t: Tab) => void; notifsCount: number }) {
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
          {notifsCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-6px',
              background: C.primary, color: '#fff', borderRadius: '10px',
              padding: '0 4px', fontSize: '9px', fontWeight: 800,
              fontFamily: 'Outfit,sans-serif', lineHeight: '14px',
              minWidth: '14px', textAlign: 'center',
            }}>
              {notifsCount > 9 ? '9+' : notifsCount}
            </span>
          )}
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
        <button key={item.id} onClick={() => setTab(item.id)} style={{
          flex: 1, padding: '12px 0 4px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer',
        }}>
          {item.icon(tab === item.id)}
          <span style={{ fontSize: '10px', fontWeight: 600, color: tab === item.id ? C.primary : C.muted, fontFamily: 'Nunito,sans-serif' }}>
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
          {notifsCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-6px',
              background: C.primary, color: '#fff', borderRadius: '10px',
              padding: '0 4px', fontSize: '9px', fontWeight: 800,
              fontFamily: 'Outfit,sans-serif', lineHeight: '14px',
              minWidth: '14px', textAlign: 'center',
            }}>
              {notifsCount > 9 ? '9+' : notifsCount}
            </span>
          )}
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
            <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '18px', fontWeight: 800, color: C.text }}>PlaceMatch</span>
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
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', borderRadius: '14px', cursor: 'pointer',
                  border: 'none', width: '100%', textAlign: 'left',
                  background: active ? `${C.primary}18` : 'transparent',
                  color: active ? C.primary : C.muted,
                  fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700,
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
              padding: '12px 16px', borderRadius: '14px', cursor: 'pointer',
              border: 'none', width: '100%', textAlign: 'left',
              background: 'transparent', color: C.muted,
              fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700,
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
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '40px', fontWeight: 800, margin: '0 0 8px', letterSpacing: '-1px' }}>PlaceMatch</h1>
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.85, margin: '0 0 28px' }}>Seu lar, sua turma</p>
        <div style={{ borderRadius: '24px', overflow: 'hidden', height: '260px', marginBottom: '24px' }}>
          <img
            src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=520&fit=crop&auto=format"
            alt="Pessoas convivendo em apartamento aconchegante"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 600, lineHeight: 1.4, opacity: 0.95 }}>
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
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '32px', fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.5px' }}>PlaceMatch</h1>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 600, color: C.primary, margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>Seu lar, sua turma</p>
          </div>
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{ borderRadius: '28px', overflow: 'hidden', height: '240px', position: 'relative' }}>
              <img
                src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop&auto=format"
                alt="Pessoas convivendo em apartamento aconchegante"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.5) 0%, transparent 60%)' }}/>
            </div>
            <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
              <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.3 }}>
                Encontre quem combina com seu jeito de morar
              </p>
            </div>
          </div>
        </div>

        {/* Desktop: título acima dos botões */}
        <div className="hidden lg:block mb-8 text-center">
          <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 8px' }}>Bem-vindo!</h2>
          <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.muted, margin: 0 }}>Entre ou crie sua conta para começar</p>
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
          <button onClick={() => nav('welcome')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px', color: C.muted }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 600 }}>Voltar</span>
          </button>

          {loginMsg && (
            <div style={{ background: `${C.danger}12`, border: `1px solid ${C.danger}40`, borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.danger, margin: 0 }}>{loginMsg}</p>
            </div>
          )}
          <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Boas-vindas de volta!</h2>
          <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.muted, margin: '0 0 32px' }}>Entre com sua conta para continuar</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={setEmail} error={fieldErrors.email} />
            <Input label="Senha" type="password" placeholder="••••••••" value={senha} onChange={setSenha} error={fieldErrors.senha} />
          </div>

          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: '14px', fontWeight: 600, fontFamily: 'Nunito,sans-serif', padding: '16px 0 0', display: 'block' }}>
            Esqueci minha senha
          </button>

          {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginTop: '8px', textAlign: 'center' }}>{erro}</p>}

          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Btn label={loading ? 'Aguarde...' : 'Entrar'} onClick={handleEntrar} disabled={loading} />
          </div>

          <p style={{ textAlign: 'center', marginTop: '24px', fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>
            Ainda não tenho uma conta?{' '}
            <button onClick={() => nav('register')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontWeight: 700, fontSize: '14px', fontFamily: 'Nunito,sans-serif', padding: 0 }}>
              Criar conta
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Register ─────────────────────────────────────────────────────────

function RegisterScreen({ nav, onLoginSuccess }: { nav: (s: Screen) => void; onLoginSuccess: () => Promise<void> }) {
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
    try {
      await apiRegistrar({
        username: nome.trim(),
        email: email.trim(),
        password: senha,
        tipo: role === 'looking' ? 'buscando_vaga' : 'oferecendo_vaga',
      });
      await apiLogin(email.trim(), senha);
      await onLoginSuccess();
    } catch (e: unknown) {
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
          <button onClick={() => nav('welcome')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px', color: C.muted }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 600 }}>Voltar</span>
          </button>

          <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Criar conta</h2>
          <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.muted, margin: '0 0 28px' }}>Vamos te conectar ao lugar certo</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Input label="Nome completo" placeholder="Seu nome" value={nome} onChange={setNome} error={fieldErrors.username} maxLength={150} />
            <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={setEmail} error={fieldErrors.email} />
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Senha" type="password" placeholder="Mínimo 8 caracteres" value={senha} onChange={setSenha} error={fieldErrors.password} />
              <Input label="Confirmar senha" type="password" placeholder="Repita a senha" value={confirmSenha} onChange={setConfirmSenha} error={fieldErrors.confirmSenha} />
            </div>
          </div>

          <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, marginTop: '20px', marginBottom: '10px' }}>Você está:</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {(['looking', 'has'] as const).map(r => (
              <button key={r} onClick={() => setRole(r)} style={{
                flex: 1, padding: '13px', borderRadius: '14px', cursor: 'pointer',
                border: `2px solid ${role === r ? C.primary : fieldErrors.role ? C.danger : C.border}`,
                background: role === r ? `${C.primary}12` : C.card,
                color: role === r ? C.primary : C.muted,
                fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 700, lineHeight: 1.3,
              }}>
                {r === 'looking' ? '🔍 Procuro um lugar' : '🏠 Tenho um lugar disponível'}
              </button>
            ))}
          </div>
          {fieldErrors.role && <span style={{ fontSize: '12px', color: C.danger, fontFamily: 'Nunito,sans-serif', display: 'block', marginTop: '6px' }}>{fieldErrors.role}</span>}

          {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginTop: '12px', textAlign: 'center' }}>{erro}</p>}

          <div style={{ marginTop: '28px' }}>
            <Btn label={loading ? 'Aguarde...' : 'Continuar'} onClick={handleContinuar} disabled={loading} />
          </div>

          <p style={{ textAlign: 'center', marginTop: '20px', fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>
            Já tenho conta?{' '}
            <button onClick={() => nav('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontWeight: 700, fontSize: '14px', fontFamily: 'Nunito,sans-serif', padding: 0 }}>
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
  1: ['nome', 'idade', 'regiao', 'bio'],
  2: ['orcamento_min', 'orcamento_max', 'tipo_imovel', 'qtd_moradores'],
  3: ['fumante', 'aceita_pets', 'aceita_visitas', 'perfil_horario'],
  4: ['tolerancia_bagunca', 'nivel_organizacao', 'nivel_ruido', 'nivel_social'],
  5: ['titulo_anuncio', 'descricao_imovel', 'fotos_imovel', 'foto_perfil_url'],
};

function etapaDoCampo(campo: string): number | null {
  for (const [etapa, campos] of Object.entries(CAMPOS_ETAPA)) {
    if (campos.includes(campo)) return Number(etapa);
  }
  return null;
}

function numBR(v: string): number {
  return Number(v.trim().replace(',', '.'));
}

function urlHttpValida(u: string): boolean {
  if (!/^https?:\/\//.test(u)) return false;
  try { return !!new URL(u).hostname; } catch { return false; }
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
    ...(anuncio ? {
      titulo_anuncio: f.titulo.trim(),
      descricao_imovel: f.descricaoImovel.trim(),
      fotos_imovel: f.fotos.map(x => x.trim()).filter(Boolean),
      foto_perfil_url: f.fotoPerfil.trim(),
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
    if (quer('foto_perfil_url')) {
      const u = f.fotoPerfil.trim();
      if (u && (u.length > LIM.url || !urlHttpValida(u))) e.foto_perfil_url = 'A foto de perfil precisa ser um link http:// ou https:// válido.';
    }
  }
  return e;
}

const ROTULO_ESTILO: React.CSSProperties = { fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' };
const ERRO_ESTILO: React.CSSProperties = { fontSize: '12px', color: C.danger, fontFamily: 'Nunito,sans-serif', display: 'block', marginTop: '4px' };

function CampoSimNao({ label, value, onChange, error }: { label: string; value: boolean | null; onChange: (v: boolean) => void; error?: string }) {
  return (
    <div>
      <p style={ROTULO_ESTILO}>{label}</p>
      <div style={{ display: 'flex', gap: '10px' }}>
        {[true, false].map(v => (
          <button key={String(v)} type="button" onClick={() => onChange(v)} aria-pressed={value === v} style={{
            flex: 1, padding: '12px', borderRadius: '12px', cursor: 'pointer', minHeight: '44px',
            border: `2px solid ${value === v ? C.primary : error ? C.danger : C.border}`,
            background: value === v ? `${C.primary}12` : C.card,
            color: value === v ? C.primary : C.muted,
            fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 700,
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
            flex: 1, minWidth: '80px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', minHeight: '44px',
            border: `2px solid ${value === opt.value ? C.primary : error ? C.danger : C.border}`,
            background: value === opt.value ? `${C.primary}12` : C.card,
            color: value === opt.value ? C.primary : C.muted,
            fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 700, textAlign: 'center',
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
          <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${label}: ${i} de 5`} style={{
            flex: 1, height: '44px', borderRadius: '10px', cursor: 'pointer',
            border: `2px solid ${value >= i ? C.primary : error ? C.danger : C.border}`,
            background: value >= i ? C.primary : C.card,
            color: value >= i ? '#fff' : C.muted,
            fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700,
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
            flex: 1, height: '44px', borderRadius: '12px', cursor: 'pointer',
            border: `2px solid ${value === n ? C.primary : error ? C.danger : C.border}`,
            background: value === n ? `${C.primary}12` : C.card,
            color: value === n ? C.primary : C.muted,
            fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700,
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
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: C.muted, fontFamily: 'Nunito,sans-serif' }}>{label}</label>
        <span style={{ fontSize: '12px', color: value.length >= max ? C.danger : C.muted, fontFamily: 'Nunito,sans-serif' }}>{value.length}/{max}</span>
      </div>
      <textarea
        placeholder={placeholder}
        value={value}
        maxLength={max}
        aria-invalid={!!error}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: `1.5px solid ${error ? C.danger : C.border}`, background: C.card, fontSize: '15px', fontFamily: 'Nunito,sans-serif', color: C.text, outline: 'none', resize: 'none', height: `${altura}px`, boxSizing: 'border-box' }}
      />
      {error && <span style={ERRO_ESTILO}>{error}</span>}
    </div>
  );
}

type PropsEtapa = { form: PerfilForm; setForm: (p: Partial<PerfilForm>) => void; errors: Record<string, string> };

function EtapaPessoal({ form, setForm, errors }: PropsEtapa) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Input label="Nome" placeholder="Seu nome completo" value={form.nome} onChange={v => setForm({ nome: v })} error={errors.nome} maxLength={LIM.nome} />
      <div className="grid md:grid-cols-2 gap-4">
        <Input label="Idade" type="number" placeholder="Sua idade" value={form.idade} onChange={v => setForm({ idade: v })} error={errors.idade} />
        <Input label="Região ou bairro" placeholder="Ex: Vila Madalena, SP" value={form.regiao} onChange={v => setForm({ regiao: v })} error={errors.regiao} maxLength={LIM.regiao} />
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
          <Input label="Mínimo (R$)" placeholder="700" value={form.orcamentoMin} onChange={v => setForm({ orcamentoMin: v })} error={errors.orcamento_min} />
          <Input label="Máximo (R$)" placeholder="1500" value={form.orcamentoMax} onChange={v => setForm({ orcamentoMax: v })} error={errors.orcamento_max} />
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

function PreviewFoto({ url, alt, redonda = false }: { url: string; alt: string; redonda?: boolean }) {
  const u = url.trim();
  if (!u || !urlHttpValida(u)) return null;
  return (
    <div style={{ width: redonda ? '72px' : '100%', maxWidth: redonda ? '72px' : '220px', height: redonda ? '72px' : '124px', borderRadius: redonda ? '50%' : '12px', overflow: 'hidden', border: `1.5px solid ${C.border}`, marginTop: '8px' }}>
      <ImagemComFallback key={u} src={u} alt={alt} tipo={redonda ? 'avatar' : 'imovel'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
          <span style={{ fontSize: '12px', color: C.muted, fontFamily: 'Nunito,sans-serif' }}>{form.fotos.length}/{LIM.fotos}</span>
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
                  <button type="button" onClick={() => remover(i)} aria-label={`Remover foto ${i + 1}`} style={{ minWidth: '44px', minHeight: '48px', borderRadius: '12px', border: `1.5px solid ${C.border}`, background: C.card, color: C.muted, cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>
                <PreviewFoto url={url} alt={`Pré-visualização da foto ${i + 1}`} />
              </div>
            );
          })}
        </div>
        {form.fotos.length < LIM.fotos && (
          <button type="button" onClick={() => setForm({ fotos: [...form.fotos, ''] })} style={{ marginTop: '10px', padding: '10px 14px', minHeight: '44px', borderRadius: '12px', border: `1.5px dashed ${C.primary}`, background: 'none', color: C.primary, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700 }}>
            + Adicionar foto
          </button>
        )}
        {errors.fotos_imovel && <span style={ERRO_ESTILO}>{errors.fotos_imovel}</span>}
      </div>

      <div>
        <Input label="Sua foto (link)" placeholder="https://..." value={form.fotoPerfil} onChange={v => setForm({ fotoPerfil: v })} error={errors.foto_perfil_url} maxLength={LIM.url} />
        <PreviewFoto url={form.fotoPerfil} alt="Pré-visualização da sua foto" redonda />
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
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: 0 }}>
              Etapa {step} de {TOTAL_STEPS} — {STEP_LABELS[step - 1]}
            </p>
          </div>

          <div style={{ paddingTop: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: step === 4 ? '0 0 6px' : '0 0 24px' }}>{TITULOS[step - 1]}</h2>
            {step === 4 && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: '0 0 24px' }}>1 = mínimo &nbsp;·&nbsp; 5 = máximo</p>}
            {step === 5 && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: '-12px 0 20px' }}>Opcional — você pode completar depois em Meu Perfil.</p>}

            {step === 1 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                  <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', border: `3px dashed ${C.primary}` }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: '26px', height: '26px', background: C.primary, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>+</span>
                    </div>
                  </div>
                </div>
                <EtapaPessoal {...props} />
              </>
            )}
            {step === 2 && <EtapaMoradia {...props} />}
            {step === 3 && <EtapaConvivencia {...props} />}
            {step === 4 && <EtapaHabitos {...props} />}
            {step === 5 && anuncio && <EtapaAnuncio {...props} />}

            {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginTop: '12px', textAlign: 'center' }}>{erro}</p>}

            {/* Rodapé */}
            <div className="flex flex-col md:flex-row gap-3 mt-auto pt-8">
              {step > 1 && <Btn label="Voltar" outline onClick={() => { setFieldErrors({}); setErro(''); setStep(s => s - 1); }} />}
              <Btn
                label={step === TOTAL_STEPS ? (loading ? 'Aguarde...' : 'Concluir perfil') : 'Próxima etapa'}
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
  const [loadingProfiles, setLoadingProfiles] = useState(true);
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
    setLoadingProfiles(true);
    setApiError('');
    const params: DescobertaParams = {};
    if (q) params.q = q;
    if (f.regiao) params.regiao = [f.regiao];
    if (f.tipo_imovel) params.tipo_imovel = f.tipo_imovel;
    if (f.aceita_pets !== 'indiferente') params.aceita_pets = f.aceita_pets;
    if (f.fumante !== 'indiferente') params.fumante = f.fumante;
    if (f.orcamento_min) params.orcamento_min = parseFloat(f.orcamento_min);
    if (f.orcamento_max) params.orcamento_max = parseFloat(f.orcamento_max);
    if (f.score_min > 0) params.score_min = f.score_min;
    if (f.ordenar !== 'compatibilidade') params.ordenar = f.ordenar;
    listarDescoberta(params)
      .then(data => { setProfiles(data.map(perfilDescobertoParaProfile)); setLoadingProfiles(false); })
      .catch(err => {
        setApiError(err instanceof ApiError ? err.message : 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
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
    try {
      const res = await enviarCurtida(p.id, 'curtir');
      if (res.match) {
        setMatchProfile(p);
        removeProfile(p.id);
        onMatch?.(res.match_data?.id ?? 0);
        nav('match');
        return;
      }
    } catch {
      // Remove o card mesmo em caso de erro de rede
    } finally {
      setLoadingId(null);
    }
    removeProfile(p.id);
  };

  const handleDislike = async (p: Profile) => {
    if (loadingId !== null) return;
    setLoadingId(p.id);
    try {
      await enviarCurtida(p.id, 'recusar');
    } catch {
      // Remove o card mesmo em caso de erro de rede
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
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: 0 }}>{tituloTela}</h1>
            {regiao && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: 0 }}>📍 {regiao}</p>}
          </div>
          <button onClick={() => setShowFilters(true)} aria-label="Abrir filtros de busca" style={{
            position: 'relative', width: '44px', height: '44px', borderRadius: '14px',
            border: `1.5px solid ${activeFiltersCount > 0 ? C.primary : C.border}`,
            background: activeFiltersCount > 0 ? `${C.primary}12` : C.card,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeFiltersCount > 0 ? C.primary : C.text} strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
            </svg>
            {activeFiltersCount > 0 && (
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px', background: C.primary, color: '#fff',
                borderRadius: '10px', padding: '0 5px', fontSize: '10px', fontWeight: 800,
                fontFamily: 'Outfit,sans-serif', lineHeight: '16px', minWidth: '16px', textAlign: 'center',
              }}>
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={searchQ}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar por nome, região..."
            style={{
              width: '100%', padding: '10px 12px 10px 36px', borderRadius: '12px',
              border: `1.5px solid ${C.border}`, background: C.card, fontFamily: 'Nunito,sans-serif',
              fontSize: '14px', color: C.text, outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searchQ && (
            <button
              onClick={() => handleSearchChange('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '16px', lineHeight: 1 }}
            >✕</button>
          )}
        </div>
        {/* Active filter chips */}
        {activeFiltersCount > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            {filters.regiao && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', background: `${C.primary}18`, fontFamily: 'Nunito,sans-serif', fontSize: '12px', fontWeight: 700, color: C.primary }}>
                Região: {filters.regiao}
                <button onClick={() => removeFilterChip('regiao')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: '12px', padding: '0 0 0 2px', lineHeight: 1 }}>✕</button>
              </span>
            )}
            {filters.tipo_imovel && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', background: `${C.primary}18`, fontFamily: 'Nunito,sans-serif', fontSize: '12px', fontWeight: 700, color: C.primary }}>
                {IMOVEL_LABEL[filters.tipo_imovel] ?? filters.tipo_imovel}
                <button onClick={() => removeFilterChip('tipo_imovel')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: '12px', padding: '0 0 0 2px', lineHeight: 1 }}>✕</button>
              </span>
            )}
            {filters.aceita_pets !== 'indiferente' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', background: `${C.primary}18`, fontFamily: 'Nunito,sans-serif', fontSize: '12px', fontWeight: 700, color: C.primary }}>
                Pets: {filters.aceita_pets === 'sim' ? 'Sim' : 'Não'}
                <button onClick={() => removeFilterChip('aceita_pets')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: '12px', padding: '0 0 0 2px', lineHeight: 1 }}>✕</button>
              </span>
            )}
            {filters.fumante !== 'indiferente' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', background: `${C.primary}18`, fontFamily: 'Nunito,sans-serif', fontSize: '12px', fontWeight: 700, color: C.primary }}>
                Fumante: {filters.fumante === 'sim' ? 'Sim' : 'Não'}
                <button onClick={() => removeFilterChip('fumante')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: '12px', padding: '0 0 0 2px', lineHeight: 1 }}>✕</button>
              </span>
            )}
            {filters.orcamento_min && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', background: `${C.primary}18`, fontFamily: 'Nunito,sans-serif', fontSize: '12px', fontWeight: 700, color: C.primary }}>
                Mín: R$ {filters.orcamento_min}
                <button onClick={() => removeFilterChip('orcamento_min')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: '12px', padding: '0 0 0 2px', lineHeight: 1 }}>✕</button>
              </span>
            )}
            {filters.orcamento_max && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', background: `${C.primary}18`, fontFamily: 'Nunito,sans-serif', fontSize: '12px', fontWeight: 700, color: C.primary }}>
                Máx: R$ {filters.orcamento_max}
                <button onClick={() => removeFilterChip('orcamento_max')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: '12px', padding: '0 0 0 2px', lineHeight: 1 }}>✕</button>
              </span>
            )}
            {filters.score_min > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', background: `${C.primary}18`, fontFamily: 'Nunito,sans-serif', fontSize: '12px', fontWeight: 700, color: C.primary }}>
                Score ≥ {filters.score_min}%
                <button onClick={() => removeFilterChip('score_min')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: '12px', padding: '0 0 0 2px', lineHeight: 1 }}>✕</button>
              </span>
            )}
            {filters.ordenar !== 'compatibilidade' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', background: `${C.primary}18`, fontFamily: 'Nunito,sans-serif', fontSize: '12px', fontWeight: 700, color: C.primary }}>
                {filters.ordenar === 'menor_preco' ? 'Menor preço' : 'Maior preço'}
                <button onClick={() => removeFilterChip('ordenar')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: '12px', padding: '0 0 0 2px', lineHeight: 1 }}>✕</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Cards */}
      <div style={{ padding: '0 20px 20px', flex: 1 }}>
        {loadingProfiles && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '480px', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '15px' }}>
            Carregando perfis...
          </div>
        )}
        {!loadingProfiles && apiError && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '480px', padding: '24px', textAlign: 'center', color: C.danger, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>
            {apiError}
          </div>
        )}
        {!loadingProfiles && !apiError && profiles.length === 0 && (activeFiltersCount > 0 || searchQ) ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '360px', padding: '24px', textAlign: 'center', gap: '12px' }}>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.muted, margin: 0 }}>
              Nenhum perfil com esses filtros.
            </p>
            <button
              onClick={handleClearFilters}
              style={{ padding: '8px 20px', borderRadius: '12px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
            >
              Limpar filtros
            </button>
          </div>
        ) : (!loadingProfiles && !apiError && profiles.length === 0) ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '480px', padding: '24px', textAlign: 'center', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '15px' }}>
            Ainda não há perfis para você. Volte mais tarde.
          </div>
        ) : null}

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
                      <CompatBadge value={p.compat} />
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px 20px' }}>
                    <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 800, color: C.text, margin: '0 0 4px', lineHeight: 1.3, overflow: 'hidden', maxHeight: '2.6em' }}>
                      {p.tituloAnuncio ?? `Vaga em ${p.region}`}
                    </h2>
                    <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: '0 0 8px' }}>
                      📍 {p.region} · {IMOVEL_LABEL[p.tipoImovel] ?? p.tipoImovel} · {p.qtdMoradores} morador{p.qtdMoradores !== 1 ? 'es' : ''}
                    </p>
                    <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '22px', fontWeight: 800, color: C.text, margin: '0 0 10px' }}>
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
                      <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted }}>
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
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '26px', fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>{p.name}, {p.age}</h2>
                        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.8)', margin: 0 }}>📍 {p.region}</p>
                      </div>
                      <CompatBadge value={p.compat} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      {p.tags.map(t => (
                        <span key={t} style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', fontSize: '12px', fontWeight: 600, color: '#fff', fontFamily: 'Nunito,sans-serif' }}>{t}</span>
                      ))}
                    </div>
                    <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5 }}>{p.bio.slice(0, 80)}...</p>
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
                <button aria-label="Ver mais opções" style={{ width: '64px', height: '64px', borderRadius: '50%', border: `2px solid ${C.border}`, background: C.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
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
                          <CompatBadge value={p.compat} />
                        </div>
                      </div>
                      <div style={{ padding: '14px 16px 16px' }}>
                        <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 800, color: C.text, margin: '0 0 3px', lineHeight: 1.3, overflow: 'hidden', maxHeight: '2.6em' }}>
                          {p.tituloAnuncio ?? `Vaga em ${p.region}`}
                        </h2>
                        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted, margin: '0 0 6px' }}>
                          📍 {p.region} · {IMOVEL_LABEL[p.tipoImovel] ?? p.tipoImovel} · {p.qtdMoradores} morador{p.qtdMoradores !== 1 ? 'es' : ''}
                        </p>
                        <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '17px', fontWeight: 800, color: C.text, margin: '0 0 8px' }}>
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
                          <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '11px', color: C.muted }}>
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
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div>
                            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>{p.name}, {p.age}</h2>
                            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: 0 }}>📍 {p.region}</p>
                          </div>
                          <CompatBadge value={p.compat} />
                        </div>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {p.tags.slice(0, 3).map(t => (
                            <span key={t} style={{ padding: '3px 8px', borderRadius: '16px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', fontSize: '11px', fontWeight: 600, color: '#fff', fontFamily: 'Nunito,sans-serif' }}>{t}</span>
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
  // Vindo do chat (já há match) não faz sentido curtir/recusar: o detalhe é só leitura.
  const somenteLeitura = backScreen === 'chat';
  const handleRecusar = async () => {
    if (!onRecusar) { nav(backScreen); return; }
    setLiking(true);
    try { await onRecusar(profile); } finally { setLiking(false); }
  };
  const [fotoAtiva, setFotoAtiva] = useState<string>(profile.fotosImovel?.[0] ?? '');
  const [showDenuncia, setShowDenuncia] = useState(false);

  useEffect(() => {
    setFotoAtiva(profile.fotosImovel?.[0] ?? '');
  }, [profile.id]);

  const handleLike = async () => {
    if (!onLike || liking) return;
    setLiking(true);
    try {
      await onLike(profile);
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
          <button aria-label="Voltar" onClick={() => nav(backScreen)} style={{ position: 'absolute', top: '16px', left: '16px', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          {fotosImovel.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', padding: '10px 16px', overflowX: 'auto', background: 'rgba(0,0,0,0.55)' }}>
              {fotosImovel.map((f, i) => (
                <button key={i} onClick={() => setFotoAtiva(f)} style={{ flexShrink: 0, padding: 0, border: `2px solid ${fotoAtiva === f ? '#fff' : 'transparent'}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', background: 'none' }}>
                  <img src={f} alt={`Foto ${i + 1}`} style={{ width: '64px', height: '48px', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* informações */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '26px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>
              {profile.tituloAnuncio ?? `Vaga em ${profile.region}`}
            </h2>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: '0 0 12px' }}>📍 {profile.region}</p>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '26px', fontWeight: 800, color: C.text, margin: 0 }}>
              {profile.budget} <span style={{ fontSize: '16px', fontWeight: 400, color: C.muted }}>/ mês</span>
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <CompatBadge value={profile.compat} large />
          </div>

          {profile.descricaoImovel && (
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.text, lineHeight: 1.7, marginBottom: '24px' }}>
              {profile.descricaoImovel}
            </p>
          )}

          {/* Sobre a vaga */}
          <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
            <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Sobre a vaga</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Tipo de imóvel', value: IMOVEL_LABEL[profile.tipoImovel] ?? profile.tipoImovel },
                { label: 'Moradores', value: `${profile.qtdMoradores}${profile.qtdMoradores === 4 ? '+' : ''} pessoa${profile.qtdMoradores > 1 ? 's' : ''}` },
                { label: 'Aceita pets', value: profile.pets ? 'Sim' : 'Não' },
                { label: 'Fumante', value: profile.smoker ? 'Permitido' : 'Não permitido' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                  <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Anunciado por */}
          <div style={{ background: C.card, borderRadius: '20px', padding: '16px 20px', marginBottom: '24px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ImagemComFallback src={profile.fotoPerfilUrl} alt={profile.name}
              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              tipo="avatar" iniciais={profile.name.charAt(0)} />
            <div>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted, margin: '0 0 2px' }}>Anunciado por</p>
              <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: 0 }}>
                {profile.name.split(' ')[0]}, {profile.age} anos
              </p>
            </div>
          </div>

          {!somenteLeitura && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <Btn label="✕ Recusar" outline onClick={handleRecusar} disabled={liking} />
              <Btn label={liking ? 'Enviando...' : '💛 Tenho interesse'} onClick={onLike ? handleLike : () => nav('match')} disabled={liking} />
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <button onClick={() => setShowDenuncia(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 600, padding: '4px 0' }}>
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
        <img src={profile.photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.6) 0%, transparent 60%)' }} />
        <button aria-label="Voltar" onClick={() => nav(backScreen)} style={{ position: 'absolute', top: '16px', left: '16px', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        {/* Desktop: name overlay on photo */}
        <div className="hidden lg:block" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '28px' }}>
          <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '32px', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>{profile.name}, {profile.age}</h2>
          <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.85)', margin: 0 }}>📍 {profile.region}</p>
        </div>
      </div>

      {/* Info column */}
      <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
        {/* Mobile: name shown here */}
        <div className="lg:hidden" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>{profile.name}, {profile.age}</h2>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: 0 }}>📍 {profile.region}</p>
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

        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.text, lineHeight: 1.7, marginBottom: '24px' }}>{profile.bio}</p>

        <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Preferências de moradia</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Orçamento', value: profile.budget },
              { label: 'Tipo de imóvel', value: IMOVEL_LABEL[profile.tipoImovel] ?? profile.tipoImovel },
              { label: 'Moradores', value: `${profile.qtdMoradores}${profile.qtdMoradores === 4 ? '+' : ''} pessoa${profile.qtdMoradores > 1 ? 's' : ''}` },
              { label: 'Fumante', value: profile.smoker ? 'Sim' : 'Não' },
              { label: 'Aceita pets', value: profile.pets ? 'Sim' : 'Não' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Convivência</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Horário', value: HORARIO_LABEL[profile.horario] ?? profile.horario },
              { label: 'Visitas', value: VISITAS_LABEL[profile.visitas] ?? profile.visitas },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '24px', border: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Hábitos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {([
              { label: 'Organização', value: profile.organized },
              { label: 'Tolerância à bagunça', value: profile.messy },
              { label: 'Tolerância a barulho', value: profile.ruido },
              { label: 'Perfil social', value: profile.social },
            ] as { label: string; value: number }[]).map(row => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                  <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: C.primary }}>{row.value}/5</span>
                </div>
                <ScaleBar value={row.value} />
              </div>
            ))}
          </div>
        </div>

        {!somenteLeitura && <Btn label={liking ? 'Curtindo...' : '💛 Curtir perfil'} onClick={onLike ? handleLike : () => nav('match')} />}
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button onClick={() => setShowDenuncia(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 600, padding: '4px 0' }}>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof DiscoveryFilters>(k: K, v: DiscoveryFilters[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  const triBtn = (
    label: string,
    field: 'aceita_pets' | 'fumante',
  ) => (
    <div>
      <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{label}</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        {(['indiferente', 'sim', 'nao'] as const).map(v => {
          const active = draft[field] === v;
          const lbl = v === 'indiferente' ? 'Indiferente' : v === 'sim' ? 'Sim' : 'Não';
          return (
            <button key={v} onClick={() => set(field, v)} style={{
              flex: 1, padding: '10px', borderRadius: '12px', cursor: 'pointer', minHeight: '40px',
              border: `2px solid ${active ? C.primary : C.border}`,
              background: active ? `${C.primary}12` : C.bg,
              color: active ? C.primary : C.muted,
              fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 700,
            }}>
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filtros de busca"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(42,36,32,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
      className="md:items-center md:justify-center"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.card, padding: '24px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        className="rounded-t-[28px] md:rounded-[24px] md:max-w-md md:shadow-2xl"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '22px', fontWeight: 800, color: C.text, margin: 0 }}>Filtros</h3>
          <button
            onClick={onClose}
            aria-label="Fechar filtros"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '22px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}
          >✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Região */}
          <div>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Região</p>
            <input
              value={draft.regiao}
              onChange={e => set('regiao', e.target.value)}
              placeholder="Ex: Pinheiros, Lapa..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: `1.5px solid ${C.border}`, fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.text, outline: 'none', boxSizing: 'border-box', background: C.bg }}
            />
          </div>

          {/* Tipo de imóvel */}
          <div>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Tipo de imóvel</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {TIPO_IMOVEL_OPTS.map(opt => {
                const active = draft.tipo_imovel === opt.value;
                return (
                  <button key={opt.value} onClick={() => set('tipo_imovel', opt.value)} style={{
                    padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
                    border: `2px solid ${active ? C.primary : C.border}`,
                    background: active ? `${C.primary}12` : C.bg,
                    color: active ? C.primary : C.muted,
                    fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 700,
                  }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aceita pets */}
          {triBtn('Aceita pets', 'aceita_pets')}

          {/* Fumante */}
          {triBtn('Fumante', 'fumante')}

          {/* Orçamento */}
          <div>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Faixa de orçamento</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Mínimo"
                  placeholder="R$ 500"
                  value={draft.orcamento_min}
                  onChange={v => set('orcamento_min', v)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  label="Máximo"
                  placeholder="R$ 2.000"
                  value={draft.orcamento_max}
                  onChange={v => set('orcamento_max', v)}
                />
              </div>
            </div>
          </div>

          {/* Score mínimo */}
          <div>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>
              Compatibilidade mínima: <span style={{ color: C.primary }}>{draft.score_min}%</span>
            </p>
            <input
              type="range" min={0} max={100} step={5}
              value={draft.score_min}
              onChange={e => set('score_min', parseInt(e.target.value))}
              style={{ width: '100%', accentColor: C.primary }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Nunito,sans-serif', fontSize: '11px', color: C.muted, marginTop: '2px' }}>
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>

          {/* Ordenar */}
          <div>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Ordenar por</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([
                { value: 'compatibilidade', label: 'Mais compatível' },
                { value: 'menor_preco', label: 'Menor preço' },
                { value: 'maior_preco', label: 'Maior preço' },
              ] as const).map(opt => {
                const active = draft.ordenar === opt.value;
                return (
                  <button key={opt.value} onClick={() => set('ordenar', opt.value)} style={{
                    padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
                    border: `2px solid ${active ? C.primary : C.border}`,
                    background: active ? `${C.primary}12` : C.bg,
                    color: active ? C.primary : C.muted,
                    fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 700,
                  }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
          <Btn label="Limpar filtros" outline onClick={onClear} />
          <Btn label="Aplicar filtros" onClick={() => onApply(draft)} />
        </div>
      </div>
    </div>
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

  useEffect(() => {
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
  }, []);

  const abrirChat = (m: MatchData) => {
    const outro = m.perfil_a.id === meuPerfilId ? m.perfil_b : m.perfil_a;
    setCurrentChat(perfilBasicoParaProfile(outro, m.score));
    setActiveChatMatchId(m.id);
    nav('chat');
  };

  return (
    <div className="flex flex-col flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
      <div style={{ padding: '20px 24px 12px' }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Notificações</h1>
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: 0 }}>
          {loading ? 'Carregando...' : erro ? ' ' : matches.length === 0 ? 'Tudo em dia' : `${matches.length} novo${matches.length !== 1 ? 's' : ''} match${matches.length !== 1 ? 'es' : ''}`}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.muted }}>Carregando...</p>
          </div>
        )}

        {!loading && erro && (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.danger }}>{erro}</p>
          </div>
        )}

        {!loading && !erro && matches.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '12px' }}>
            <div style={{ width: '72px', height: '72px', background: `${C.primary}18`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            </div>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '18px', fontWeight: 700, color: C.text, margin: 0 }}>Nenhuma novidade</p>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: 0, textAlign: 'center', maxWidth: '260px' }}>
              Quando alguém curtir você de volta, você verá o match aqui.
            </p>
            <button
              onClick={() => nav('discovery')}
              style={{ marginTop: '4px', padding: '10px 20px', borderRadius: '14px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
            >
              Ir para a Descoberta
            </button>
          </div>
        )}

        {!loading && !erro && matches.map(m => {
          const outro = m.perfil_a.id === meuPerfilId ? m.perfil_b : m.perfil_a;
          const compat = Math.round(m.score * 100);
          const level = getCompatLevel(compat);
          const foto = outro.fotos_imovel?.[0] ?? PLACEHOLDER_PHOTOS[outro.id % PLACEHOLDER_PHOTOS.length];
          return (
            <button
              key={m.id}
              onClick={() => abrirChat(m)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div style={{ flexShrink: 0, width: '58px', height: '58px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${level.color}` }}>
                <img src={foto} alt={outro.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text }}>
                    {outro.nome}
                  </span>
                  <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted, flexShrink: 0, marginLeft: '8px' }}>
                    {tempoRelativo(m.data_match)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    background: `${level.color}22`, color: level.color,
                    borderRadius: '8px', padding: '2px 8px',
                    fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 800,
                  }}>
                    {compat}% compatível
                  </span>
                  <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted }}>
                    Toque para conversar →
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
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: '0 0 8px' }}>
          Interesse mútuo confirmado
        </h1>
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: 0 }}>
          Vocês dois demonstraram interesse. Conversem para combinar os detalhes da vaga.
        </p>
      </div>

      {/* Cartão */}
      <div style={{
        width: '100%', maxWidth: '420px',
        background: C.card, borderRadius: '20px',
        border: `1px solid ${C.border}`,
        boxShadow: '0 4px 24px rgba(42,36,32,0.08)',
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
              <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '17px', fontWeight: 800, color: C.text, margin: '0 0 5px' }}>
                {profile.tituloAnuncio ?? profile.name}
              </h2>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: '0 0 8px' }}>
                📍 {profile.region} · {IMOVEL_LABEL[profile.tipoImovel] ?? profile.tipoImovel} · {profile.qtdMoradores} morador{profile.qtdMoradores !== 1 ? 'es' : ''}
              </p>
              <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 12px' }}>
                {profile.budget}
                <span style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 400, fontSize: '13px', color: C.muted }}> / mês</span>
              </p>
              <span style={{
                display: 'inline-block',
                background: `${C.mint}22`, color: C.text,
                borderRadius: '20px', padding: '3px 12px',
                fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700,
                marginBottom: '14px',
              }}>
                {profile.compat}% de compatibilidade
              </span>
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
                <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted }}>
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
              <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
                {profile.name}
              </h2>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: 0 }}>
                {profile.age} anos · {profile.region}
              </p>
            </div>
            <span style={{
              background: `${C.mint}22`, color: C.text,
              borderRadius: '20px', padding: '4px 14px',
              fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700,
            }}>
              {profile.compat}% de compatibilidade
            </span>
          </div>
        )}
      </div>

      {/* Botões */}
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={() => { setCurrentChat(profile); nav('chat'); }}
          style={{
            width: '100%', padding: '15px', background: C.primary, color: '#fff',
            border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 700,
            fontFamily: 'Outfit,sans-serif', cursor: 'pointer',
          }}
        >
          Enviar mensagem
        </button>
        <button
          onClick={() => nav('matches')}
          style={{
            width: '100%', padding: '15px', background: 'transparent', color: C.primary,
            border: `2px solid ${C.primary}`, borderRadius: '16px', fontSize: '16px', fontWeight: 700,
            fontFamily: 'Outfit,sans-serif', cursor: 'pointer',
          }}
        >
          Ver meus matches
        </button>
        <button
          onClick={() => nav('discovery')}
          style={{
            width: '100%', padding: '12px', background: 'transparent', color: C.muted,
            border: 'none', borderRadius: '16px', fontSize: '14px', fontWeight: 600,
            fontFamily: 'Outfit,sans-serif', cursor: 'pointer',
          }}
        >
          Continuar buscando
        </button>
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
    photo: PLACEHOLDER_PHOTOS[p.id % PLACEHOLDER_PHOTOS.length],
    tags: [],
    budget: '',
    smoker: false, pets: false, organized: 3, messy: 3,
    horario: 'flexivel', ruido: 3, social: 3,
    visitas: 'as_vezes', tipoImovel: 'indiferente', qtdMoradores: 2,
    usuarioId: p.usuario_id,
  };
}

function MatchesScreen({ nav, setCurrentChat, setActiveChatMatchId, meuPerfilId }: {
  nav: (s: Screen) => void;
  setCurrentChat: (p: Profile) => void;
  setActiveChatMatchId: (id: number) => void;
  meuPerfilId: number | null;
}) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [search, setSearch] = useState('');
  const [naoLidas, setNaoLidas] = useState(false);
  const matchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Seus Matches</h1>
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: 0 }}>
          {loading ? 'Carregando...' : erro ? ' ' : `${conversas.length} conversa${conversas.length !== 1 ? 's' : ''}`}
        </p>
        {/* Search + nao_lidas */}
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
              style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => handleMatchSearch(e.target.value)}
              placeholder="Buscar conversa..."
              style={{
                width: '100%', padding: '9px 10px 9px 32px', borderRadius: '12px',
                border: `1.5px solid ${C.border}`, background: C.card,
                fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.text, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={() => handleNaoLidasToggle(!naoLidas)}
            style={{
              padding: '9px 14px', borderRadius: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
              border: `1.5px solid ${naoLidas ? C.primary : C.border}`,
              background: naoLidas ? `${C.primary}12` : C.card,
              color: naoLidas ? C.primary : C.muted,
              fontFamily: 'Nunito,sans-serif', fontSize: '12px', fontWeight: 700,
            }}
          >
            Só não lidas
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.muted }}>Carregando conversas...</p>
          </div>
        )}

        {!loading && erro && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px', gap: '16px' }}>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.danger, textAlign: 'center' }}>{erro}</p>
            <Btn label="Tentar novamente" small onClick={() => carregar(search, naoLidas)} style={{ maxWidth: '200px' }} />
          </div>
        )}

        {!loading && !erro && conversas.length === 0 && (search || naoLidas) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '12px' }}>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '17px', fontWeight: 700, color: C.text, margin: 0 }}>Nenhuma conversa encontrada</p>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: 0, textAlign: 'center', maxWidth: '260px' }}>
              Tente outros termos ou remova os filtros aplicados.
            </p>
          </div>
        )}
        {!loading && !erro && conversas.length === 0 && !search && !naoLidas && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '12px' }}>
            <div style={{ width: '72px', height: '72px', background: `${C.primary}18`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
            </div>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '18px', fontWeight: 700, color: C.text, margin: 0 }}>Você ainda não tem matches</p>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: 0, textAlign: 'center', maxWidth: '260px' }}>
              Curta perfis na tela de Descoberta. Quando alguém curtir você de volta, aparece aqui!
            </p>
            <button
              onClick={() => nav('discovery')}
              style={{ marginTop: '4px', padding: '10px 20px', borderRadius: '14px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
            >
              Ir para a Descoberta
            </button>
          </div>
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
                  padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: '58px', height: '58px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${level.color}` }}>
                      <img src={profile.photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{
                      position: 'absolute', bottom: '-2px', right: '-2px',
                      background: level.color, borderRadius: '10px', border: '2px solid white',
                      padding: '1px 5px', fontSize: '10px', fontWeight: 800,
                      fontFamily: 'Outfit,sans-serif', color: '#fff', lineHeight: '14px',
                    }}>
                      {profile.compat}%
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text }}>{profile.name}</span>
                      {c.nao_lidas > 0 && (
                        <span style={{
                          background: C.primary, color: '#fff', borderRadius: '12px',
                          padding: '1px 7px', fontSize: '11px', fontWeight: 800,
                          fontFamily: 'Outfit,sans-serif', flexShrink: 0,
                        }}>
                          {c.nao_lidas}
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontFamily: 'Nunito,sans-serif', fontSize: '13px',
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
                  border: `2px solid ${level.color}30`, borderRadius: '20px', overflow: 'hidden',
                  cursor: 'pointer', textAlign: 'left', padding: 0,
                  boxShadow: `0 4px 20px ${level.color}18`, position: 'relative',
                }}>
                  {c.nao_lidas > 0 && (
                    <span style={{
                      position: 'absolute', top: '10px', right: '10px', zIndex: 2,
                      background: C.primary, color: '#fff', borderRadius: '12px',
                      padding: '2px 8px', fontSize: '12px', fontWeight: 800,
                      fontFamily: 'Outfit,sans-serif',
                    }}>
                      {c.nao_lidas} nova{c.nao_lidas !== 1 ? 's' : ''}
                    </span>
                  )}
                  <div style={{ position: 'relative', height: '160px', flexShrink: 0 }}>
                    <img src={profile.photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', top: '10px', left: '10px',
                      background: `${level.color}EE`, borderRadius: '10px', padding: '3px 10px',
                      fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 800, color: '#fff',
                    }}>
                      {level.label}
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>
                      <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text }}>{profile.name}</span>
                      <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted, marginLeft: '6px' }}>{profile.age} anos · {profile.region}</span>
                    </div>
                    <p style={{
                      fontFamily: 'Nunito,sans-serif', fontSize: '13px',
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
        if (novas.length > 0) {
          setMessages(prev => [...prev, ...novas]);
          lastIdRef.current = novas[novas.length - 1].id;
        }
      } catch { /* falha silenciosa no poll */ }
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
      setMessages(prev => [...prev, nova]);
      lastIdRef.current = nova.id;
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

  const formatTime = (dt: string) =>
    new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col flex-1" style={{ background: C.bg, overflow: 'hidden' }}>
      <div className="flex flex-col flex-1 w-full max-w-3xl mx-auto" style={{ overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: C.card, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button aria-label="Voltar" onClick={() => nav('matches')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.muted }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.primary}` }}>
            <img src={profile.photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: 0 }}>{profile.name}</p>
            <CompatBadge value={profile.compat} />
          </div>
          <div style={{ position: 'relative' }}>
            <button aria-label="Mais opções" onClick={() => setShowMenu(m => !m)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: C.muted }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: '36px', background: C.card, borderRadius: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', border: `1px solid ${C.border}`, zIndex: 50, minWidth: '160px', overflow: 'hidden' }}>
                {['Ver perfil', 'Denunciar'].map(opt => (
                  <button key={opt} onClick={() => { setShowMenu(false); if (opt === 'Denunciar') setShowReport(true); if (opt === 'Ver perfil') onVerPerfil(); }} style={{
                    display: 'block', width: '100%', padding: '14px 16px',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 600,
                    color: opt === 'Denunciar' ? C.danger : C.text,
                  }}>{opt}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>Carregando mensagens...</p>
            </div>
          )}
          {!loading && erro && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 0' }}>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.danger, textAlign: 'center' }}>{erro}</p>
              <Btn label="Tentar novamente" small onClick={carregarMensagens} style={{ maxWidth: '200px' }} />
            </div>
          )}
          {!loading && !erro && messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>Diga olá! Combinem os detalhes da vaga.</p>
            </div>
          )}
          {messages.map(msg => {
            const isMe = msg.remetente_id === meuPerfilId;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '70%', padding: '11px 15px',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMe ? C.primary : C.card,
                  color: isMe ? '#fff' : C.text,
                  border: isMe ? 'none' : `1px solid ${C.border}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}>
                  <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', lineHeight: 1.5, margin: '0 0 4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.conteudo}</p>
                  <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '11px', color: isMe ? 'rgba(255,255,255,0.7)' : C.muted, margin: 0, textAlign: 'right' }}>
                    {formatTime(msg.data_envio)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Erro de envio */}
        {sendError && (
          <div style={{ padding: '6px 16px 2px', background: `${C.danger}12`, borderTop: `1px solid ${C.danger}30` }}>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.danger, margin: 0 }}>{sendError}</p>
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
              maxLength={1000}
              rows={1}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '22px',
                border: `1.5px solid ${C.border}`, background: C.bg,
                fontSize: '14px', fontFamily: 'Nunito,sans-serif', color: C.text,
                outline: 'none', resize: 'none', boxSizing: 'border-box', display: 'block',
              }}
            />
            {input.length > 900 && (
              <span style={{ position: 'absolute', bottom: '-14px', right: '8px', fontSize: '10px', color: input.length >= 1000 ? C.danger : C.muted, fontFamily: 'Nunito,sans-serif' }}>
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
              background: sending || !input.trim() ? C.border : C.primary,
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

function MyProfileScreen({ nav, meuPerfil, tipo, onPerfilAtualizado, onPerfilExcluido, onLogout }: {
  nav: (s: Screen) => void;
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

  return (
    <div className="flex flex-col flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
      <div style={{ padding: '20px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: 0 }}>Meu Perfil</h1>
        {editing
          ? <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={cancelarEdicao} disabled={loading} style={{ background: 'none', border: `1.5px solid ${C.border}`, color: C.muted, borderRadius: '12px', padding: '8px 16px', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={loading} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: '12px', padding: '8px 16px', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? 'Salvando...' : 'Salvar'}</button>
            </div>
          : <button onClick={() => setEditing(true)} style={{ background: 'none', border: `1.5px solid ${C.primary}`, color: C.primary, borderRadius: '12px', padding: '8px 16px', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Editar</button>
        }
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        <div className="lg:flex lg:gap-8 lg:items-start">

          {/* Left column: avatar + tags (desktop only shows tags here) */}
          <div className="lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-6">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '20px', background: C.card, borderRadius: '20px', border: `1px solid ${C.border}` }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${C.primary}`, flexShrink: 0 }}>
                <img src={MY_PROFILE.photo} alt="Você" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 800, color: C.text, margin: '0 0 2px' }}>{meuPerfil?.nome || MY_PROFILE.name}</h2>
                <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: '0 0 6px' }}>{meuPerfil?.idade || MY_PROFILE.age} anos · {meuPerfil?.regiao || MY_PROFILE.region}</p>
              </div>
            </div>

            {/* Tags on desktop (view mode only) */}
            {!editing && (
              <div className="hidden lg:flex" style={{ gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {MY_PROFILE.tags.map(t => <Tag key={t} label={t} />)}
              </div>
            )}
          </div>

          {/* Right column: content + actions */}
          <div className="flex-1">
            {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginBottom: '12px', textAlign: 'center' }}>{erro}</p>}

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
                <EtapaPessoal form={form} setForm={setForm} errors={editFieldErrors} />
                <EtapaMoradia form={form} setForm={setForm} errors={editFieldErrors} />
                <EtapaConvivencia form={form} setForm={setForm} errors={editFieldErrors} />
                <EtapaHabitos form={form} setForm={setForm} errors={editFieldErrors} />
                {anuncio && (
                  <div>
                    <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 800, color: C.text, margin: '0 0 14px' }}>Anúncio do imóvel</h3>
                    <EtapaAnuncio form={form} setForm={setForm} errors={editFieldErrors} />
                  </div>
                )}
              </div>
            ) : (
              <>
                <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
                  <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 10px' }}>Sobre mim</h3>
                  <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.text, lineHeight: 1.7, margin: 0 }}>{meuPerfil?.bio || MY_PROFILE.bio}</p>
                </div>

                <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
                  <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 14px' }}>Preferências de moradia</h3>
                  {[
                    { label: 'Orçamento', value: meuPerfil ? `R$ ${meuPerfil.orcamento_min} – R$ ${meuPerfil.orcamento_max}` : MY_PROFILE.budget },
                    { label: 'Tipo de imóvel', value: meuPerfil ? (IMOVEL_LABEL[meuPerfil.tipo_imovel] ?? meuPerfil.tipo_imovel) : IMOVEL_LABEL[MY_PROFILE.tipoImovel] },
                    { label: 'Moradores', value: (() => { const n = meuPerfil?.qtd_moradores ?? MY_PROFILE.qtdMoradores; return `${n}${n === 4 ? '+' : ''} pessoa${n > 1 ? 's' : ''}`; })() },
                    { label: 'Fumante', value: meuPerfil ? (meuPerfil.fumante ? 'Sim' : 'Não') : (MY_PROFILE.smoker ? 'Sim' : 'Não') },
                    { label: 'Aceita pets', value: meuPerfil ? (meuPerfil.aceita_pets ? 'Sim' : 'Não') : (MY_PROFILE.pets ? 'Sim' : 'Não') },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                      <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
                  <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 14px' }}>Convivência</h3>
                  {[
                    { label: 'Horário', value: HORARIO_LABEL[meuPerfil?.perfil_horario ?? MY_PROFILE.horario] },
                    { label: 'Visitas', value: VISITAS_LABEL[meuPerfil?.aceita_visitas ?? MY_PROFILE.visitas] },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                      <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
                  <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 14px' }}>Hábitos</h3>
                  {([
                    { label: 'Organização', value: meuPerfil?.nivel_organizacao ?? MY_PROFILE.organized },
                    { label: 'Tolerância à bagunça', value: meuPerfil?.tolerancia_bagunca ?? MY_PROFILE.messy },
                    { label: 'Tolerância a barulho', value: meuPerfil?.nivel_ruido ?? MY_PROFILE.ruido },
                    { label: 'Perfil social', value: meuPerfil?.nivel_social ?? MY_PROFILE.social },
                  ] as { label: string; value: number }[]).map(row => (
                    <div key={row.label} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                        <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: C.primary }}>{row.value}/5</span>
                      </div>
                      <ScaleBar value={row.value} />
                    </div>
                  ))}
                </div>

                {anuncio && meuPerfil && (meuPerfil.titulo_anuncio || meuPerfil.descricao_imovel || (meuPerfil.fotos_imovel?.length ?? 0) > 0) && (
                  <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
                    <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 10px' }}>Meu anúncio</h3>
                    {meuPerfil.titulo_anuncio && <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>{meuPerfil.titulo_anuncio}</p>}
                    {meuPerfil.descricao_imovel && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.text, lineHeight: 1.7, margin: '0 0 12px' }}>{meuPerfil.descricao_imovel}</p>}
                    {(meuPerfil.fotos_imovel?.length ?? 0) > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {meuPerfil.fotos_imovel!.map((u, i) => (
                          <div key={u + i} style={{ width: '96px', height: '72px', borderRadius: '10px', overflow: 'hidden', border: `1.5px solid ${C.border}` }}>
                            <ImagemComFallback src={u} alt={`Foto ${i + 1} do imóvel`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tags on mobile */}
                <div className="lg:hidden" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                  {MY_PROFILE.tags.map(t => <Tag key={t} label={t} />)}
                </div>
              </>
            )}

            <button onClick={handleLogout} style={{
              width: '100%', padding: '15px', background: 'none',
              border: `1.5px solid ${C.border}`, borderRadius: '16px',
              fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.muted, cursor: 'pointer',
            }}>
              Sair da conta
            </button>
            {meuPerfil && <button onClick={() => setShowDeleteModal(true)} style={{
              width: '100%', padding: '15px', marginTop: '10px', background: 'none',
              border: `1.5px solid ${C.danger}`, borderRadius: '16px',
              fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.danger, cursor: 'pointer',
            }}>
              Excluir perfil
            </button>}
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, loading]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Excluir perfil"
      onClick={() => { if (!loading) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(42,36,32,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.card, padding: '24px', width: '100%', maxWidth: '420px', margin: '0 16px', borderRadius: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 800, color: C.text, margin: 0 }}>Excluir perfil?</h3>
          <button
            onClick={onClose}
            aria-label="Fechar modal"
            disabled={loading}
            style={{ background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', color: C.muted, fontSize: '22px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', opacity: loading ? 0.4 : 1 }}
          >✕</button>
        </div>
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: '0 0 24px', lineHeight: 1.6 }}>
          Ao excluir seu perfil, você perderá todas as suas curtidas, matches e conversas. Esta ação não pode ser desfeita.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Btn label="Cancelar" outline onClick={onClose} disabled={loading} />
          <Btn label={loading ? 'Excluindo...' : 'Excluir definitivamente'} danger onClick={onConfirm} disabled={loading} />
        </div>
      </div>
    </div>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleEnviar = async () => {
    if (!motivo) { setErro('Selecione um motivo.'); return; }
    setErro('');
    setLoading(true);
    try {
      await criarDenuncia(denunciadoUsuarioId, motivo, descricao);
      setSucesso(true);
      setTimeout(onClose, 2500);
    } catch (e: unknown) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível enviar a denúncia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Denunciar usuário"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(42,36,32,0.5)', zIndex: 100, display: 'flex', alignItems: sucesso ? 'center' : 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.card, padding: '24px', width: '100%' }}
        className={sucesso ? 'rounded-[24px] max-w-sm mx-4 shadow-2xl' : 'rounded-t-[28px] md:rounded-[24px] md:max-w-md md:shadow-2xl'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 800, color: C.text, margin: 0 }}>Denunciar usuário</h3>
          <button
            onClick={onClose}
            aria-label="Fechar denúncia"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '22px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}
          >✕</button>
        </div>

        {sucesso ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '18px', fontWeight: 800, color: C.mint, margin: '0 0 8px' }}>Denúncia enviada!</p>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: 0 }}>Nossa equipe vai analisar.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {MOTIVOS_UI.map(m => (
                <button key={m.value} onClick={() => { setMotivo(m.value); setErro(''); }} style={{
                  padding: '13px 16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', minHeight: '44px',
                  border: `1.5px solid ${motivo === m.value ? C.danger : C.border}`,
                  background: motivo === m.value ? `${C.danger}10` : C.bg,
                  color: motivo === m.value ? C.danger : C.text,
                  fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 600,
                }}>
                  {m.label}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: C.muted, fontFamily: 'Nunito,sans-serif' }}>Descrição (opcional)</label>
                <span style={{ fontSize: '12px', color: C.muted, fontFamily: 'Nunito,sans-serif' }}>{descricao.length}/500</span>
              </div>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value.slice(0, 500))}
                placeholder="Descreva o ocorrido com mais detalhes..."
                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${C.border}`, background: C.bg, fontSize: '14px', fontFamily: 'Nunito,sans-serif', color: C.text, outline: 'none', resize: 'none', height: '80px', boxSizing: 'border-box' }}
              />
            </div>

            {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginBottom: '12px', textAlign: 'center' }}>{erro}</p>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <Btn label="Cancelar" outline onClick={onClose} />
              <Btn label={loading ? 'Enviando...' : 'Enviar denúncia'} danger onClick={handleEnviar} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function getParam(name: string) {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

// Navegação: a tela atual fica na URL (?screen=...) e no histórico do navegador.
const TELAS_PUBLICAS: Screen[] = ['welcome', 'login', 'register'];
const TELAS_DE_ABA: Screen[] = ['discovery', 'notifications', 'matches', 'profile'];
// Dependem de estado em memória (perfil/conversa escolhidos): ao abrir direto pela URL, voltam à tela-mãe.
const TELA_SEM_ESTADO: Partial<Record<Screen, Screen>> = { 'profile-detail': 'discovery', match: 'matches', chat: 'matches' };

function temSessao(): boolean {
  try { return !!sessionStorage.getItem('pm_access'); } catch { return false; }
}

function registrarTelaNaUrl(s: Screen, substituir: boolean) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('screen', s);
    if (substituir) window.history.replaceState({ screen: s }, '', url);
    else window.history.pushState({ screen: s }, '', url);
  } catch { /* ambiente sem history */ }
}

export default function App() {
  const telaDaUrl = (getParam('screen') as Screen) || (temSessao() ? 'discovery' : 'welcome');
  const initialScreen: Screen = temSessao() ? (TELA_SEM_ESTADO[telaDaUrl] ?? telaDaUrl) : telaDaUrl;
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [restaurando, setRestaurando] = useState<boolean>(temSessao());
  const [tab, setTab] = useState<Tab>(
    (initialScreen === 'discovery' || initialScreen === 'notifications' || initialScreen === 'matches' || initialScreen === 'profile')
      ? (initialScreen as Tab)
      : 'discovery'
  );
  const [matchProfile, setMatchProfile] = useState<Profile>(PROFILES[0]);
  const [selectedProfile, setSelectedProfile] = useState<Profile>(PROFILES[0]);
  const [currentChat, setCurrentChat] = useState<Profile>(PROFILES[0]);
  const [activeChatMatchId, setActiveChatMatchId] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(getParam('filters') === '1');
  const [showReport, setShowReport] = useState(getParam('report') === '1');
  const [meuPerfil, setMeuPerfil] = useState<PerfilAPI | null>(null);
  const [meuTipo, setMeuTipo] = useState('');
  const [matchesKey, setMatchesKey] = useState(0);
  const [notifsKey, setNotifsKey] = useState(0);
  const [notifsCount, setNotifsCount] = useState(0);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState('');
  const [prevScreen, setPrevScreen] = useState<Screen>('discovery');

  const nav = (s: Screen) => {
    setScreen(s);
    if (s !== screen) registrarTelaNaUrl(s, false);
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
    logout();
    setMeuPerfil(null);
    setMeuTipo('');
    setNotifsCount(0);
    setActiveChatMatchId(0);
    setCurrentChat(PROFILES[0]);
    setSelectedProfile(PROFILES[0]);
    setSessionExpiredMsg('');
    nav('welcome');
  };

  useEffect(() => {
    setOn401(() => {
      setMeuPerfil(null);
      setMeuTipo('');
      setNotifsCount(0);
      setActiveChatMatchId(0);
      setCurrentChat(PROFILES[0]);
      setSelectedProfile(PROFILES[0]);
      setSessionExpiredMsg('Sua sessão expirou. Entre novamente.');
      setScreen('login');
      registrarTelaNaUrl('login', true);
      setTab('discovery');
    });
  }, []);

  // Estado inicial da URL no histórico + botão voltar/avançar do navegador.
  useEffect(() => {
    registrarTelaNaUrl(initialScreen, true);
    const onPop = (e: PopStateEvent) => {
      const s = ((e.state as { screen?: Screen } | null)?.screen ?? (getParam('screen') as Screen | null) ?? 'welcome') as Screen;
      setScreen(s);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          setScreen(s => {
            if (TELAS_PUBLICAS.includes(s)) return s;
            if (!perfil) return 'profile-create';
            return s === 'profile-create' || s === 'admin' ? 'discovery' : s;
          });
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
      nav(perfil ? 'discovery' : 'profile-create');
    } catch {
      nav('profile-create');
    }
  };

  if (restaurando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg" style={{ color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '15px' }}>
        Carregando...
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
      {telaAtual === 'register' && <RegisterScreen nav={nav} onLoginSuccess={handleLoginSuccess} />}
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
            try { await enviarCurtida(p.id, 'recusar'); } catch { /* a Descoberta recarrega a lista de qualquer forma */ }
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
            } catch {
              nav('discovery');
            }
          }}
        />
      )}
      {telaAtual === 'match' && <MatchScreen nav={nav} profile={matchProfile} setCurrentChat={setCurrentChat} />}
      {telaAtual === 'matches' && (
        <MatchesScreen key={matchesKey} nav={nav} setCurrentChat={setCurrentChat} setActiveChatMatchId={setActiveChatMatchId} meuPerfilId={meuPerfil?.id ?? null} />
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
          nav={nav}
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
