import { describe, expect, it } from 'vitest';
import {
  applyAction,
  emptyBallot,
  initialState,
  REVEAL_STEPS,
  snapshot,
  type State,
  type Actor,
  type Ballot,
  type Participant,
} from '../src/domain';
import { revealMoment, revealedPrizes, revealOver } from '../src/verdict';
const gm: Actor = { role: 'gm' },
  guest: Actor = { role: 'guest', participantId: 'giulia' };
const ballot: Ballot = { ...emptyBallot(), idea: true, ricerca: true };
function voting(s = initialState(), who = 'paolo') {
  s = applyAction(s, gm, { type: 'start', participantId: who });
  const id = s.activeRoundId!;
  s = applyAction(s, gm, { type: 'phase', phase: 'questions', roundId: id });
  s = applyAction(s, gm, { type: 'phase', phase: 'voting', roundId: id });
  return s;
}
const close = (s: State) => applyAction(s, gm, { type: 'phase', phase: 'waiting', roundId: s.activeRoundId! });
const vote = (s: State, b = ballot, a = guest, roundId = s.activeRoundId!) =>
  applyAction(s, a, { type: 'vote', roundId, ballot: b });
/** Paolo presents with a co-speaker (Camilla); Giulia brings a witness (Ugo). */
function withCompanions() {
  const s = initialState();
  const edit = (id: string, patch: Partial<Participant>) => {
    const p = s.participants.find((x) => x.id === id)!;
    Object.assign(p, patch);
  };
  edit('paolo', { partner: 'copresenter', partnerName: 'Camilla', plusOne: true });
  edit('giulia', { partner: 'witness', partnerName: 'Ugo', plusOne: true });
  return s;
}
describe('rounds and stamps', () => {
  it('requires question time before voting and forbids overlapping rounds', () => {
    const s = applyAction(initialState(), gm, { type: 'start', participantId: 'paolo' });
    expect(() => applyAction(s, gm, { type: 'phase', phase: 'voting', roundId: s.activeRoundId! })).toThrow();
    expect(() => applyAction(s, gm, { type: 'start', participantId: 'marco' })).toThrow();
  });
  it('requires GM permissions even when calling the action directly', () => {
    expect(() => applyAction(initialState(), guest, { type: 'start', participantId: 'paolo' })).toThrow();
    expect(() => applyAction(voting(), guest, { type: 'reveal' })).toThrow();
    expect(() => applyAction(close(voting()), guest, { type: 'review' })).toThrow();
  });
  it('upserts one ballot when a voter submits repeatedly', () => {
    let s = vote(voting());
    s = vote(s, { ...emptyBallot(), qa: true });
    expect(s.votes).toHaveLength(1);
    expect(s.votes[0]).toMatchObject({ qa: true, idea: false, ricerca: false });
  });
  it('accepts zero, one or two stamps and refuses a third', () => {
    expect(vote(voting(), emptyBallot()).votes).toHaveLength(1);
    expect(() => vote(voting(), { ...ballot, qa: true })).toThrow(/Due timbri/);
    expect(() => vote(voting(), { idea: true } as Ballot)).toThrow();
  });
  it('rejects self-stamps, also from the co-speaker, and unknown voters', () => {
    const s = voting(withCompanions());
    expect(() => vote(s, ballot, { role: 'guest', participantId: 'paolo' })).toThrow();
    expect(() => vote(s, ballot, { role: 'guest', participantId: 'paolo+' })).toThrow();
    expect(() => vote(s, ballot, { role: 'guest', participantId: 'unknown' })).toThrow();
    expect(() => vote(s, ballot, { role: 'guest', participantId: 'marco+' })).toThrow(); // Marco brings nobody
  });
  it('lets witnesses and co-speakers vote from their own phone', () => {
    let s = voting(withCompanions(), 'marco');
    s = vote(s, ballot, { role: 'guest', participantId: 'giulia+' });
    s = vote(s, ballot, { role: 'guest', participantId: 'paolo+' });
    expect(s.votes.map((v) => v.voterId).sort()).toEqual(['giulia+', 'paolo+']);
  });
  it('rejects a late ballot and an old ballot after a new talk starts', () => {
    let s = vote(voting());
    const id = s.activeRoundId!;
    s = close(s);
    expect(() => applyAction(s, guest, { type: 'vote', roundId: id, ballot })).toThrow();
    s = voting(s, 'marco');
    expect(() => applyAction(s, guest, { type: 'vote', roundId: id, ballot })).toThrow();
    expect(s.votes).toHaveLength(1);
  });
  it('cancels a mistaken round, excludes its votes and frees the presenter', () => {
    const s = vote(voting());
    const cancelled = applyAction(s, gm, { type: 'cancel', roundId: s.activeRoundId! });
    expect(cancelled.votes).toHaveLength(0);
    expect(applyAction(cancelled, gm, { type: 'start', participantId: 'paolo' }).phase).toBe('presenting');
  });
  it('does not leak ballots before the reveal, including to the GM', () => {
    const s = vote(voting());
    expect(snapshot(s, gm).votes).toEqual([]);
    expect(snapshot(s, { role: 'guest', participantId: 'marco' }).votes).toEqual([]);
    expect(snapshot(s, guest).votes).toHaveLength(1);
    expect(snapshot(s, gm).voteCount).toBe(1);
  });
});
describe('review', () => {
  function twoTalks() {
    let s = close(vote(voting()));
    s = close(voting(s, 'marco'));
    return s;
  }
  it('opens after the talks; stamps move on any finished talk, never on your own', () => {
    let s = applyAction(twoTalks(), gm, { type: 'review' });
    expect(s.phase).toBe('review');
    const [paolo, marco] = s.rounds;
    s = vote(s, { ...emptyBallot(), performance: true }, guest, paolo.id); // changes the earlier ballot
    s = vote(s, emptyBallot(), guest, marco.id); // fills a ballot missed during the evening
    expect(s.votes).toHaveLength(2);
    expect(s.votes.find((v) => v.roundId === paolo.id)).toMatchObject({ performance: true, idea: false });
    expect(() => vote(s, ballot, { role: 'guest', participantId: 'marco' }, marco.id)).toThrow();
  });
  it('records confirmations, and closes for good when the verdict starts', () => {
    let s = applyAction(twoTalks(), gm, { type: 'review' });
    s = applyAction(s, guest, { type: 'confirmReview' });
    s = applyAction(s, guest, { type: 'confirmReview' });
    expect(s.reviewed).toEqual(['giulia']);
    s = applyAction(s, gm, { type: 'reveal' });
    expect(() => vote(s, ballot, guest, s.rounds[0].id)).toThrow();
    expect(() => applyAction(s, guest, { type: 'confirmReview' })).toThrow();
  });
  it('steps back: verdict → review → waiting; the review can also be skipped', () => {
    let s = applyAction(twoTalks(), gm, { type: 'review' });
    s = applyAction(s, gm, { type: 'reveal' });
    expect(applyAction(s, gm, { type: 'back' }).phase).toBe('review');
    expect(applyAction(applyAction(s, gm, { type: 'back' }), gm, { type: 'back' }).phase).toBe('waiting');
    expect(applyAction(twoTalks(), gm, { type: 'reveal' }).phase).toBe('results');
  });
});
describe('reveal steps', () => {
  it('goes prize by prize (open, 3rd, 2nd, 1st), interlude, Cappello, then the Registro', () => {
    let s = applyAction(close(vote(voting())), gm, { type: 'reveal' });
    expect(revealMoment(s)).toEqual({ kind: 'open', prize: 'qa' });
    const next = () => (s = applyAction(s, gm, { type: 'nextAward' }));
    next();
    expect(revealMoment(s)).toEqual({ kind: 'place', prize: 'qa', place: 3 });
    next();
    next();
    expect(revealMoment(s)).toEqual({ kind: 'place', prize: 'qa', place: 1 });
    expect(revealedPrizes(s)).toEqual(['qa']);
    while (s.revealed < 17) next();
    expect(revealMoment(s)).toEqual({ kind: 'interlude' });
    next();
    expect(revealMoment(s)).toEqual({ kind: 'open', prize: 'cappello' });
    next(); // the Cappello has no podium: straight to its winner
    expect(revealMoment(s)).toEqual({ kind: 'place', prize: 'cappello', place: 1 });
    while (s.revealed < REVEAL_STEPS) next();
    expect(revealMoment(s)).toEqual({ kind: 'registro' });
    expect(revealOver(s)).toBe(true);
    expect(revealedPrizes(s)).toHaveLength(5);
    expect(() => next()).toThrow();
    expect(snapshot(s, guest).votes).toHaveLength(1);
  });
});
