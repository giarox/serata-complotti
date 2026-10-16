export type Phase = 'waiting' | 'presenting' | 'questions' | 'voting' | 'results';
/** How someone presents: Google Slides, paper/props/voice, or not at all. null = not decided yet. */
export type Mode = 'slides' | 'paper' | 'none';
export type Participant = {
  id: string;
  /** The alias chosen at registration: a code name, real identity optional. */
  name: string;
  /** The silly congress title, e.g. "Studioso dei finti uccelli". */
  role: string;
  title: string;
  deckUrl: string;
  mode: Mode | null;
  /** Kept in sync with mode === 'none' (older data and the vote rules use it). */
  spectator: boolean;
};
export type Round = { id: string; presenterId: string; closed: boolean; cancelled?: boolean };
export type Ballot = { credibility: number; delivery: number; research: number; supercazzola: boolean };
export type Vote = Ballot & { roundId: string; voterId: string };
/** The GM may also have a participantId: then they present and vote like everyone else. */
export type Actor = { role: 'gm' | 'guest' | 'screen'; participantId?: string };
export type CategoryKey = keyof Ballot;
/**
 * Award rules still to be confirmed. Defaults keep the current behaviour:
 * no cap, reveal in the order of the ballot, spectators vote.
 */
export type Settings = {
  /** Maximum awards one person can win. null = no cap. */
  maxAwards: number | null;
  /** Reveal order; previous awards in this order feed the tie-break and the cap. */
  awardOrder: CategoryKey[];
  /** Whether names marked "Solo pubblico" receive a ballot. */
  spectatorsVote: boolean;
};
export type State = {
  phase: Phase;
  activeRoundId: string | null;
  participants: Participant[];
  rounds: Round[];
  votes: Vote[];
  voteCount?: number;
  /** Names currently claimed by a guest phone. Only sent to the GM, only in live mode. */
  claimed?: string[];
  revealed: number;
  revision: number;
  settings: Settings;
};
export type Action =
  | { type: 'start'; participantId: string }
  | { type: 'phase'; phase: Phase; roundId: string }
  | { type: 'vote'; roundId: string; ballot: Ballot }
  | { type: 'cancel'; roundId: string }
  | { type: 'reveal' }
  | { type: 'nextAward' }
  | { type: 'participant'; participant: Participant }
  | { type: 'register'; id: string; name: string }
  | { type: 'release'; participantId: string }
  | { type: 'settings'; settings: Settings };
export const categories = [
  {
    key: 'credibility',
    title: 'MA SAI CHE…',
    label: 'Credibilità',
    description: 'Quanto ti ha fatto dubitare delle tue certezze?',
  },
  {
    key: 'delivery',
    title: 'NON SONO UN ESPERTO, MA…',
    label: 'Esposizione',
    description: 'Quanto ti ha coinvolto e divertito?',
  },
  {
    key: 'research',
    title: 'HO FATTO LE MIE RICERCHE',
    label: 'Le prove',
    description: 'Quanto erano approfondite le sue ricerche?',
  },
  {
    key: 'supercazzola',
    title: 'SUPERCAZZOLA',
    label: 'Supercazzola',
    description: 'La risposta al question time merita un sì?',
  },
] as const;
export const categoryKeys: CategoryKey[] = categories.map((c) => c.key);
export const category = (key: CategoryKey) => categories.find((c) => c.key === key)!;
export const defaultSettings = (): Settings => ({
  maxAwards: null,
  awardOrder: [...categoryKeys],
  spectatorsVote: true,
});
export const phaseNames: Record<Phase, string> = {
  waiting: 'Sala d’attesa',
  presenting: 'Presentazione',
  questions: 'Question time',
  voting: 'Votazione aperta',
  results: 'Il verdetto',
};
export const modes: { key: Mode; label: string; short: string; hint: string }[] = [
  {
    key: 'slides',
    label: 'Con le slide',
    short: 'Slide',
    hint: 'Google Slides, animazioni e video compresi.',
  },
  {
    key: 'paper',
    label: 'Alla vecchia maniera',
    short: 'Dal vivo',
    hint: 'Fogli, cartelloni, oggetti sospetti o solo la voce.',
  },
  {
    key: 'none',
    label: 'Solo pubblico',
    short: 'Pubblico',
    hint: 'Niente palco: ascolti, fai domande scomode e voti.',
  },
];
export const presents = (p: Participant) => p.mode === 'slides' || p.mode === 'paper';
export const slidesUrlPattern = /^https:\/\/docs\.google\.com\/presentation\//;
/** What is still missing before the evening, in plain words. Empty = dossier complete. */
export function dossierGaps(p: Participant): string[] {
  const gaps: string[] = [];
  if (p.mode === 'none') return gaps;
  if (!p.role.trim()) gaps.push('titolo da congresso');
  if (!p.title.trim()) gaps.push('titolo della rivelazione');
  if (!p.mode) gaps.push('come presenti');
  if (p.mode === 'slides' && !p.deckUrl) gaps.push('link delle slide');
  return gaps;
}
export function cleanName(raw: string) {
  return raw.trim().replace(/\s+/g, ' ');
}
/** A readable unique id from the name, e.g. "paolo-pesaresi-k3x9". */
export function makeId(name: string, random = Math.random().toString(36).slice(2, 6)) {
  const slug = cleanName(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  return (slug || 'agente') + '-' + random;
}
function normalizeParticipant(p: Participant): Participant {
  const mode: Mode | null = p.mode ?? (p.spectator ? 'none' : p.title ? (p.deckUrl ? 'slides' : 'paper') : null);
  return { ...p, role: p.role ?? '', title: p.title ?? '', deckUrl: p.deckUrl ?? '', mode, spectator: mode === 'none' };
}
/** Why this participant's dossier cannot be changed right now by this actor, or null. */
export function editBlocker(s: State, actor: Actor, id: string): string | null {
  if (s.phase === 'results') return 'La serata è finita: i fascicoli sono agli atti.';
  const r = activeRound(s);
  if (r && !r.closed && r.presenterId === id) return 'Stai presentando: il fascicolo si modifica dopo.';
  if (actor.role !== 'gm' && s.rounds.some((x) => x.presenterId === id && !x.cancelled))
    return 'Hai già presentato: il fascicolo è agli atti.';
  return null;
}
export const activeRound = (s: State) => s.rounds.find((r) => r.id === s.activeRoundId);
export const presenter = (s: State) => s.participants.find((p) => p.id === activeRound(s)?.presenterId);
export const countVotes = (s: State) => s.voteCount ?? s.votes.filter((v) => v.roundId === s.activeRoundId).length;
/** Fills in fields added after a state was first saved (older demo data, or a live state without settings). */
export function normalize(s: State): State {
  return {
    ...s,
    participants: (s.participants ?? []).map(normalizeParticipant),
    settings: { ...defaultSettings(), ...(s.settings ?? {}) },
  };
}
export function validBallot(b: Ballot) {
  return (
    ['credibility', 'delivery', 'research'].every(
      (k) =>
        Number.isInteger(b[k as keyof Ballot]) &&
        Number(b[k as keyof Ballot]) >= 0 &&
        Number(b[k as keyof Ballot]) <= 10,
    ) && typeof b.supercazzola === 'boolean'
  );
}
export function validSettings(x: Settings) {
  return (
    (x.maxAwards === null || (Number.isInteger(x.maxAwards) && x.maxAwards >= 1 && x.maxAwards <= 4)) &&
    Array.isArray(x.awardOrder) &&
    x.awardOrder.length === 4 &&
    categoryKeys.every((k) => x.awardOrder.includes(k)) &&
    typeof x.spectatorsVote === 'boolean'
  );
}
/** Why this participant cannot vote in the current round, or null if they can. */
export function voteBlocker(s: State, participantId: string | undefined): string | null {
  const me = s.participants.find((p) => p.id === participantId);
  if (!me) return 'Scegli il tuo nome per votare.';
  if (activeRound(s)?.presenterId === me.id) return 'Non puoi votare il tuo intervento.';
  if (me.spectator && !s.settings.spectatorsVote) return 'In questa serata il pubblico non vota.';
  return null;
}
export function initialState(): State {
  return {
    phase: 'waiting',
    activeRoundId: null,
    rounds: [],
    votes: [],
    revealed: 0,
    revision: 0,
    settings: defaultSettings(),
    participants: [
      {
        id: 'paolo',
        name: 'Paolo',
        role: 'Studioso dei finti uccelli',
        title: 'PICCIONI FBI',
        deckUrl: '',
        mode: 'slides',
        spectator: false,
      },
      {
        id: 'giulia',
        name: 'Giulia',
        role: 'Cartografa delle verità scomode',
        title: 'LA TERRA È UN PROGETTO PILOTA',
        deckUrl: '',
        mode: 'paper',
        spectator: false,
      },
      {
        id: 'marco',
        name: 'Marco',
        role: 'Esperto di segnali sospetti',
        title: 'IL WI-FI CI LEGGE NEL PENSIERO',
        deckUrl: '',
        mode: 'paper',
        spectator: false,
      },
      {
        id: 'sara',
        name: 'Sara',
        role: 'Archivista delle coincidenze',
        title: 'NON È MAI SOLO UNA COINCIDENZA',
        deckUrl: '',
        mode: 'paper',
        spectator: false,
      },
      {
        id: 'gianluca',
        name: 'Gianluca',
        role: 'Direttore del congresso',
        title: 'IL DOSSIER MANCANTE',
        deckUrl: '',
        mode: 'paper',
        spectator: false,
      },
      {
        id: 'pubblico',
        name: 'Ospite demo',
        role: 'Osservatore indipendente',
        title: '',
        deckUrl: '',
        mode: 'none',
        spectator: true,
      },
    ],
  };
}
export function applyAction(source: State, actor: Actor, action: Action): State {
  const s = normalize(structuredClone(source));
  const guestAllowed =
    action.type === 'vote' ||
    action.type === 'register' ||
    (action.type === 'participant' && action.participant.id === actor.participantId);
  if (!guestAllowed && actor.role !== 'gm') throw new Error('Solo la regia può fare questa operazione.');
  if (action.type === 'start') {
    if (s.phase !== 'waiting') throw new Error('Concludi il turno prima di iniziarne un altro.');
    const p = s.participants.find((p) => p.id === action.participantId);
    if (!p || p.spectator || s.rounds.some((r) => r.presenterId === p.id && !r.cancelled))
      throw new Error('Questo relatore non è disponibile.');
    const round: Round = { id: crypto.randomUUID(), presenterId: p.id, closed: false };
    s.rounds.push(round);
    s.activeRoundId = round.id;
    s.phase = 'presenting';
  } else if (action.type === 'phase' || action.type === 'cancel') {
    const round = activeRound(s);
    if (!round || round.id !== action.roundId || round.closed)
      throw new Error('Il turno è cambiato. Aggiorna la pagina.');
    if (action.type === 'cancel') {
      if (s.phase === 'results') throw new Error('La serata è terminata.');
      round.closed = true;
      round.cancelled = true;
      s.phase = 'waiting';
      s.activeRoundId = null;
      s.votes = s.votes.filter((v) => v.roundId !== round.id);
    } else {
      const next: Partial<Record<Phase, Phase>> = { presenting: 'questions', questions: 'voting', voting: 'waiting' };
      if (next[s.phase] !== action.phase) throw new Error('Questo passaggio non è disponibile.');
      s.phase = action.phase;
      if (s.phase === 'waiting') {
        round.closed = true;
        s.activeRoundId = null;
      }
    }
  } else if (action.type === 'vote') {
    const round = activeRound(s);
    if (actor.role === 'screen' || !actor.participantId || !s.participants.some((p) => p.id === actor.participantId))
      throw new Error('Scegli il tuo nome per votare.');
    if (s.phase !== 'voting' || !round || round.closed || round.id !== action.roundId)
      throw new Error('Questa votazione è chiusa.');
    const blocker = voteBlocker(s, actor.participantId);
    if (blocker) throw new Error(blocker);
    if (!validBallot(action.ballot)) throw new Error('Completa tutti i voti: tre numeri interi da 0 a 10 e sì/no.');
    const vote = { ...action.ballot, roundId: round.id, voterId: actor.participantId };
    const i = s.votes.findIndex((v) => v.roundId === vote.roundId && v.voterId === vote.voterId);
    if (i >= 0) s.votes[i] = vote;
    else s.votes.push(vote);
  } else if (action.type === 'reveal') {
    if (s.phase !== 'waiting' || !s.rounds.some((r) => r.closed && !r.cancelled))
      throw new Error('Completa almeno un turno e chiudi il voto.');
    s.phase = 'results';
    s.revealed = 1;
  } else if (action.type === 'nextAward') {
    if (s.phase !== 'results' || s.revealed >= 4) throw new Error('Non ci sono altre categorie da svelare.');
    s.revealed++;
  } else if (action.type === 'release') {
    // Membership lives in Supabase; in the browser demo there is nothing to release.
    if (!s.participants.some((p) => p.id === action.participantId)) throw new Error('Nome non trovato.');
  } else if (action.type === 'settings') {
    if (s.phase === 'results') throw new Error('Le regole non si cambiano durante il reveal.');
    if (!validSettings(action.settings)) throw new Error('Regole dei premi non valide.');
    s.settings = {
      maxAwards: action.settings.maxAwards,
      awardOrder: [...action.settings.awardOrder],
      spectatorsVote: action.settings.spectatorsVote,
    };
  } else if (action.type === 'register') {
    if (actor.role !== 'guest' || actor.participantId) throw new Error('Sei già nel registro.');
    const name = cleanName(action.name);
    if (name.length < 2 || name.length > 40) throw new Error('Serve un alias da 2 a 40 caratteri. Inventa pure.');
    if (s.phase === 'results') throw new Error('La serata è finita: il registro è chiuso.');
    if (s.participants.some((p) => p.name.toLowerCase() === name.toLowerCase()))
      throw new Error(
        `L’alias “${name}” è già preso. Inventane un altro, oppure tocca “Sono già nel registro” se sei tu.`,
      );
    if (s.participants.some((p) => p.id === action.id)) throw new Error('Riprova, il codice agente era già preso.');
    s.participants.push({ id: action.id, name, role: '', title: '', deckUrl: '', mode: null, spectator: false });
  } else if (action.type === 'participant') {
    const p = normalizeParticipant({ ...action.participant, name: cleanName(action.participant.name) });
    const existing = s.participants.find((x) => x.id === p.id);
    if (!existing && actor.role !== 'gm') throw new Error('Questo fascicolo non è tuo.');
    if (p.name.length < 2 || p.name.length > 40) throw new Error('Serve un alias da 2 a 40 caratteri.');
    if (p.role.length > 80 || p.title.length > 120)
      throw new Error('Troppo lungo: i veri complotti stanno in una riga.');
    if (p.mode !== null && !modes.some((m) => m.key === p.mode)) throw new Error('Modo di presentare sconosciuto.');
    if (p.mode === 'slides' && p.deckUrl && !slidesUrlPattern.test(p.deckUrl.trim()))
      throw new Error(
        'Quello non sembra un link di Google Slides. Deve iniziare con https://docs.google.com/presentation/',
      );
    if (existing) {
      const blocker = editBlocker(s, actor, p.id);
      if (blocker) throw new Error(blocker);
      if (p.mode === 'none' && s.rounds.some((r) => r.presenterId === p.id && !r.cancelled))
        throw new Error('Ha già presentato: non può diventare solo pubblico.');
    }
    if (s.participants.some((x) => x.id !== p.id && x.name.toLowerCase() === p.name.toLowerCase()))
      throw new Error('Questo alias è già preso.');
    const clean: Participant = {
      id: p.id,
      name: p.name,
      role: p.role.trim(),
      title: p.title.trim(),
      deckUrl: p.mode === 'slides' ? p.deckUrl.trim() : '',
      mode: p.mode,
      spectator: p.mode === 'none',
    };
    const i = s.participants.findIndex((x) => x.id === p.id);
    if (i >= 0) s.participants[i] = clean;
    else s.participants.push(clean);
  }
  delete s.voteCount;
  delete s.claimed;
  s.revision++;
  return s;
}
export function snapshot(s: State, actor: Actor): State {
  return {
    ...normalize(structuredClone(s)),
    voteCount: countVotes(s),
    votes:
      s.phase === 'results'
        ? structuredClone(s.votes)
        : s.votes.filter((v) => actor.role !== 'screen' && !!actor.participantId && v.voterId === actor.participantId),
  };
}
export type Ranking = { participant: Participant; count: number; value: number | null };
export function rankings(s: State, key: CategoryKey): Ranking[] {
  return s.rounds
    .filter((r) => r.closed && !r.cancelled)
    .map((r) => {
      const votes = s.votes.filter((v) => v.roundId === r.id);
      return {
        participant: s.participants.find((p) => p.id === r.presenterId)!,
        count: votes.length,
        value: votes.length
          ? votes.reduce((n, v) => n + Number(v[key]), 0) / (key === 'supercazzola' ? 1 : votes.length)
          : null,
      };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
}
export type Award = {
  key: CategoryKey;
  rows: Ranking[];
  winners: Participant[];
  value: number | null;
  /**
   * none: nobody eligible scored (or Supercazzola got no yes at all).
   * clear: one top score. shared: tie, everyone tied keeps the prize (pari merito).
   * tieBreak: tie, the prize went only to tied people without an earlier award.
   */
  outcome: 'none' | 'clear' | 'shared' | 'tieBreak';
  /** People with an equal or higher score skipped because they reached the cap. */
  capped: Participant[];
  /** Tied people who lost the tie-break because they already had an award. */
  passedOver: Participant[];
};
/**
 * Assigns the four awards in reveal order. Averages are compared at full precision.
 * Tie rule from the brief: among tied people, those without an earlier award win;
 * if all or none of them already have one, the prize is shared.
 */
export function awards(s: State): Award[] {
  const { maxAwards, awardOrder } = normalize(s).settings;
  const won = new Map<string, number>();
  const wins = (id: string) => won.get(id) ?? 0;
  return awardOrder.map((key) => {
    const rows = rankings(s, key);
    const scored = rows.filter((r) => r.value !== null && !(key === 'supercazzola' && r.value === 0));
    const eligible = scored.filter((r) => maxAwards === null || wins(r.participant.id) < maxAwards);
    const top = eligible.length ? eligible[0].value! : null;
    const capped = scored
      .filter((r) => !eligible.includes(r) && (top === null || r.value! >= top))
      .map((r) => r.participant);
    if (top === null) return { key, rows, winners: [], value: null, outcome: 'none', capped, passedOver: [] };
    const tied = eligible.filter((r) => r.value === top).map((r) => r.participant);
    const fresh = tied.filter((p) => wins(p.id) === 0);
    const winners = fresh.length > 0 && fresh.length < tied.length ? fresh : tied;
    for (const w of winners) won.set(w.id, wins(w.id) + 1);
    return {
      key,
      rows,
      winners,
      value: top,
      outcome: tied.length === 1 ? 'clear' : winners.length < tied.length ? 'tieBreak' : 'shared',
      capped,
      passedOver: tied.filter((p) => !winners.includes(p)),
    };
  });
}
