import { describe, expect, it } from 'vitest';
import { applyAction, emptyBallot, initialState, type Actor, type StampKey, type State } from '../src/domain';
import { certificate, registro, talks, verdict, type PrizeKey } from '../src/verdict';

const gm: Actor = { role: 'gm' };
const guest = (id: string): Actor => ({ role: 'guest', participantId: id });

/** Runs a full talk for `presenter`, each voter pressing the given stamps, and closes it. */
function talk(s: State, presenter: string, ballots: Record<string, StampKey[]>) {
  s = applyAction(s, gm, { type: 'start', participantId: presenter });
  const id = s.activeRoundId!;
  s = applyAction(s, gm, { type: 'phase', phase: 'questions', roundId: id });
  s = applyAction(s, gm, { type: 'phase', phase: 'voting', roundId: id });
  for (const [voter, keys] of Object.entries(ballots)) {
    const ballot = emptyBallot();
    for (const k of keys) ballot[k] = true;
    s = applyAction(s, guest(voter), { type: 'vote', roundId: id, ballot });
  }
  return applyAction(s, gm, { type: 'phase', phase: 'waiting', roundId: id });
}
const ids = (s: State, prize: PrizeKey, place: 1 | 2 | 3) => verdict(s)[prize].podium[place].map((t) => t.presenter.id);

describe('verdict with stamps', () => {
  /**
   * Sara: 3 ballots, all performance+qa → total 2 (Cappello).
   * Paolo: idea 3/3, ricerca 2/3. Giulia: ricerca 2/3, idea 1/3. Marco: performance 1/2.
   */
  function evening() {
    let s = initialState();
    s = talk(s, 'sara', { paolo: ['performance', 'qa'], giulia: ['performance', 'qa'], marco: ['performance', 'qa'] });
    s = talk(s, 'paolo', { giulia: ['idea', 'ricerca'], marco: ['idea', 'ricerca'], sara: ['idea'] });
    s = talk(s, 'giulia', { paolo: ['ricerca'], marco: ['ricerca', 'idea'], sara: [] });
    s = talk(s, 'marco', { paolo: ['performance'], giulia: [] });
    return s;
  }
  it('shares per talk divide by that talk’s ballots, empty ballots included', () => {
    const t = talks(evening());
    expect(t.find((x) => x.presenter.id === 'giulia')).toMatchObject({ ballots: 3, counts: { ricerca: 2, idea: 1 } });
    expect(t.find((x) => x.presenter.id === 'marco')!.share.performance).toBe(0.5);
  });
  it('gives the Cappello to the best total and takes its winner off every other podium', () => {
    const s = evening();
    expect(ids(s, 'cappello', 1)).toEqual(['sara']);
    expect(ids(s, 'cappello', 2)).toEqual(['paolo']);
    expect(ids(s, 'cappello', 3)).toEqual(['giulia']);
    for (const k of ['idea', 'ricerca', 'performance', 'qa'] as const)
      for (const place of [1, 2, 3] as const) expect(ids(s, k, place)).not.toContain('sara');
  });
  it('one prize each, best combination overall; a tie goes to whoever has no prize yet', () => {
    const s = evening();
    expect(ids(s, 'idea', 1)).toEqual(['paolo']);
    // Paolo and Giulia tie on ricerca (2/3): Paolo already has a prize, so Giulia wins it alone.
    expect(ids(s, 'ricerca', 1)).toEqual(['giulia']);
    expect(ids(s, 'ricerca', 2)).toEqual(['paolo']); // a mention, not a second prize
    expect(ids(s, 'performance', 1)).toEqual(['marco']);
  });
  it('leaves a prize unassigned when no candidate got that stamp', () => {
    const v = verdict(evening());
    expect(v.qa.podium[1]).toEqual([]); // only Sara had qa stamps, and she has the Cappello
  });
  it('shares the prize (pari merito) when the tied people have no prize', () => {
    let s = initialState();
    s = talk(s, 'paolo', { giulia: ['idea'], marco: [] });
    s = talk(s, 'giulia', { paolo: ['idea'], marco: [] });
    s = talk(s, 'marco', { paolo: ['performance', 'qa'], giulia: ['performance', 'qa'] });
    const v = verdict(s);
    expect(ids(s, 'cappello', 1)).toEqual(['marco']);
    expect(ids(s, 'idea', 1)).toEqual(['paolo', 'giulia']);
    expect(v.idea.shared).toBe(true);
  });
  it('ignores a talk with no ballots and keeps podiums incomplete when stamps are few', () => {
    let s = initialState();
    s = talk(s, 'paolo', {});
    s = talk(s, 'giulia', { paolo: ['idea'], marco: [] });
    expect(talks(s).find((t) => t.presenter.id === 'paolo')!.ballots).toBe(0);
    expect(ids(s, 'cappello', 1)).toEqual(['giulia']);
    expect(ids(s, 'cappello', 2)).toEqual([]);
  });
  it('the Registro lists stamps received (no counts); the certificate has counts and prizes', () => {
    const s = evening();
    expect(registro(s).find((r) => r.talk.presenter.id === 'giulia')!.stamps).toEqual(['idea', 'ricerca']);
    const c = certificate(s, 'paolo')!;
    expect(c.talk.counts.idea).toBe(3);
    expect(c.prizes).toEqual(['idea']);
    expect(c.mentions).toContainEqual({ prize: 'ricerca', place: 2 });
    expect(certificate(s, 'gianluca')).toBeNull(); // did not present
  });
});
