import { describe, expect, it } from 'vitest';
import { applyAction, initialState, rankings, snapshot, type State, type Actor, type Ballot } from '../src/domain';
const gm: Actor = { role: 'gm' },
  guest: Actor = { role: 'guest', participantId: 'giulia' };
const ballot: Ballot = { credibility: 8, delivery: 6, research: 10, supercazzola: true };
function voting() {
  let s = applyAction(initialState(), gm, { type: 'start', participantId: 'paolo' });
  const id = s.activeRoundId!;
  s = applyAction(s, gm, { type: 'phase', phase: 'questions', roundId: id });
  s = applyAction(s, gm, { type: 'phase', phase: 'voting', roundId: id });
  return s;
}
const vote = (s: State, b = ballot, a = guest) =>
  applyAction(s, a, { type: 'vote', roundId: s.activeRoundId!, ballot: b });
describe('rounds and ballots', () => {
  it('requires question time before voting and forbids overlapping rounds', () => {
    const s = applyAction(initialState(), gm, { type: 'start', participantId: 'paolo' });
    expect(() => applyAction(s, gm, { type: 'phase', phase: 'voting', roundId: s.activeRoundId! })).toThrow();
    expect(() => applyAction(s, gm, { type: 'start', participantId: 'marco' })).toThrow();
  });
  it('requires GM permissions even when calling the action directly', () => {
    expect(() => applyAction(initialState(), guest, { type: 'start', participantId: 'paolo' })).toThrow();
    expect(() => applyAction(voting(), guest, { type: 'reveal' })).toThrow();
  });
  it('upserts one ballot when a voter submits repeatedly', () => {
    let s = vote(voting());
    s = vote(s, { ...ballot, credibility: 9 });
    s = vote(s, { ...ballot, credibility: 9 });
    expect(s.votes).toHaveLength(1);
    expect(s.votes[0].credibility).toBe(9);
  });
  it('rejects self-votes and unrecognized voters', () => {
    const s = voting();
    expect(() => vote(s, ballot, { role: 'guest', participantId: 'paolo' })).toThrow();
    expect(() => vote(s, ballot, { role: 'guest', participantId: 'unknown' })).toThrow();
  });
  it.each([-1, 11, 3.5, NaN])('rejects invalid numeric score %s', (n) => {
    expect(() => vote(voting(), { ...ballot, credibility: n })).toThrow();
  });
  it('requires all three scores and an explicit yes/no', () => {
    expect(() => vote(voting(), { credibility: 0, delivery: 0, research: 0 } as Ballot)).toThrow();
    expect(vote(voting(), { credibility: 0, delivery: 0, research: 0, supercazzola: false }).votes).toHaveLength(1);
  });
  it('rejects a late ballot and leaves accepted votes unchanged', () => {
    let s = vote(voting());
    const id = s.activeRoundId!;
    s = applyAction(s, gm, { type: 'phase', phase: 'waiting', roundId: id });
    expect(() => applyAction(s, guest, { type: 'vote', roundId: id, ballot })).toThrow();
    expect(s.votes).toHaveLength(1);
  });
  it('rejects an old ballot after a new talk starts', () => {
    let s = voting();
    const id = s.activeRoundId!;
    s = applyAction(s, gm, { type: 'phase', phase: 'waiting', roundId: id });
    s = applyAction(s, gm, { type: 'start', participantId: 'marco' });
    s = applyAction(s, gm, { type: 'phase', phase: 'questions', roundId: s.activeRoundId! });
    s = applyAction(s, gm, { type: 'phase', phase: 'voting', roundId: s.activeRoundId! });
    expect(() => applyAction(s, guest, { type: 'vote', roundId: id, ballot })).toThrow();
  });
  it('cancels a mistaken round, excludes its votes and frees the presenter', () => {
    const s = vote(voting());
    const cancelled = applyAction(s, gm, { type: 'cancel', roundId: s.activeRoundId! });
    expect(cancelled.votes).toHaveLength(0);
    expect(cancelled.rounds[0].cancelled).toBe(true);
    expect(applyAction(cancelled, gm, { type: 'start', participantId: 'paolo' }).phase).toBe('presenting');
  });
  it('does not leak ballots or totals before reveal, including to GM', () => {
    const s = vote(voting());
    expect(snapshot(s, gm).votes).toEqual([]);
    expect(snapshot(s, { role: 'guest', participantId: 'marco' }).votes).toEqual([]);
    expect(snapshot(s, guest).votes).toHaveLength(1);
    expect(snapshot(s, gm).voteCount).toBe(1);
  });
  it('calculates separate means and yes counts with no overall total', () => {
    let s = vote(voting());
    s = vote(
      s,
      { credibility: 4, delivery: 10, research: 0, supercazzola: false },
      { role: 'guest', participantId: 'marco' },
    );
    s = applyAction(s, gm, { type: 'phase', phase: 'waiting', roundId: s.activeRoundId! });
    expect(rankings(s, 'credibility')[0].value).toBe(6);
    expect(rankings(s, 'delivery')[0].value).toBe(8);
    expect(rankings(s, 'research')[0].value).toBe(5);
    expect(rankings(s, 'supercazzola')[0].value).toBe(1);
  });
  it('shows no-data instead of inventing a zero-vote score', () => {
    const s = voting();
    const closed = applyAction(s, gm, { type: 'phase', phase: 'waiting', roundId: s.activeRoundId! });
    expect(rankings(closed, 'credibility')[0].value).toBeNull();
  });
  it('requires closing the round before reveal; reveals four categories progressively', () => {
    let s = vote(voting());
    expect(() => applyAction(s, gm, { type: 'reveal' })).toThrow();
    s = applyAction(s, gm, { type: 'phase', phase: 'waiting', roundId: s.activeRoundId! });
    s = applyAction(s, gm, { type: 'reveal' });
    expect(s.revealed).toBe(1);
    for (let i = 0; i < 3; i++) s = applyAction(s, gm, { type: 'nextAward' });
    expect(s.revealed).toBe(4);
    expect(() => applyAction(s, gm, { type: 'nextAward' })).toThrow();
    expect(snapshot(s, gm).votes).toHaveLength(1);
  });
});
