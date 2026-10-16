import { describe, expect, it } from 'vitest';
import {
  applyAction,
  dossierGaps,
  initialState,
  makeId,
  normalize,
  displayName,
  snapshot,
  stageName,
  type Actor,
  type Participant,
  type State,
} from '../src/domain';

const gm: Actor = { role: 'gm' };
const stranger: Actor = { role: 'guest' };
const register = (s: State, name: string, id = makeId(name)) =>
  applyAction(s, stranger, { type: 'register', id, name });
const me = (s: State, id: string) => s.participants.find((p) => p.id === id)!;
const edit = (s: State, actor: Actor, p: Participant) => applyAction(s, actor, { type: 'participant', participant: p });

describe('self-registration from the invite', () => {
  it('needs a real first and last name; the alias is optional', () => {
    expect(() => register(initialState(), 'Paolo')).toThrow('nome e cognome');
    expect(() => register(initialState(), '   ')).toThrow();
    const s = register(initialState(), '  Anna   Rossi ', 'anna-rossi-0001');
    expect(me(s, 'anna-rossi-0001')).toMatchObject({
      name: 'Anna Rossi',
      alias: '',
      role: '',
      mode: null,
      spectator: false,
    });
    expect(dossierGaps(me(s, 'anna-rossi-0001'))).toEqual([
      'titolo da congresso',
      'titolo della rivelazione',
      'come presenti',
    ]);
    const withAlias = applyAction(initialState(), stranger, {
      type: 'register',
      id: 'x',
      name: 'Ugo Neri',
      alias: ' Gola  Profonda ',
    });
    expect(me(withAlias, 'x')).toMatchObject({ name: 'Ugo Neri', alias: 'Gola Profonda' });
    expect(() =>
      applyAction(initialState(), stranger, { type: 'register', id: 'y', name: 'Ugo Neri', alias: 'x'.repeat(41) }),
    ).toThrow('Alias');
  });

  it('refuses a duplicate real name (pointing to “Ho già prenotato”) and a taken alias', () => {
    const s = register(initialState(), 'Anna Rossi');
    expect(() => register(s, 'anna rossi')).toThrow('Ho già prenotato');
    expect(() => applyAction(s, stranger, { type: 'register', id: 'z', name: 'Ada Lovi', alias: 'la talpa' })).toThrow(
      'già preso',
    );
    expect(() =>
      applyAction(s, stranger, { type: 'register', id: 'z', name: 'Ada Lovi', alias: 'Anna Rossi' }),
    ).toThrow('già preso');
  });

  it('makes readable ids without accents', () => {
    expect(makeId('Niccolò D’Àvila', 'ab12')).toBe('niccolo-d-avila-ab12');
  });
});

describe('alias masking', () => {
  it('shows other guests only alias (or name) and readiness, until they present', () => {
    let s = applyAction(initialState(), stranger, {
      type: 'register',
      id: 'ugo',
      name: 'Ugo Neri',
      alias: 'Gola Profonda',
    });
    s = applyAction(
      s,
      { role: 'guest', participantId: 'ugo' },
      {
        type: 'participant',
        participant: { ...me(s, 'ugo'), role: 'R', title: 'SEGRETO', mode: 'paper' },
      },
    );
    const viewer: Actor = { role: 'guest', participantId: 'giulia' };
    const seen = snapshot(s, viewer).participants.find((p) => p.id === 'ugo')!;
    expect(seen).toMatchObject({ name: 'Gola Profonda', alias: '', title: '', role: '', masked: true, ready: true });
    const noAlias = snapshot(s, viewer).participants.find((p) => p.id === 'marco')!;
    expect(noAlias.name).toBe('Marco Verdi');
    // The GM and the person themselves see everything.
    expect(snapshot(s, gm).participants.find((p) => p.id === 'ugo')).toMatchObject({
      name: 'Ugo Neri',
      title: 'SEGRETO',
    });
    expect(snapshot(s, { role: 'guest', participantId: 'ugo' }).participants.find((p) => p.id === 'ugo')!.name).toBe(
      'Ugo Neri',
    );
    // On stage the identity is revealed.
    const onStage = applyAction(s, gm, { type: 'start', participantId: 'ugo' });
    const revealed = snapshot(onStage, viewer).participants.find((p) => p.id === 'ugo')!;
    expect(revealed).toMatchObject({ name: 'Ugo Neri', alias: 'Gola Profonda', title: 'SEGRETO' });
    expect(stageName(revealed)).toBe('Gola Profonda, al secolo Ugo Neri');
    expect(displayName(revealed)).toBe('Gola Profonda');
  });
});

describe('the dossier', () => {
  const setup = () => {
    const s = register(initialState(), 'Anna Rossi', 'anna');
    return { s, anna: { role: 'guest', participantId: 'anna' } as Actor };
  };

  it('lists exactly what is missing for each way of presenting', () => {
    const { s } = setup();
    const base = me(s, 'anna');
    expect(dossierGaps({ ...base, role: 'Esperta di scie', mode: 'none' })).toEqual([]);
    expect(dossierGaps({ ...base, role: 'Esperta di scie', mode: 'paper' })).toEqual(['titolo della rivelazione']);
    expect(dossierGaps({ ...base, role: 'Esperta di scie', mode: 'slides', title: 'LE SCIE' })).toEqual([
      'link delle slide',
    ]);
  });

  it('lets a guest fill their own dossier, but not someone else’s', () => {
    const { s, anna } = setup();
    const done = edit(s, anna, {
      ...me(s, 'anna'),
      role: 'Esperta di scie',
      mode: 'slides',
      title: 'LE SCIE',
      deckUrl: 'https://docs.google.com/presentation/d/abc/edit',
    });
    expect(dossierGaps(me(done, 'anna'))).toEqual([]);
    expect(() => edit(done, anna, { ...me(done, 'paolo'), role: 'Hackerato' })).toThrow();
    expect(() => edit(done, stranger, { ...me(done, 'anna'), role: 'x' })).toThrow();
  });

  it('accepts only Google Slides links, and drops the link for paper talks', () => {
    const { s, anna } = setup();
    const base = { ...me(s, 'anna'), role: 'R', title: 'T' };
    expect(() => edit(s, anna, { ...base, mode: 'slides', deckUrl: 'https://example.com/x' })).toThrow('Google Slides');
    const paper = edit(s, anna, { ...base, mode: 'paper', deckUrl: 'https://docs.google.com/presentation/d/abc' });
    expect(me(paper, 'anna').deckUrl).toBe('');
    expect(me(paper, 'anna').spectator).toBe(false);
    const spectator = edit(s, anna, { ...base, mode: 'none' });
    expect(me(spectator, 'anna').spectator).toBe(true);
  });

  it('freezes the dossier while presenting and after, and lets the GM still correct it', () => {
    const { s, anna } = setup();
    let st = edit(s, anna, { ...me(s, 'anna'), role: 'R', mode: 'paper', title: 'T' });
    st = applyAction(st, gm, { type: 'start', participantId: 'anna' });
    expect(() => edit(st, anna, { ...me(st, 'anna'), title: 'Nuovo' })).toThrow('Stai presentando');
    expect(() => edit(st, gm, { ...me(st, 'anna'), title: 'Nuovo' })).toThrow('Stai presentando');
    const id = st.activeRoundId!;
    st = applyAction(st, gm, { type: 'phase', phase: 'questions', roundId: id });
    st = applyAction(st, gm, { type: 'phase', phase: 'voting', roundId: id });
    st = applyAction(st, gm, { type: 'phase', phase: 'waiting', roundId: id });
    expect(() => edit(st, anna, { ...me(st, 'anna'), title: 'Nuovo' })).toThrow('già presentato');
    expect(me(edit(st, gm, { ...me(st, 'anna'), title: 'Corretto' }), 'anna').title).toBe('Corretto');
    expect(() => edit(st, gm, { ...me(st, 'anna'), mode: 'none' })).toThrow('solo pubblico');
  });

  it('lets other people keep editing while someone else presents', () => {
    const { s, anna } = setup();
    const st = applyAction(s, gm, { type: 'start', participantId: 'paolo' });
    expect(me(edit(st, anna, { ...me(st, 'anna'), role: 'Ritardataria' }), 'anna').role).toBe('Ritardataria');
  });

  it('upgrades older saved people to a presentation mode', () => {
    const old = { ...initialState() };
    old.participants = [
      {
        id: 'a',
        name: 'A',
        role: 'r',
        title: 'T',
        deckUrl: 'https://docs.google.com/presentation/d/x',
        spectator: false,
      },
      { id: 'b', name: 'B', role: 'r', title: '', deckUrl: '', spectator: true },
    ] as Participant[];
    expect(normalize(old).participants.map((p) => p.mode)).toEqual(['slides', 'none']);
  });
});
