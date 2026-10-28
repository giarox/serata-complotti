/** The GM's test deck, given to fake testers who present with slides. */
export const TEST_DECK =
  'https://docs.google.com/presentation/d/1wvHnevCRC5ULS4f80JO2EwpmQth2vts3zyAKK9SNJso/edit?usp=sharing';
/** The +1: comes along (witness) or presents together (co-speaker). */
export type Partner = 'witness' | 'copresenter';
export const cleanPartner = (v: unknown): Partner | null => (v === 'witness' || v === 'copresenter' ? v : null);
/** A request to join: pending until the GM admits it or puts it in reserve. */
export type Admission = 'pending' | 'admitted' | 'reserve';
export const admissions: Admission[] = ['pending', 'admitted', 'reserve'];
/** review: after the last talk, everyone can move their stamps before the verdict. */
export type Phase = 'waiting' | 'presenting' | 'questions' | 'voting' | 'review' | 'results';
/** How someone presents: Google Slides, paper/props/voice, or not at all. null = not decided yet. */
export type Mode = 'slides' | 'paper' | 'none';
export type Participant = {
  id: string;
  /** The name typed at booking, free form (two Giulia are fine). */
  name: string;
  /** The silly congress title, e.g. "Studioso dei finti uccelli". */
  role: string;
  title: string;
  deckUrl: string;
  mode: Mode | null;
  /** Kept in sync with mode === 'none' (older data and the vote rules use it). */
  spectator: boolean;
  /** Brings one collaborator (+1, never more). null = not said yet. */
  plusOne?: boolean | null;
  /** Who the +1 is: a witness who just comes, or a co-speaker who presents too. */
  partner?: Partner | null;
  partnerName?: string;
  /** Seats are limited: the GM decides. Missing = pending. */
  admission?: Admission;
  /** A fake tester in the test evening: votes when the GM says so. */
  bot?: boolean;
  /** Only in a guest's view of someone else: details hidden, just whether the dossier is complete. */
  masked?: boolean;
  ready?: boolean;
};
export type Round = { id: string; presenterId: string; closed: boolean; cancelled?: boolean };
/** The four stamps a voter can press on a talk (at most two per talk). */
export type StampKey = 'idea' | 'ricerca' | 'performance' | 'qa';
export type Ballot = Record<StampKey, boolean>;
export type Vote = Ballot & { roundId: string; voterId: string };
/** The GM may also have a participantId: then they present and vote like everyone else. */
export type Actor = { role: 'gm' | 'guest' | 'screen'; participantId?: string };
export type CategoryKey = StampKey;
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
  /** Voters who confirmed their stamps during the review. */
  reviewed?: string[];
};
export type Action =
  | { type: 'start'; participantId: string }
  | { type: 'phase'; phase: Phase; roundId: string }
  | { type: 'vote'; roundId: string; ballot: Ballot }
  | { type: 'cancel'; roundId: string }
  | { type: 'reveal' }
  /** GM: after the last talk, open the review (everyone can move their stamps). */
  | { type: 'review' }
  /** A voter confirms their stamps during the review (still editable until the GM closes it). */
  | { type: 'confirmReview' }
  /** GM: one step back (questions→presentation, voting→questions, reopen the last vote, leave the reveal). */
  | { type: 'back' }
  /** Test evening only: fake testers who vote on command. */
  | { type: 'addBots'; n: number }
  | { type: 'botVotes' }
  /** The presenter (or the GM) moves the slides; the helper on the projector Mac presses the arrow. */
  | { type: 'slide'; dir: 'next' | 'prev' }
  /** GM: start the evening over. everyone=false keeps the requests; true empties the register too. */
  | { type: 'reset'; everyone: boolean }
  | { type: 'nextAward' }
  /** GM: one reveal step back on the projector. */
  | { type: 'prevAward' }
  | { type: 'participant'; participant: Participant }
  | { type: 'register'; id: string; name: string }
  | { type: 'release'; participantId: string }
  /** GM only: delete a person with their turns and votes. */
  | { type: 'remove'; participantId: string }
  | { type: 'settings'; settings: Settings };
/**
 * The stamps: what you judge is plain on the ballot; the irony lives in the prize names and the reveal.
 * Ink colours differ (and the name is always written), so colour never carries the meaning alone.
 */
export const stamps = [
  {
    key: 'idea',
    title: 'COMPLOTTO D’AUTORE',
    line: 'L’idea: originale, assurda o geniale, comunque sia stata presentata.',
    joke: 'Netflix la sta già trasformando in docuserie.',
    prize: 'Il Sommelier del Complotto',
    reason: 'Per aver scelto la bottiglia giusta dalla cantina segreta dei poteri forti.',
    ink: '#c0392b',
  },
  {
    key: 'ricerca',
    title: 'INDAGINE SCHIACCIANTE',
    line: 'La preparazione: prove, fonti e struttura da vero ricercatore.',
    joke: 'A scuola si impegnava poco, ma stasera wow.',
    prize: 'Il Ragno della Bacheca',
    reason: 'Per aver tessuto i fili rossi in una ragnatela geometricamente perfetta.',
    ink: '#2c5f9e',
  },
  {
    key: 'performance',
    title: 'PERSUASORE OCCULTO',
    line: 'Il racconto: voce, ritmo e presenza, al di là del contenuto.',
    joke: 'Potrebbe vendere vaccini ai novax.',
    prize: 'Il Pifferaio Magico',
    reason: 'Per averci convinti a seguirlo fino ai confini della Terra piatta.',
    ink: '#2e7d4f',
  },
  {
    key: 'qa',
    title: 'DIFESA IMPENETRABILE',
    line: 'Le risposte alle domande: interrogatorio superato con stile.',
    joke: 'Arrampicatore di specchi professionista.',
    prize: 'L’Avvocato del Diavolo',
    reason: 'Per aver trasformato ogni obiezione del Congresso in una prova a favore.',
    ink: '#7b3fa0',
  },
] as const satisfies readonly {
  key: StampKey;
  title: string;
  line: string;
  joke: string;
  prize: string;
  reason: string;
  ink: string;
}[];
export const stampKeys: StampKey[] = stamps.map((c) => c.key);
export const stamp = (key: StampKey) => stamps.find((c) => c.key === key)!;
/** Kept for older code paths: the categories are the stamps. */
export const categories = stamps;
export const categoryKeys = stampKeys;
export const category = stamp;
export const emptyBallot = (): Ballot => ({ idea: false, ricerca: false, performance: false, qa: false });
export const stampCount = (b: Partial<Ballot>) => stampKeys.filter((k) => b[k] === true).length;
export const MAX_STAMPS = 2;
/** Reveal steps: 4 prizes × (open, 3rd, 2nd, 1st), an interlude, the Cappello × 4, the Registro. */
export const REVEAL_STEPS = 22;
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
  review: 'Revisione dei fascicoli',
  results: 'Il verdetto',
};
export const modes: { key: Mode; label: string; short: string; hint: string }[] = [
  {
    key: 'slides',
    label: 'Con tecnologia',
    short: 'Con tecnologia',
    hint: 'Slide proiettate. Rischio 5G.',
  },
  {
    key: 'paper',
    label: 'Senza tecnologia',
    short: 'Senza tecnologia',
    hint: 'Carta, oggetti, voce. Non tracciabile.',
  },
  {
    key: 'none',
    label: 'Solo pubblico',
    short: 'Pubblico',
    hint: 'Ascolti, fai domande, voti.',
  },
];
export const presents = (p: Participant) => p.mode === 'slides' || p.mode === 'paper';
export const slidesUrlPattern = /^https:\/\/docs\.google\.com\/presentation\//;
/** What is still missing before the evening, in plain words. Empty = dossier complete. */
export function dossierGaps(p: Participant): string[] {
  if (p.masked) return p.ready ? [] : ['dettagli'];
  const gaps: string[] = [];
  if (p.mode === 'none') return gaps;
  if (!p.role.trim()) gaps.push('titolo da congresso');
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
  return {
    ...p,
    role: p.role ?? '',
    title: p.title ?? '',
    deckUrl: p.deckUrl ?? '',
    mode,
    spectator: mode === 'none',
    plusOne: typeof p.plusOne === 'boolean' ? p.plusOne : null,
    partner: cleanPartner(p.partner) ?? (p.plusOne ? 'witness' : null),
    partnerName: p.partnerName ?? '',
    admission: admissions.includes(p.admission as Admission) ? p.admission : 'pending',
  };
}
/** How a person is shown everywhere. */
export const displayName = (p: Participant) =>
  p.partner === 'copresenter' && p.partnerName ? `${p.name} & ${p.partnerName}` : p.name;
/** Someone who started presenting (or everyone, once the reveal starts) has no more secrets. */
export const unmasked = (s: State, id: string) =>
  s.phase === 'results' || s.rounds.some((r) => r.presenterId === id && !r.cancelled);
function checkName(name: string) {
  if (name.length < 2 || name.length > 40) throw new Error('Scrivi il tuo nome (da 2 a 40 caratteri).');
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
/** Four yes/no stamps, at most two pressed. Zero is a valid ballot ("seen it, nothing to stamp"). */
export function validBallot(b: Ballot) {
  return (
    !!b && typeof b === 'object' && stampKeys.every((k) => typeof b[k] === 'boolean') && stampCount(b) <= MAX_STAMPS
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
/** Companions (a witness or a co-speaker) vote from their own phone: their voter id is the request id + "+". */
export const COMPANION = '+';
export const ownerOf = (voterId: string) => (voterId.endsWith(COMPANION) ? voterId.slice(0, -1) : voterId);
export type Voter = { id: string; name: string; owner: Participant; companion: boolean };
/** Everyone who can hold a ballot: each request, plus its named witness or co-speaker. */
export function voters(s: State): Voter[] {
  return s.participants.flatMap((p) => {
    const me: Voter = { id: p.id, name: p.name, owner: p, companion: false };
    return p.partner && (p.partnerName ?? '').trim()
      ? [me, { id: p.id + COMPANION, name: p.partnerName!, owner: p, companion: true }]
      : [me];
  });
}
export const voterOf = (s: State, id: string | undefined) => (id ? voters(s).find((v) => v.id === id) : undefined);
/** The round a ballot may be filed for right now: the open vote, or any finished talk during the review. */
export function ballotRound(s: State, roundId: string | null | undefined): Round | undefined {
  if (s.phase === 'voting') {
    const r = activeRound(s);
    return r && !r.closed && r.id === roundId ? r : undefined;
  }
  if (s.phase === 'review') return s.rounds.find((r) => r.id === roundId && r.closed && !r.cancelled);
  return undefined;
}
/** Why this voter cannot stamp this round (the current one by default), or null if they can. */
export function voteBlocker(s: State, voterId: string | undefined, roundId = s.activeRoundId): string | null {
  if (!voterOf(s, voterId)) return 'Scegli il tuo nome per votare.';
  const r = s.rounds.find((x) => x.id === roundId);
  if (r && ownerOf(voterId!) === r.presenterId) return 'Non puoi timbrare il tuo fascicolo.';
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
        title: '',
        deckUrl: '',
        mode: 'slides',
        spectator: false,
      },
      {
        id: 'giulia',
        name: 'Giulia',
        role: 'Cartografa delle verità scomode',
        title: '',
        deckUrl: '',
        mode: 'paper',
        spectator: false,
      },
      {
        id: 'marco',
        name: 'Marco',
        role: 'Esperto di segnali sospetti',
        title: '',
        deckUrl: '',
        mode: 'paper',
        spectator: false,
      },
      {
        id: 'sara',
        name: 'Sara',
        role: 'Archivista delle coincidenze',
        title: '',
        deckUrl: '',
        mode: 'paper',
        spectator: false,
      },
      {
        id: 'gianluca',
        name: 'Gianluca',
        role: 'Direttore del congresso',
        title: '',
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
    action.type === 'confirmReview' ||
    action.type === 'register' ||
    action.type === 'slide' ||
    (action.type === 'participant' && action.participant.id === actor.participantId);
  if (!guestAllowed && actor.role !== 'gm') throw new Error('Solo la regia può fare questa operazione.');
  if (action.type === 'start') {
    if (s.phase !== 'waiting') throw new Error('Concludi il turno prima di iniziarne un altro.');
    const p = s.participants.find((p) => p.id === action.participantId);
    if (!p || p.spectator || s.rounds.some((r) => r.presenterId === p.id && !r.cancelled))
      throw new Error('Questo ricercatore non è disponibile.');
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
    if (actor.role === 'screen' || !voterOf(s, actor.participantId)) throw new Error('Scegli il tuo nome per votare.');
    const round = ballotRound(s, action.roundId);
    if (!round) throw new Error('Questa votazione è chiusa.');
    const blocker = voteBlocker(s, actor.participantId, round.id);
    if (blocker) throw new Error(blocker);
    if (!validBallot(action.ballot)) throw new Error('Due timbri al massimo. Toglierne uno per cambiare idea.');
    const b = action.ballot;
    const vote: Vote = {
      idea: b.idea,
      ricerca: b.ricerca,
      performance: b.performance,
      qa: b.qa,
      roundId: round.id,
      voterId: actor.participantId!,
    };
    const i = s.votes.findIndex((v) => v.roundId === vote.roundId && v.voterId === vote.voterId);
    if (i >= 0) s.votes[i] = vote;
    else s.votes.push(vote);
  } else if (action.type === 'confirmReview') {
    if (s.phase !== 'review') throw new Error('La revisione è chiusa.');
    if (!voterOf(s, actor.participantId)) throw new Error('Scegli il tuo nome per votare.');
    s.reviewed = [...new Set([...(s.reviewed ?? []), actor.participantId!])];
  } else if (action.type === 'review') {
    if (s.phase !== 'waiting' || !s.rounds.some((r) => r.closed && !r.cancelled))
      throw new Error('Completa almeno un turno e chiudi il voto.');
    s.phase = 'review';
    s.reviewed = [];
  } else if (action.type === 'slide') {
    const round = activeRound(s);
    if (s.phase !== 'presenting' || !round) throw new Error('Le slide si cambiano solo durante la presentazione.');
    if (actor.role !== 'gm' && actor.participantId !== round.presenterId)
      throw new Error('Solo chi presenta può cambiare slide.');
    // In the browser demo there is no helper: nothing else to do.
  } else if (action.type === 'addBots') {
    const names = [
      'Rettiliano',
      'Terrapiattista',
      'Lunare',
      'Fluorato',
      'Illuminato',
      'Del 5G',
      'Scie chimiche',
      'Cugino NASA',
    ];
    const n = Math.min(Math.max(Math.round(action.n) || 4, 1), 8);
    for (let g = 1; g <= n; g++)
      s.participants.push({
        id: 'tester-' + Math.random().toString(36).slice(2, 10),
        name: names[(g + s.participants.length) % names.length] + ' (tester)',
        role: 'Tester certificato da nessuno',
        title: '',
        deckUrl: g % 2 === 0 ? '' : TEST_DECK,
        mode: g % 2 === 0 ? 'paper' : 'slides',
        spectator: false,
        plusOne: false,
        partner: null,
        partnerName: '',
        admission: 'admitted',
        bot: true,
      });
  } else if (action.type === 'botVotes') {
    // Fake testers press 0–2 random stamps: on the open vote, or on every talk during the review (and confirm).
    const open = activeRound(s);
    const rounds =
      s.phase === 'voting' && open
        ? [open]
        : s.phase === 'review'
          ? s.rounds.filter((r) => r.closed && !r.cancelled)
          : null;
    if (!rounds) throw new Error('Apri prima una votazione o la revisione.');
    const bots = voters(s).filter((v) => v.owner.bot && !v.companion);
    for (const r of rounds)
      for (const b of bots) {
        if (ownerOf(b.id) === r.presenterId) continue;
        const keys = [...stampKeys].sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3));
        const vote: Vote = { ...emptyBallot(), roundId: r.id, voterId: b.id };
        for (const k of keys) vote[k] = true;
        s.votes = s.votes.filter((v) => !(v.roundId === r.id && v.voterId === b.id)).concat(vote);
      }
    if (s.phase === 'review') s.reviewed = [...new Set([...(s.reviewed ?? []), ...bots.map((b) => b.id)])];
  } else if (action.type === 'reset') {
    s.rounds = [];
    s.votes = [];
    s.activeRoundId = null;
    s.phase = 'waiting';
    s.revealed = 0;
    s.reviewed = [];
    if (action.everyone) s.participants = [];
  } else if (action.type === 'back') {
    if (s.phase === 'questions') s.phase = 'presenting';
    else if (s.phase === 'voting') s.phase = 'questions';
    else if (s.phase === 'results') {
      // Leaving the reveal reopens the review: stamps can move again.
      s.phase = 'review';
      s.revealed = 0;
    } else if (s.phase === 'review') s.phase = 'waiting';
    else if (s.phase === 'waiting') {
      const last = [...s.rounds].reverse().find((x) => !x.cancelled);
      if (!last || !last.closed) throw new Error('Non c’è niente da riaprire.');
      last.closed = false;
      s.activeRoundId = last.id;
      s.phase = 'voting';
    } else throw new Error('Per tornare indietro dalla presentazione, annulla il turno.');
  } else if (action.type === 'reveal') {
    // From the review (closing it) or straight from the waiting room (review skipped).
    if ((s.phase !== 'waiting' && s.phase !== 'review') || !s.rounds.some((r) => r.closed && !r.cancelled))
      throw new Error('Completa almeno un turno e chiudi il voto.');
    s.phase = 'results';
    s.revealed = 1;
  } else if (action.type === 'nextAward') {
    if (s.phase !== 'results' || s.revealed >= REVEAL_STEPS) throw new Error('Non ci sono altre categorie da svelare.');
    s.revealed++;
  } else if (action.type === 'prevAward') {
    if (s.phase !== 'results' || s.revealed <= 1) throw new Error('Sei già all’inizio del reveal.');
    s.revealed--;
  } else if (action.type === 'release') {
    // Membership lives in Supabase; in the browser demo there is nothing to release.
    if (!s.participants.some((p) => p.id === action.participantId)) throw new Error('Nome non trovato.');
  } else if (action.type === 'remove') {
    if (actor.role !== 'gm') throw new Error('Solo la regia può fare questa operazione.');
    if (!s.participants.some((p) => p.id === action.participantId)) throw new Error('Nome non trovato.');
    const r = activeRound(s);
    if (r && !r.closed && r.presenterId === action.participantId)
      throw new Error('Sta presentando: chiudi o annulla il turno prima.');
    const gone = new Set(s.rounds.filter((x) => x.presenterId === action.participantId).map((x) => x.id));
    s.participants = s.participants.filter((p) => p.id !== action.participantId);
    s.rounds = s.rounds.filter((x) => !gone.has(x.id));
    s.votes = s.votes.filter((v) => ownerOf(v.voterId) !== action.participantId && !gone.has(v.roundId));
    if (s.phase === 'results' && !s.rounds.some((x) => x.closed && !x.cancelled)) {
      s.phase = 'waiting';
      s.revealed = 0;
    }
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
    checkName(name);
    if (s.phase === 'results') throw new Error('La serata è finita: il registro è chiuso.');
    if (s.participants.some((p) => p.id === action.id)) throw new Error('Riprova, il codice agente era già preso.');
    s.participants.push({
      id: action.id,
      name,
      role: '',
      title: '',
      deckUrl: '',
      mode: null,
      spectator: false,
      plusOne: null,
      partner: null,
      partnerName: '',
      admission: 'pending',
    });
  } else if (action.type === 'participant') {
    const p = normalizeParticipant({ ...action.participant, name: cleanName(action.participant.name) });
    const existing = s.participants.find((x) => x.id === p.id);
    if (!existing && actor.role !== 'gm') throw new Error('Questo fascicolo non è tuo.');
    checkName(p.name);
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
    const clean: Participant = {
      id: p.id,
      name: p.name,
      role: p.role.trim(),
      title: p.title.trim(),
      deckUrl: p.mode === 'slides' ? p.deckUrl.trim() : '',
      mode: p.mode,
      spectator: p.mode === 'none',
      plusOne: cleanPartner(p.partner) ? true : (p.plusOne ?? null),
      partner: cleanPartner(p.partner),
      partnerName: cleanPartner(p.partner) ? cleanName(p.partnerName ?? '').slice(0, 40) : '',
      bot: existing?.bot,
      // Only the GM decides who is in; guests keep whatever was decided.
      admission:
        actor.role === 'gm' && admissions.includes(p.admission as Admission)
          ? p.admission
          : (existing?.admission ?? 'pending'),
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
/** Guests see other people's name and whether their dossier is complete; titles stay secret until they present. */
function maskFor(s: State, actor: Actor, p: Participant): Participant {
  if (actor.role !== 'guest' || p.id === actor.participantId || unmasked(s, p.id)) return p;
  return {
    id: p.id,
    name: p.name,
    role: p.role ?? '',
    title: '',
    deckUrl: '',
    mode: p.mode,
    spectator: p.spectator,
    plusOne: p.plusOne ?? null,
    partner: p.partner ?? null,
    partnerName: p.partnerName ?? '',
    admission: p.admission ?? 'pending',
    masked: true,
    ready: dossierGaps(p).length === 0,
  };
}
export function snapshot(s: State, actor: Actor): State {
  const n = normalize(structuredClone(s));
  return {
    ...n,
    participants: n.participants.map((p) => maskFor(n, actor, p)),
    voteCount: countVotes(s),
    votes:
      s.phase === 'results'
        ? structuredClone(s.votes)
        : s.votes.filter((v) => actor.role !== 'screen' && !!actor.participantId && v.voterId === actor.participantId),
  };
}
