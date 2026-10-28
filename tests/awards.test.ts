import { describe, expect, it } from 'vitest';
import { initialState, type Participant, type StampKey, type State, type Vote } from '../src/domain';
import { certificate, medalPoints, registro, talks, verdict, type PrizeKey } from '../src/verdict';

/**
 * Builds a finished evening from stamp counts: each talk gets `voters` ballots (10 by default),
 * and each stamp is spread over the ballots with the fewest stamps so far.
 */
function evening(counts: Record<string, Partial<Record<StampKey, number>>>, voters = 10): State {
  const s = initialState();
  const names = Object.keys(counts);
  s.participants = names.map((n): Participant => ({
    id: n.toLowerCase(),
    name: n,
    role: '',
    title: '',
    deckUrl: '',
    mode: 'paper',
    spectator: false,
  }));
  s.rounds = names.map((n, i) => ({ id: 'r' + i, presenterId: n.toLowerCase(), closed: true }));
  s.votes = names.flatMap((n, i) => {
    const ballots: Vote[] = Array.from({ length: voters }, (_, j) => ({
      roundId: 'r' + i,
      voterId: 'v' + j,
      idea: false,
      ricerca: false,
      performance: false,
      qa: false,
    }));
    for (const [k, c] of Object.entries(counts[n]) as [StampKey, number][])
      for (let x = 0; x < c; x++) {
        const b = ballots
          .filter((v) => !v[k])
          .sort(
            (a, b2) =>
              Number(a.idea) +
              Number(a.ricerca) +
              Number(a.performance) +
              Number(a.qa) -
              (Number(b2.idea) + Number(b2.ricerca) + Number(b2.performance) + Number(b2.qa)),
          )[0];
        b[k] = true;
      }
    return ballots;
  });
  return s;
}
const ids = (s: State, prize: PrizeKey, place: 1 | 2 | 3) =>
  verdict(s)[prize].podium[place].map((t) => t.presenter.name);

describe('stamp prizes: the ladder', () => {
  // The example from the handoff (10 voters per talk).
  const example = () =>
    evening({
      Giovanni: { idea: 5, ricerca: 6, performance: 5 },
      Antonio: { idea: 5, performance: 5 },
      Marta: { idea: 5, qa: 4 },
      Paolo: { idea: 3, ricerca: 4 },
      Sara: { performance: 3, qa: 4 },
      Luca: { qa: 2 },
    });
  it('assigns the four prizes as in the handoff example', () => {
    const s = example();
    expect(ids(s, 'ricerca', 1)).toEqual(['Giovanni']); // clear win
    expect(ids(s, 'performance', 1)).toEqual(['Antonio']); // Giovanni steps aside
    expect(ids(s, 'idea', 1)).toEqual(['Marta']); // Giovanni and Antonio already won
    expect(ids(s, 'qa', 1)).toEqual(['Sara']); // Marta already won
  });
  it('builds the podiums with the people who stepped aside', () => {
    const s = example();
    expect(ids(s, 'idea', 2)).toEqual(['Giovanni', 'Antonio']);
    expect(ids(s, 'idea', 3)).toEqual(['Paolo']);
    expect(ids(s, 'ricerca', 2)).toEqual(['Paolo']);
    expect(ids(s, 'ricerca', 3)).toEqual([]);
    expect(ids(s, 'performance', 2)).toEqual(['Giovanni']);
    expect(ids(s, 'performance', 3)).toEqual(['Sara']);
    expect(ids(s, 'qa', 2)).toEqual(['Marta']);
    expect(ids(s, 'qa', 3)).toEqual(['Luca']);
  });
  it('computes the medal table and gives the Cappello to Giovanni, on top of his prize', () => {
    const s = example();
    expect(medalPoints(s)).toEqual({ giovanni: 7, marta: 5, antonio: 5, sara: 4, paolo: 3, luca: 1 });
    expect(ids(s, 'cappello', 1)).toEqual(['Giovanni']);
    expect(ids(s, 'cappello', 2)).toEqual(['Antonio', 'Marta']);
    const placements = verdict(s).cappello.placements!.r0;
    expect(placements).toEqual([
      { prize: 'ricerca', place: 1 },
      { prize: 'idea', place: 2 },
      { prize: 'performance', place: 2 },
    ]);
  });
  it('shares a prize when two free people are tied at the top', () => {
    const s = evening({ Anna: { idea: 3 }, Bruno: { idea: 3 }, Carla: { ricerca: 1 } });
    expect(ids(s, 'idea', 1)).toEqual(['Anna', 'Bruno']);
    expect(verdict(s).idea.shared).toBe(true);
    expect(ids(s, 'ricerca', 1)).toEqual(['Carla']);
  });
  it('merit before headcount: a prize never drifts to fewer stamps just to name one more person', () => {
    // Sharing idea would free ricerca for Carla (1 stamp), but Bruno has 2: Anna idea, Bruno ricerca.
    const s = evening({ Anna: { idea: 3, ricerca: 2 }, Bruno: { idea: 3, ricerca: 2 }, Carla: { ricerca: 1 } });
    expect(verdict(s).idea.podium[1]).toHaveLength(1);
    expect(verdict(s).ricerca.podium[1]).toHaveLength(1);
    expect(ids(s, 'ricerca', 1)).not.toEqual(['Carla']);
  });
  it('never shares at the cost of a clear win', () => {
    // Anna is first alone in ricerca: she keeps it, even if sharing idea would award more people.
    const s = evening({ Anna: { idea: 3, ricerca: 4 }, Bruno: { idea: 3 }, Carla: { ricerca: 1 } });
    expect(ids(s, 'ricerca', 1)).toEqual(['Anna']);
    expect(ids(s, 'idea', 1)).toEqual(['Bruno']);
  });
  it('a three-way tie gives exactly two winners; the third stays free for another prize', () => {
    const s = evening({ Anna: { idea: 3 }, Bruno: { idea: 3 }, Carla: { idea: 3, ricerca: 2 }, Dario: { ricerca: 1 } });
    expect(ids(s, 'idea', 1)).toEqual(['Anna', 'Bruno']);
    expect(ids(s, 'idea', 2)).toEqual(['Carla']);
    expect(ids(s, 'ricerca', 1)).toEqual(['Carla']);
  });
  it('a clear leader in two prizes keeps the one with the bigger gap', () => {
    const s = evening({ Anna: { idea: 5, ricerca: 4 }, Bruno: { idea: 3, ricerca: 3 } });
    expect(ids(s, 'idea', 1)).toEqual(['Anna']);
    expect(ids(s, 'ricerca', 1)).toEqual(['Bruno']);
  });
  it('gives a double prize when nobody else is left, to one raw leader only', () => {
    const s = evening({ Anna: { idea: 3, ricerca: 2 }, Bruno: { idea: 1 } });
    expect(ids(s, 'idea', 1)).toEqual(['Anna']);
    expect(ids(s, 'ricerca', 1)).toEqual(['Anna']);
    expect(verdict(s).ricerca.double).toBe(true);
    const tied = evening({ Anna: { idea: 3, ricerca: 2 }, Bruno: { idea: 2, ricerca: 2 } });
    // Bruno can't win idea (Anna's clear win), so ricerca goes to him; nothing is doubled.
    expect(ids(tied, 'ricerca', 1)).toEqual(['Bruno']);
  });
  it('a category with no stamps is not awarded; talks without ballots are ignored', () => {
    let s = evening({ Anna: { idea: 2 }, Bruno: {} });
    expect(verdict(s).qa.podium[1]).toEqual([]);
    s = evening({ Anna: { idea: 2 } });
    s.rounds.push({ id: 'empty', presenterId: 'gianluca', closed: true });
    s.participants.push({
      id: 'gianluca',
      name: 'Gianluca',
      role: '',
      title: '',
      deckUrl: '',
      mode: 'paper',
      spectator: false,
    });
    expect(talks(s).find((t) => t.presenter.id === 'gianluca')!.ballots).toBe(0);
    expect(ids(s, 'cappello', 1)).toEqual(['Anna']);
    expect(ids(s, 'cappello', 2)).toEqual([]);
  });
  it('Cappello: ties broken by total share, shared by two at most, reproducible', () => {
    // Anna and Bruno share idea (3 points each); Carla and Dario share ricerca.
    const s = evening({ Anna: { idea: 3 }, Bruno: { idea: 3 }, Carla: { ricerca: 3 }, Dario: { ricerca: 3 } });
    const v = verdict(s);
    expect(v.cappello.podium[1]).toHaveLength(2);
    expect(v.cappello.shared).toBe(true);
    expect(JSON.stringify(verdict(s))).toBe(JSON.stringify(v));
    // Equal points, different total share: the higher share wins alone.
    const t = evening({ Anna: { idea: 3, ricerca: 2 }, Bruno: { ricerca: 3, idea: 1 } });
    expect(medalPoints(t).anna).toBe(medalPoints(t).bruno);
    expect(ids(t, 'cappello', 1)).toEqual(['Anna']);
  });
  it('does not depend on the reveal order', () => {
    const s = example();
    const before = JSON.stringify(verdict(s));
    s.settings = { ...s.settings, awardOrder: ['qa', 'performance', 'ricerca', 'idea'] };
    expect(JSON.stringify(verdict(s))).toBe(before);
  });
});
describe('registro and certificate', () => {
  it('the Registro lists stamps received (no counts); the certificate has counts and prizes', () => {
    const s = evening({ Anna: { idea: 3, ricerca: 1 }, Bruno: { ricerca: 4 } });
    expect(registro(s).find((r) => r.talk.presenter.id === 'anna')!.stamps).toEqual(['idea', 'ricerca']);
    const c = certificate(s, 'anna')!;
    expect(c.talk.counts.idea).toBe(3);
    expect(c.prizes).toContain('idea');
    expect(c.mentions).toContainEqual({ prize: 'ricerca', place: 2 });
    expect(certificate(s, 'nessuno')).toBeNull();
  });
});
