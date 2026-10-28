import { initialState, type Actor, type Participant, type State, type Vote } from './domain';

/** What the GM can type in the previews page. Only invented data: nothing here touches the database. */
export type Mock = {
  name: string;
  role: string;
  mode: 'slides' | 'paper';
  partnerName: string;
  viewer: string;
  /** Which award (1–4) the reveal previews show. */
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
  { id: 'p-voto', kind: 'projector', label: 'Votazione', note: 'Mentre la sala vota dal telefono.' },
  {
    id: 'p-pausa',
    kind: 'projector',
    label: 'Tra un turno e l’altro',
    note: 'Dopo il voto, prima del prossimo relatore.',
  },
  {
    id: 'p-annuncio',
    kind: 'projector',
    label: 'Verdetto: annuncio del premio',
    note: 'Prima busta sigillata, poi il vincitore.',
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
    id: 'p-riepilogo',
    kind: 'projector',
    label: 'Verdetto: riepilogo finale',
    note: 'Dopo il quarto premio. Chiude la serata.',
  },
  { id: 'g-ascolta', kind: 'phone', label: 'Ascolta', note: 'Telefono di chi è in sala mentre un altro presenta.' },
  { id: 'g-tocca', kind: 'phone', label: 'Tocca a te', note: 'Telefono di chi presenta: il telecomando.' },
  { id: 'g-domande', kind: 'phone', label: 'Question time', note: 'Telefono di chi è in sala.' },
  { id: 'g-voto', kind: 'phone', label: 'Scheda di voto', note: 'Si può cliccare: nessun voto viene inviato.' },
  { id: 'g-votato', kind: 'phone', label: 'Voto consegnato', note: 'La stessa scheda dopo aver votato.' },
  { id: 'g-proprio', kind: 'phone', label: 'Mentre votano te', note: 'Telefono di chi ha appena presentato.' },
  {
    id: 'g-pausa',
    kind: 'phone',
    label: 'Tra un turno e l’altro',
    note: 'Telefono di chi è in sala, dopo il primo turno.',
  },
  { id: 'g-verdetto', kind: 'phone', label: 'Il verdetto', note: 'Telefono di chi è in sala durante il reveal.' },
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
    if (id === 'g-votato')
      s.votes = [{ roundId: now.id, voterId: viewer.id, credibility: 7, delivery: 9, research: 4, supercazzola: true }];
  } else if (id === 'p-pausa' || id === 'g-pausa') {
    s.rounds = [earlier];
  } else if (['p-annuncio', 'p-terzo', 'p-secondo', 'p-premio', 'p-riepilogo', 'g-verdetto'].includes(id)) {
    // Everyone presented once, everyone else voted, with scores that give a varied podium.
    const speakers = [presenter, ...others];
    s.rounds = speakers.map((p, i) => ({ id: 'mock-r' + i, presenterId: p.id, closed: true }));
    s.votes = s.rounds.flatMap((r, i) =>
      [...speakers, viewer]
        .filter((v) => v.id !== r.presenterId)
        .map((v, j): Vote => ({
          roundId: r.id,
          voterId: v.id,
          credibility: (3 + i * 2 + j) % 11,
          delivery: (9 - i * 2 + j) % 11,
          research: (5 + i * 3 + j * 2) % 11,
          supercazzola: (i + j) % 3 !== 0,
        })),
    );
    s.phase = 'results';
    const n = Math.max(1, Math.min(4, m.award));
    s.revealed =
      id === 'p-riepilogo'
        ? 17
        : 4 * (n - 1) + (id === 'p-annuncio' ? 1 : id === 'p-terzo' ? 2 : id === 'p-secondo' ? 3 : 4);
  }
  const actor: Actor = id === 'g-tocca' || id === 'g-proprio' ? { role: 'guest', participantId: presenter.id } : guest;
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
