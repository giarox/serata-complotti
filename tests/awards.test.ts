import { describe, expect, it } from 'vitest';
import {
  applyAction,
  awards,
  defaultSettings,
  initialState,
  normalize,
  runnersUp,
  snapshot,
  type Actor,
  type Ballot,
  type CategoryKey,
  type Settings,
  type State,
} from '../src/domain';

const gm: Actor = { role: 'gm' };
const guest = (id: string): Actor => ({ role: 'guest', participantId: id });
const ballot = (c: number, d: number, r: number, s: boolean): Ballot => ({
  credibility: c,
  delivery: d,
  research: r,
  supercazzola: s,
});

/** Runs a full round for `presenter`, with each voter's ballot, and closes it. */
function round(s: State, presenter: string, ballots: Record<string, Ballot>) {
  s = applyAction(s, gm, { type: 'start', participantId: presenter });
  const id = s.activeRoundId!;
  s = applyAction(s, gm, { type: 'phase', phase: 'questions', roundId: id });
  s = applyAction(s, gm, { type: 'phase', phase: 'voting', roundId: id });
  for (const [voter, b] of Object.entries(ballots))
    s = applyAction(s, guest(voter), { type: 'vote', roundId: id, ballot: b });
  return applyAction(s, gm, { type: 'phase', phase: 'waiting', roundId: id });
}
const withSettings = (s: State, patch: Partial<Settings>) =>
  applyAction(s, gm, { type: 'settings', settings: { ...s.settings, ...patch } });
const names = (s: State, key: CategoryKey) =>
  awards(s)
    .find((a) => a.key === key)!
    .winners.map((p) => p.id);

describe('awards and tie-breaks', () => {
  it('gives each category to its own top average, compared unrounded', () => {
    let s = initialState();
    // Paolo credibility mean 7.333…, Giulia 7.5 → Giulia; delivery Paolo 9 vs 5 → Paolo.
    s = round(s, 'paolo', {
      giulia: ballot(7, 9, 1, false),
      marco: ballot(7, 9, 1, false),
      sara: ballot(8, 9, 1, false),
    });
    s = round(s, 'giulia', { paolo: ballot(7, 5, 2, true), marco: ballot(8, 5, 2, false) });
    expect(names(s, 'credibility')).toEqual(['giulia']);
    expect(names(s, 'delivery')).toEqual(['paolo']);
    expect(names(s, 'research')).toEqual(['giulia']);
    expect(names(s, 'supercazzola')).toEqual(['giulia']);
    expect(awards(s)[0].outcome).toBe('clear');
  });

  it('puts second and third place on the podium, ties sharing a step', () => {
    let s = initialState();
    s = round(s, 'paolo', { giulia: ballot(9, 1, 1, false), marco: ballot(9, 1, 1, false) });
    s = round(s, 'giulia', { paolo: ballot(7, 1, 1, false), marco: ballot(7, 1, 1, false) });
    s = round(s, 'marco', { paolo: ballot(7, 1, 1, false), giulia: ballot(7, 1, 1, false) });
    s = round(s, 'sara', { paolo: ballot(5, 1, 1, false), giulia: ballot(5, 1, 1, false) });
    const a = awards(s).find((x) => x.key === 'credibility')!;
    expect(a.winners.map((p) => p.id)).toEqual(['paolo']);
    expect(runnersUp(a).map((p) => [p.place, p.people.map((x) => x.id), p.value])).toEqual([
      [2, ['giulia', 'marco'], 7],
      [3, ['sara'], 5],
    ]);
  });

  it('breaks a tie in favour of the person without an earlier award', () => {
    let s = initialState();
    // Paolo wins credibility outright, then ties with Giulia on delivery → Giulia gets delivery.
    s = round(s, 'paolo', { giulia: ballot(10, 8, 0, false), marco: ballot(10, 8, 0, false) });
    s = round(s, 'giulia', { paolo: ballot(2, 8, 0, false), marco: ballot(2, 8, 0, false) });
    const delivery = awards(s).find((a) => a.key === 'delivery')!;
    expect(names(s, 'credibility')).toEqual(['paolo']);
    expect(delivery.winners.map((p) => p.id)).toEqual(['giulia']);
    expect(delivery.outcome).toBe('tieBreak');
    expect(delivery.passedOver.map((p) => p.id)).toEqual(['paolo']);
  });

  it('shares the prize (pari merito) when nobody tied has won yet, or everybody has', () => {
    let s = initialState();
    s = round(s, 'paolo', { giulia: ballot(6, 6, 0, false), marco: ballot(6, 6, 0, false) });
    s = round(s, 'giulia', { paolo: ballot(6, 6, 0, false), marco: ballot(6, 6, 0, false) });
    const [credibility, delivery] = awards(s);
    expect(credibility.outcome).toBe('shared');
    expect(credibility.winners.map((p) => p.id).sort()).toEqual(['giulia', 'paolo']);
    // Both already won credibility, so delivery is shared again.
    expect(delivery.outcome).toBe('shared');
    expect(delivery.winners).toHaveLength(2);
  });

  it('applies the tie-break in reveal order, so changing the order can change winners', () => {
    let s = initialState();
    // Paolo wins Supercazzola alone; Paolo and Giulia tie on credibility.
    s = round(s, 'paolo', { giulia: ballot(5, 1, 1, true), marco: ballot(5, 1, 1, true) });
    s = round(s, 'giulia', { paolo: ballot(5, 1, 1, false), marco: ballot(5, 1, 1, false) });
    expect(names(s, 'credibility').sort()).toEqual(['giulia', 'paolo']);
    s = withSettings(s, { awardOrder: ['supercazzola', 'credibility', 'delivery', 'research'] });
    expect(awards(s).map((a) => a.key)).toEqual(['supercazzola', 'credibility', 'delivery', 'research']);
    expect(names(s, 'credibility')).toEqual(['giulia']);
  });

  it('skips people who reached the cap and gives the prize to the next best', () => {
    let s = initialState();
    s = round(s, 'paolo', { giulia: ballot(10, 10, 10, true), marco: ballot(10, 10, 10, true) });
    s = round(s, 'giulia', { paolo: ballot(5, 4, 3, true), marco: ballot(5, 4, 3, false) });
    expect(awards(s).every((a) => a.winners[0]?.id === 'paolo')).toBe(true);
    s = withSettings(s, { maxAwards: 1 });
    const result = awards(s);
    expect(result.map((a) => a.winners.map((p) => p.id))).toEqual([['paolo'], ['giulia'], [], []]);
    expect(result[1].capped.map((p) => p.id)).toEqual(['paolo']);
    expect(result[2].outcome).toBe('none');
  });

  it('gives no automatic award to talks without votes, nor a Supercazzola with zero yes', () => {
    let s = initialState();
    s = round(s, 'paolo', {});
    s = round(s, 'giulia', { paolo: ballot(3, 3, 3, false) });
    expect(names(s, 'credibility')).toEqual(['giulia']);
    const supercazzola = awards(s).find((a) => a.key === 'supercazzola')!;
    expect(supercazzola.outcome).toBe('none');
    expect(supercazzola.winners).toEqual([]);
  });
});

describe('settings, spectators and the GM as participant', () => {
  it('only accepts valid settings, and freezes them during the reveal', () => {
    const s = round(initialState(), 'paolo', { giulia: ballot(1, 1, 1, true) });
    const bad: Settings[] = [
      { ...defaultSettings(), maxAwards: 0 },
      { ...defaultSettings(), maxAwards: 1.5 },
      { ...defaultSettings(), awardOrder: ['credibility', 'credibility', 'delivery', 'research'] },
      { ...defaultSettings(), awardOrder: ['credibility', 'delivery', 'research'] },
    ];
    for (const settings of bad) expect(() => applyAction(s, gm, { type: 'settings', settings })).toThrow();
    expect(() => applyAction(s, guest('giulia'), { type: 'settings', settings: defaultSettings() })).toThrow();
    const revealed = applyAction(s, gm, { type: 'reveal' });
    expect(() => applyAction(revealed, gm, { type: 'settings', settings: defaultSettings() })).toThrow();
  });

  it('lets spectators vote only when the setting allows it', () => {
    let s = applyAction(initialState(), gm, { type: 'start', participantId: 'paolo' });
    const id = s.activeRoundId!;
    s = applyAction(s, gm, { type: 'phase', phase: 'questions', roundId: id });
    s = applyAction(s, gm, { type: 'phase', phase: 'voting', roundId: id });
    const spectatorVote = (st: State) =>
      applyAction(st, guest('pubblico'), { type: 'vote', roundId: id, ballot: ballot(5, 5, 5, true) });
    expect(spectatorVote(s).votes).toHaveLength(1);
    const noSpectators: State = { ...s, settings: { ...s.settings, spectatorsVote: false } };
    expect(() => spectatorVote(noSpectators)).toThrow('pubblico non vota');
  });

  it('lets a GM with a name vote, sees only their own ballot, and blocks their self-vote', () => {
    const gmGianluca: Actor = { role: 'gm', participantId: 'gianluca' };
    let s = applyAction(initialState(), gmGianluca, { type: 'start', participantId: 'paolo' });
    let id = s.activeRoundId!;
    s = applyAction(s, gmGianluca, { type: 'phase', phase: 'questions', roundId: id });
    s = applyAction(s, gmGianluca, { type: 'phase', phase: 'voting', roundId: id });
    s = applyAction(s, gmGianluca, { type: 'vote', roundId: id, ballot: ballot(9, 9, 9, true) });
    s = applyAction(s, guest('giulia'), { type: 'vote', roundId: id, ballot: ballot(1, 1, 1, false) });
    expect(snapshot(s, gmGianluca).votes.map((v) => v.voterId)).toEqual(['gianluca']);
    expect(snapshot(s, gm).votes).toEqual([]);
    s = applyAction(s, gmGianluca, { type: 'phase', phase: 'waiting', roundId: id });
    s = applyAction(s, gmGianluca, { type: 'start', participantId: 'gianluca' });
    id = s.activeRoundId!;
    s = applyAction(s, gmGianluca, { type: 'phase', phase: 'questions', roundId: id });
    s = applyAction(s, gmGianluca, { type: 'phase', phase: 'voting', roundId: id });
    expect(() => applyAction(s, gmGianluca, { type: 'vote', roundId: id, ballot: ballot(9, 9, 9, true) })).toThrow(
      'tuo intervento',
    );
  });

  it('fills in default settings for older saved states', () => {
    const old = { ...initialState() } as Partial<State>;
    delete old.settings;
    expect(normalize(old as State).settings).toEqual(defaultSettings());
  });
});
