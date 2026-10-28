import {
  initialState,
  REVEAL_STEPS,
  type Actor,
  type Participant,
  type StampKey,
  type State,
  type Vote,
} from './domain';

/** What the GM can type in the previews page. Only invented data: nothing here touches the database. */
export type Mock = {
  name: string;
  role: string;
  mode: 'slides' | 'paper';
  partnerName: string;
  viewer: string;
  /** Which prize the reveal previews show: 1–4 in reveal order, 5 = the Cappello. */
  award: number;
};
export const defaultMock: Mock = {
  name: 'Giovanni Moroni',
  role: 'Ricercatore di coincidenze presso il MIT (Osimo, Massachusetts)',
  mode: 'slides',
  partnerName: 'Camilla Morbidoni',
  viewer: 'Antonio',
  award: 1,
};

/** The worst we can expect: long names, a co-speaker with a double surname, a qualification that never ends. */
export const edgeMock: Partial<Mock> = {
  name: 'Maria Antonietta Bartolomeo-Scaramucci',
  partnerName: 'Pierfrancesco Della Rovere Montefeltro',
  role: 'Dottoressa honoris causa in Scienze Occulte Applicate presso l’Università Telematica del Sottoscala, già consulente non retribuita del Gruppo Bilderberg di Recanati',
};

export type PreviewKind = 'projector' | 'phone';
export type PreviewScreen = { id: string; kind: PreviewKind; label: string; note: string };
/** Every screen that only exists at precise moments of the evening. */
export const previewScreens: PreviewScreen[] = [
  { id: 'p-attesa', kind: 'projector', label: 'Prima di cominciare', note: 'Proiettore, nessun turno ancora.' },
  {
    id: 'p-slide',
    kind: 'projector',
    label: 'Presentazione con slide',
    note: 'Si vede un attimo, poi l’helper apre le slide sopra.',
  },
  {
    id: 'p-dalvivo',
    kind: 'projector',
    label: 'Presentazione dal vivo',
    note: 'Senza tecnologia: niente slide, resta a schermo per tutto il turno.',
  },
  { id: 'p-domande', kind: 'projector', label: 'Question time', note: 'Dopo la presentazione.' },
  { id: 'p-voto', kind: 'projector', label: 'Votazione a timbri', note: 'Mentre la sala timbra dal telefono.' },
  {
    id: 'p-pausa',
    kind: 'projector',
    label: 'Tra un turno e l’altro',
    note: 'Dopo il voto, prima del prossimo relatore.',
  },
  { id: 'p-revisione', kind: 'projector', label: 'Revisione', note: 'Dopo l’ultimo talk, prima del verdetto.' },
  {
    id: 'p-annuncio',
    kind: 'projector',
    label: 'Verdetto: apertura del premio',
    note: 'Nome del premio, il suo timbro, una frase.',
  },
  { id: 'p-terzo', kind: 'projector', label: 'Verdetto: 3° posto', note: 'Il podio si scopre dal fondo.' },
  { id: 'p-secondo', kind: 'projector', label: 'Verdetto: 2° posto', note: 'Il primo resta sigillato.' },
  {
    id: 'p-premio',
    kind: 'projector',
    label: 'Verdetto: 1° posto',
    note: 'Il vincitore, con l’esplosione di coriandoli.',
  },
  {
    id: 'p-cappello-apertura',
    kind: 'projector',
    label: 'Cappello: apertura',
    note: 'Il premio più ambito: busta sigillata.',
  },
  {
    id: 'p-cappello',
    kind: 'projector',
    label: 'Cappello: il Gran Maestro',
    note: 'Riflettore, raggi, doppia pioggia d’oro.',
  },
  {
    id: 'p-interludio',
    kind: 'projector',
    label: 'Verdetto: gran finale',
    note: 'Il passaggio prima del Cappello di Stagnola.',
  },
  { id: 'p-registro', kind: 'projector', label: 'Chiusura', note: 'Riepilogo dei premi, grazie e «Continua…?».' },
  { id: 'g-ascolta', kind: 'phone', label: 'Ascolta', note: 'Telefono di chi è in sala mentre un altro presenta.' },
  { id: 'g-tocca', kind: 'phone', label: 'Tocca a te', note: 'Telefono di chi presenta: il telecomando.' },
  { id: 'g-domande', kind: 'phone', label: 'Question time', note: 'Telefono di chi è in sala.' },
  { id: 'g-voto', kind: 'phone', label: 'Scheda a timbri', note: 'Si può cliccare: niente viene inviato.' },
  { id: 'g-votato', kind: 'phone', label: 'Fascicolo consegnato', note: 'La stessa scheda dopo aver timbrato.' },
  { id: 'g-proprio', kind: 'phone', label: 'Mentre votano te', note: 'Telefono di chi ha appena presentato.' },
  {
    id: 'g-pausa',
    kind: 'phone',
    label: 'Tra un turno e l’altro',
    note: 'Telefono di chi è in sala, dopo il primo turno.',
  },
  { id: 'g-revisione', kind: 'phone', label: 'Revisione', note: 'Si può cliccare: niente viene inviato.' },
  {
    id: 'g-verdetto',
    kind: 'phone',
    label: 'Durante il verdetto',
    note: 'Telefono di chi è in sala durante il reveal.',
  },
  { id: 'g-attestato', kind: 'phone', label: 'Attestato', note: 'Alla fine, sul telefono del relatore. Privato.' },
];

const person = (id: string, name: string, role: string, mode: Participant['mode'] = 'paper'): Participant => ({
  id,
  name,
  role,
  title: '',
  deckUrl: '',
  mode,
  spectator: false,
  partner: null,
  partnerName: '',
  admission: 'admitted',
});

/** A believable evening around the mocked presenter, for the given screen. */
export function mockState(id: string, m: Mock): { s: State; actor: Actor } {
  const mode = id === 'p-slide' ? 'slides' : id === 'p-dalvivo' ? 'paper' : m.mode;
  const presenter: Participant = {
    ...person('mock-p', m.name || 'Relatore', m.role, mode),
    deckUrl: mode === 'slides' ? 'https://docs.google.com/presentation/d/anteprima/edit' : '',
    partner: m.partnerName.trim() ? 'copresenter' : null,
    partnerName: m.partnerName.trim(),
  };
  const viewer = person('mock-v', m.viewer || 'Ospite', 'Osservatore indipendente');
  const others = [
    person('mock-1', 'Giulia', 'Cartografa delle verità scomode'),
    person('mock-2', 'Marco', 'Esperto di segnali sospetti', 'slides'),
    person('mock-3', 'Sara', 'Archivista delle coincidenze'),
    person('mock-4', 'Luca', 'Perito di scie sospette'),
  ];
  const s: State = { ...initialState(), participants: [presenter, ...others, viewer] };
  const guest: Actor = { role: 'guest', participantId: viewer.id };
  const earlier = { id: 'mock-r1', presenterId: 'mock-1', closed: true };
  const now = { id: 'mock-r2', presenterId: presenter.id, closed: false };
  const phaseOf: Record<string, State['phase']> = {
    'p-slide': 'presenting',
    'p-dalvivo': 'presenting',
    'g-ascolta': 'presenting',
    'g-tocca': 'presenting',
    'p-domande': 'questions',
    'g-domande': 'questions',
    'p-voto': 'voting',
    'g-voto': 'voting',
    'g-votato': 'voting',
    'g-proprio': 'voting',
  };
  if (phaseOf[id]) {
    s.phase = phaseOf[id];
    s.rounds = [earlier, now];
    s.activeRoundId = now.id;
    if (id === 'p-voto')
      s.votes = ['mock-1', 'mock-2', 'mock-3'].map((v) => ({
        roundId: now.id,
        voterId: v,
        idea: true,
        ricerca: false,
        performance: false,
        qa: false,
      }));
    if (id === 'g-votato')
      s.votes = [{ roundId: now.id, voterId: viewer.id, idea: true, ricerca: false, performance: true, qa: false }];
  } else if (id === 'p-pausa' || id === 'g-pausa') {
    s.rounds = [earlier];
  } else if (
    id.startsWith('p-')
      ? !['p-attesa', 'p-pausa'].includes(id)
      : ['g-revisione', 'g-verdetto', 'g-attestato'].includes(id)
  ) {
    // Everyone presented once and everyone else stamped, with a pattern that gives varied podiums.
    const speakers = [presenter, ...others];
    s.rounds = speakers.map((p, i) => ({ id: 'mock-r' + i, presenterId: p.id, closed: true }));
    // Each speaker shines at something different (hand-made, so every podium fills up and some ties show).
    const table: StampKey[][][] = [
      [
        ['idea', 'ricerca'],
        ['idea', 'performance'],
        ['ricerca', 'qa'],
        ['idea', 'qa'],
        ['performance', 'ricerca'],
      ],
      [['idea'], ['idea', 'ricerca'], ['idea'], ['qa'], ['idea']],
      [['ricerca'], ['ricerca'], ['ricerca', 'idea'], [], ['ricerca']],
      [['performance'], ['performance', 'idea'], ['performance'], [], ['performance', 'ricerca']],
      [['qa'], ['qa', 'performance'], ['qa'], ['qa'], []],
    ];
    const voterList = [...speakers, viewer];
    s.votes = s.rounds.flatMap((r, i) =>
      voterList
        .filter((v) => v.id !== r.presenterId)
        .map((v, j): Vote => {
          const b: Vote = { roundId: r.id, voterId: v.id, idea: false, ricerca: false, performance: false, qa: false };
          for (const k of table[i][j] ?? []) b[k] = true;
          return b;
        }),
    );
    if (id === 'p-revisione' || id === 'g-revisione') {
      s.phase = 'review';
      s.reviewed = ['mock-1', 'mock-2'];
    } else {
      s.phase = 'results';
      const n = Math.max(1, Math.min(5, m.award)),
        sub = id === 'p-annuncio' ? 0 : id === 'p-terzo' ? 1 : id === 'p-secondo' ? 2 : 3;
      s.revealed =
        id === 'p-registro' || id === 'g-attestato'
          ? REVEAL_STEPS
          : id === 'p-interludio'
            ? 17
            : id === 'p-cappello-apertura'
              ? 18
              : id === 'p-cappello'
                ? 19
                : id === 'g-verdetto'
                  ? 6
                  : n === 5
                    ? sub === 0
                      ? 18
                      : 19
                    : 4 * (n - 1) + 1 + sub;
    }
  }
  const actor: Actor =
    id === 'g-tocca' || id === 'g-proprio' || id === 'g-attestato'
      ? { role: 'guest', participantId: presenter.id }
      : guest;
  return { s, actor };
}

export const readMock = (hash: string): Mock => {
  try {
    return { ...defaultMock, ...JSON.parse(decodeURIComponent(hash.replace(/^#/, ''))) };
  } catch {
    return defaultMock;
  }
};
export const mockHash = (m: Mock) => '#' + encodeURIComponent(JSON.stringify(m));
