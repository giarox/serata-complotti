import { describe, expect, it } from 'vitest';
import {
  applyAction,
  dossierGaps,
  initialState,
  makeId,
  normalize,
  snapshot,
  type Actor,
  type Participant,
  type State,
} from '../src/domain';

const gm: Actor = { role: 'gm' };
const stranger: Actor = { role: 'guest' };
const register = (s: State, name: string, id = makeId(name)): State =>
  applyAction(s, stranger, { type: 'register', id, name });
const me = (s: State, id: string) => s.participants.find((p) => p.id === id)!;
const edit = (s: State, actor: Actor, p: Participant) => applyAction(s, actor, { type: 'participant', participant: p });

describe('self-registration from the invite', () => {
  it('needs only a name, and starts an empty dossier', () => {
    expect(() => register(initialState(), 'X')).toThrow('nome');
    expect(() => register(initialState(), '   ')).toThrow();
    const s = register(initialState(), '  Anna   Rossi ', 'anna-rossi-0001');
    expect(me(s, 'anna-rossi-0001')).toMatchObject({ name: 'Anna Rossi', role: '', mode: null, spectator: false });
    expect(dossierGaps(me(s, 'anna-rossi-0001'))).toEqual(['titolo da congresso', 'come presenti']);
  });

  it('allows two people with the same name', () => {
    const s = register(register(initialState(), 'Giulia', 'g1'), 'Giulia', 'g2');
    expect(s.participants.filter((p) => p.name === 'Giulia')).toHaveLength(3);
  });

  it('makes readable ids without accents', () => {
    expect(makeId('Niccolò D’Àvila', 'ab12')).toBe('niccolo-d-avila-ab12');
  });
});

describe('secret details', () => {
  it('shows other guests only the name and readiness, until they present', () => {
    let s = register(initialState(), 'Ugo', 'ugo');
    s = applyAction(
      s,
      { role: 'guest', participantId: 'ugo' },
      {
        type: 'participant',
        participant: { ...me(s, 'ugo'), role: 'Rettiliano onorario', title: 'SEGRETO', mode: 'paper' },
      },
    );
    const viewer: Actor = { role: 'guest', participantId: 'giulia' };
    const seen = snapshot(s, viewer).participants.find((p) => p.id === 'ugo')!;
    expect(seen).toMatchObject({
      name: 'Ugo',
      title: '',
      role: 'Rettiliano onorario',
      deckUrl: '',
      masked: true,
      ready: true,
    });
    expect(dossierGaps(seen)).toEqual([]);
    expect(snapshot(s, gm).participants.find((p) => p.id === 'ugo')).toMatchObject({ title: 'SEGRETO' });
    expect(snapshot(s, { role: 'guest', participantId: 'ugo' }).participants.find((p) => p.id === 'ugo')!.title).toBe(
      'SEGRETO',
    );
    const onStage = applyAction(s, gm, { type: 'start', participantId: 'ugo' });
    expect(snapshot(onStage, viewer).participants.find((p) => p.id === 'ugo')).toMatchObject({ title: 'SEGRETO' });
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
    expect(dossierGaps({ ...base, role: 'Esperta di scie', mode: 'paper' })).toEqual([]);
    expect(dossierGaps({ ...base, mode: 'paper' })).toEqual(['titolo da congresso']);
    expect(dossierGaps({ ...base, role: 'Esperta di scie', mode: 'slides' })).toEqual(['link delle slide']);
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

describe('removing people (GM)', () => {
  it('deletes a person with their turns and votes; guests cannot', () => {
    let s = register(register(initialState(), 'Ugo', 'ugo'), 'Bea', 'bea');
    s = applyAction(s, gm, { type: 'participant', participant: { ...me(s, 'ugo'), role: 'R', mode: 'paper' } });
    s = applyAction(s, gm, { type: 'start', participantId: 'ugo' });
    const rid = s.activeRoundId!;
    expect(() => applyAction(s, gm, { type: 'remove', participantId: 'ugo' })).toThrow('Sta presentando');
    s = applyAction(s, gm, { type: 'phase', phase: 'questions', roundId: rid });
    s = applyAction(s, gm, { type: 'phase', phase: 'voting', roundId: rid });
    s = applyAction(
      s,
      { role: 'guest', participantId: 'bea' },
      {
        type: 'vote',
        roundId: rid,
        ballot: { idea: true, ricerca: false, performance: false, qa: false },
      },
    );
    s = applyAction(s, gm, { type: 'phase', phase: 'waiting', roundId: rid });
    s = applyAction(s, gm, { type: 'reveal' });
    expect(() =>
      applyAction(s, { role: 'guest', participantId: 'bea' }, { type: 'remove', participantId: 'ugo' }),
    ).toThrow('regia');
    s = applyAction(s, gm, { type: 'remove', participantId: 'ugo' });
    expect(s.participants.some((p) => p.id === 'ugo')).toBe(false);
    expect(s.rounds).toEqual([]);
    expect(s.votes).toEqual([]);
    expect(s.phase).toBe('waiting');
  });
});

describe('admission (limited seats)', () => {
  it('starts pending; only the GM can admit or put in reserve', () => {
    let s = register(initialState(), 'Ugo', 'ugo');
    expect(me(s, 'ugo').admission).toBe('pending');
    const ugo: Actor = { role: 'guest', participantId: 'ugo' };
    s = applyAction(s, ugo, { type: 'participant', participant: { ...me(s, 'ugo'), admission: 'admitted' } });
    expect(me(s, 'ugo').admission).toBe('pending');
    s = applyAction(s, gm, { type: 'participant', participant: { ...me(s, 'ugo'), admission: 'admitted' } });
    expect(me(s, 'ugo').admission).toBe('admitted');
    s = applyAction(s, ugo, { type: 'participant', participant: { ...me(s, 'ugo'), role: 'Nuovo titolo' } });
    expect(me(s, 'ugo')).toMatchObject({ role: 'Nuovo titolo', admission: 'admitted' });
    expect(snapshot(s, { role: 'guest', participantId: 'x' }).participants.find((p) => p.id === 'ugo')!.admission).toBe(
      'admitted',
    );
  });
});

describe('going back (GM)', () => {
  it('steps back through the turn, reopens the last vote and leaves the reveal', () => {
    let s = register(initialState(), 'Ugo', 'ugo');
    s = applyAction(s, gm, { type: 'participant', participant: { ...me(s, 'ugo'), role: 'R', mode: 'paper' } });
    s = applyAction(s, gm, { type: 'start', participantId: 'ugo' });
    const rid = s.activeRoundId!;
    expect(() => applyAction(s, gm, { type: 'back' })).toThrow('annulla il turno');
    s = applyAction(s, gm, { type: 'phase', phase: 'questions', roundId: rid });
    expect(applyAction(s, gm, { type: 'back' }).phase).toBe('presenting');
    s = applyAction(s, gm, { type: 'phase', phase: 'voting', roundId: rid });
    expect(applyAction(s, gm, { type: 'back' }).phase).toBe('questions');
    s = applyAction(s, gm, { type: 'phase', phase: 'waiting', roundId: rid });
    const reopened = applyAction(s, gm, { type: 'back' });
    expect(reopened).toMatchObject({ phase: 'voting', activeRoundId: rid });
    expect(reopened.rounds[0].closed).toBe(false);
    s = applyAction(s, gm, { type: 'reveal' });
    expect(applyAction(s, gm, { type: 'back' })).toMatchObject({ phase: 'review', revealed: 0 }); // leaving the reveal reopens the review
    expect(() => applyAction(s, { role: 'guest', participantId: 'ugo' }, { type: 'back' })).toThrow('regia');
  });
});

describe('reset (GM)', () => {
  it('clears turns and votes, and optionally the register', () => {
    let s = register(initialState(), 'Ugo', 'ugo');
    s = applyAction(s, gm, { type: 'participant', participant: { ...me(s, 'ugo'), role: 'R', mode: 'paper' } });
    s = applyAction(s, gm, { type: 'start', participantId: 'ugo' });
    const soft = applyAction(s, gm, { type: 'reset', everyone: false });
    expect(soft).toMatchObject({ phase: 'waiting', rounds: [], votes: [], activeRoundId: null });
    expect(soft.participants.some((p) => p.id === 'ugo')).toBe(true);
    expect(applyAction(s, gm, { type: 'reset', everyone: true }).participants).toEqual([]);
    expect(() => applyAction(s, { role: 'guest', participantId: 'ugo' }, { type: 'reset', everyone: false })).toThrow(
      'regia',
    );
  });
});

describe('fake testers', () => {
  it('are admitted and vote on command', () => {
    let s = register(initialState(), 'Camilla', 'cami');
    s = applyAction(s, gm, { type: 'participant', participant: { ...me(s, 'cami'), role: 'R', mode: 'paper' } });
    s = applyAction(s, gm, { type: 'addBots', n: 3 });
    expect(s.participants.filter((p) => p.bot && p.admission === 'admitted')).toHaveLength(3);
    s = applyAction(s, gm, { type: 'start', participantId: 'cami' });
    const rid = s.activeRoundId!;
    expect(() => applyAction(s, gm, { type: 'botVotes' })).toThrow('votazione');
    s = applyAction(s, gm, { type: 'phase', phase: 'questions', roundId: rid });
    s = applyAction(s, gm, { type: 'phase', phase: 'voting', roundId: rid });
    s = applyAction(applyAction(s, gm, { type: 'botVotes' }), gm, { type: 'botVotes' });
    const ballots = s.votes.filter((v) => v.roundId === rid);
    expect(ballots).toHaveLength(3);
    for (const b of ballots)
      expect([b.idea, b.ricerca, b.performance, b.qa].filter(Boolean).length).toBeLessThanOrEqual(2);
    // In the review they also fill every talk and confirm.
    s = applyAction(s, gm, { type: 'phase', phase: 'waiting', roundId: rid });
    s = applyAction(applyAction(s, gm, { type: 'review' }), gm, { type: 'botVotes' });
    expect(s.reviewed).toHaveLength(3);
  });
});

describe('slide remote', () => {
  it('only the presenter or the GM, only while presenting', () => {
    let s = register(register(initialState(), 'Ugo', 'ugo'), 'Bea', 'bea');
    s = applyAction(s, gm, { type: 'participant', participant: { ...me(s, 'ugo'), role: 'R', mode: 'paper' } });
    const ugo: Actor = { role: 'guest', participantId: 'ugo' };
    expect(() => applyAction(s, ugo, { type: 'slide', dir: 'next' })).toThrow('presentazione');
    s = applyAction(s, gm, { type: 'start', participantId: 'ugo' });
    expect(() => applyAction(s, ugo, { type: 'slide', dir: 'next' })).not.toThrow();
    expect(() => applyAction(s, gm, { type: 'slide', dir: 'prev' })).not.toThrow();
    expect(() => applyAction(s, { role: 'guest', participantId: 'bea' }, { type: 'slide', dir: 'next' })).toThrow(
      'Solo chi presenta',
    );
  });
});
