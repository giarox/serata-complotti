import { REVEAL_STEPS, stampKeys, type Participant, type Round, type StampKey, type State } from './domain';

/**
 * The verdict, computed from the stamps (see "Sistema di voto — Timbri").
 * Each talk gets, per stamp, a share: stamps received / ballots filed for that talk (0…1).
 * The total is the sum of the four shares (0…2). Comparisons are always at full precision.
 */
export type Talk = {
  round: Round;
  /** Evening order, 1-based. */
  order: number;
  presenter: Participant;
  ballots: number;
  counts: Record<StampKey, number>;
  share: Record<StampKey, number>;
  total: number;
};
const EPS = 1e-9;
const same = (a: number, b: number) => Math.abs(a - b) < EPS;

export function talks(s: State): Talk[] {
  return s.rounds
    .filter((r) => r.closed && !r.cancelled)
    .map((round, i) => {
      const votes = s.votes.filter((v) => v.roundId === round.id);
      const counts = Object.fromEntries(stampKeys.map((k) => [k, votes.filter((v) => v[k] === true).length])) as Record<
        StampKey,
        number
      >;
      const share = Object.fromEntries(
        stampKeys.map((k) => [k, votes.length ? counts[k] / votes.length : 0]),
      ) as Record<StampKey, number>;
      return {
        round,
        order: i + 1,
        presenter: s.participants.find((p) => p.id === round.presenterId)!,
        ballots: votes.length,
        counts,
        share,
        total: stampKeys.reduce((n, k) => n + share[k], 0),
      };
    })
    .filter((t) => t.presenter);
}

/** A podium: up to three steps, each with one or more talks (ties share a step). */
export type Podium = { 1: Talk[]; 2: Talk[]; 3: Talk[] };
export type PrizeKey = StampKey | 'cappello';
export type Prize = {
  key: PrizeKey;
  podium: Podium;
  /** Won by more than one talk (pari merito). */
  shared: boolean;
};

/** Groups the candidates by score, best first, into at most `n` steps; zero scores never make the podium. */
function steps(candidates: Talk[], score: (t: Talk) => number, n: number): Talk[][] {
  const groups: Talk[][] = [];
  for (const t of [...candidates].sort((a, b) => score(b) - score(a) || a.order - b.order)) {
    if (score(t) <= EPS) continue;
    const g = groups.find((x) => same(score(x[0]), score(t)));
    if (g) g.push(t);
    else if (groups.length < n) groups.push([t]);
  }
  return groups;
}

/**
 * The four stamp prizes plus the Cappello di Stagnola d'Oro.
 * 1. Cappello: highest total (ties share it). Its winners leave every other podium.
 * 2. Stamp prizes: one prize per person at most, chosen as the best combination overall (not category by
 *    category), so the reveal order never changes who wins. Objective: the largest sum of winning shares;
 *    on equal sums, more prizes given, then the best share in the most coveted prize (idea, ricerca,
 *    performance, qa), then the earlier talk. A prize needs at least one stamp.
 * 3. Ties in a category: whoever is tied with the winner and has no prize yet shares it (pari merito).
 * 4. 2nd and 3rd place are mentions: the next shares among the candidates, even if they won elsewhere.
 */
export function verdict(s: State): Record<PrizeKey, Prize> {
  const all = talks(s).filter((t) => t.ballots > 0);
  // Cappello
  const capSteps = steps(all, (t) => t.total, 3);
  const capWinners = capSteps[0] ?? [];
  const cappello: Prize = {
    key: 'cappello',
    podium: { 1: capWinners, 2: capSteps[1] ?? [], 3: capSteps[2] ?? [] },
    shared: capWinners.length > 1,
  };
  const out = new Set(capWinners.map((t) => t.round.id));
  const pool = all.filter((t) => !out.has(t.round.id));
  // Best assignment, by brute force (≤ 15 talks × 4 prizes is tiny).
  const coveted: StampKey[] = ['idea', 'ricerca', 'performance', 'qa'];
  const options = coveted.map((k) => [null, ...pool.filter((t) => t.share[k] > EPS)] as (Talk | null)[]);
  type Pick = (Talk | null)[];
  const score = (pick: Pick) => {
    const shares = pick.map((t, i) => (t ? t.share[coveted[i]] : 0));
    return {
      sum: shares.reduce((a, b) => a + b, 0),
      given: pick.filter(Boolean).length,
      shares,
      orders: pick.map((t) => (t ? t.order : 999)),
    };
  };
  const better = (a: ReturnType<typeof score>, b: ReturnType<typeof score>) => {
    if (!same(a.sum, b.sum)) return a.sum > b.sum;
    if (a.given !== b.given) return a.given > b.given;
    for (let i = 0; i < 4; i++) if (!same(a.shares[i], b.shares[i])) return a.shares[i] > b.shares[i];
    for (let i = 0; i < 4; i++) if (a.orders[i] !== b.orders[i]) return a.orders[i] < b.orders[i];
    return false;
  };
  let best: Pick = [null, null, null, null],
    bestScore = score(best);
  const walk = (i: number, pick: Pick, used: Set<string>) => {
    if (i === 4) {
      const sc = score(pick);
      if (better(sc, bestScore)) {
        best = [...pick];
        bestScore = sc;
      }
      return;
    }
    for (const t of options[i]) {
      if (t && used.has(t.round.id)) continue;
      pick[i] = t;
      if (t) used.add(t.round.id);
      walk(i + 1, pick, used);
      if (t) used.delete(t.round.id);
    }
    pick[i] = null;
  };
  walk(0, [null, null, null, null], new Set());
  const prized = new Set(best.filter(Boolean).map((t) => t!.round.id));
  const result = { cappello } as Record<PrizeKey, Prize>;
  coveted.forEach((k, i) => {
    const w = best[i];
    if (!w) {
      result[k] = { key: k, podium: { 1: [], 2: [], 3: [] }, shared: false };
      return;
    }
    // Pari merito: tied with the winner and still without a prize.
    const tied = pool.filter((t) => t !== w && same(t.share[k], w.share[k]) && !prized.has(t.round.id));
    for (const t of tied) prized.add(t.round.id);
    const first = [w, ...tied].sort((a, b) => a.order - b.order);
    const firstIds = new Set(first.map((t) => t.round.id));
    const rest = steps(
      pool.filter((t) => !firstIds.has(t.round.id)),
      (t) => t.share[k],
      2,
    );
    result[k] = { key: k, podium: { 1: first, 2: rest[0] ?? [], 3: rest[1] ?? [] }, shared: first.length > 1 };
  });
  return result;
}

/** Reveal order: from the lightest to the most coveted, then the Cappello. */
export const prizeOrder: StampKey[] = ['qa', 'performance', 'ricerca', 'idea'];
export type RevealMoment =
  | { kind: 'open'; prize: PrizeKey }
  | { kind: 'place'; prize: PrizeKey; place: 3 | 2 | 1 }
  | { kind: 'interlude' }
  | { kind: 'registro' };
/**
 * What the projector shows at reveal step n (1…22): for each stamp prize open, 3rd, 2nd, 1st;
 * then an interlude; the Cappello the same way; finally the Registro dei Timbri.
 */
export function revealMoment(s: Pick<State, 'phase' | 'revealed'>): RevealMoment | null {
  if (s.phase !== 'results' || s.revealed < 1) return null;
  const n = Math.min(s.revealed, REVEAL_STEPS);
  const placeOf = (sub: number): 3 | 2 | 1 => (sub === 1 ? 3 : sub === 2 ? 2 : 1);
  if (n <= 16) {
    const prize = prizeOrder[Math.floor((n - 1) / 4)],
      sub = (n - 1) % 4;
    return sub === 0 ? { kind: 'open', prize } : { kind: 'place', prize, place: placeOf(sub) };
  }
  if (n === 17) return { kind: 'interlude' };
  if (n <= 21) {
    const sub = (n - 18) % 4;
    return sub === 0 ? { kind: 'open', prize: 'cappello' } : { kind: 'place', prize: 'cappello', place: placeOf(sub) };
  }
  return { kind: 'registro' };
}
/** Prizes whose winner is already on the projector (phones and regia show only these). */
export function revealedPrizes(s: Pick<State, 'phase' | 'revealed'>): PrizeKey[] {
  if (s.phase !== 'results') return [];
  const done: PrizeKey[] = prizeOrder.filter((_, i) => s.revealed >= 4 * (i + 1));
  if (s.revealed >= 21) done.push('cappello');
  return done;
}
/** The end of the evening: the Registro is on the projector and everyone gets their certificate. */
export const revealOver = (s: Pick<State, 'phase' | 'revealed'>) => s.phase === 'results' && s.revealed >= REVEAL_STEPS;

/** Who received which stamps (at least once), in evening order; no counts. */
export function registro(s: State) {
  return talks(s).map((t) => ({ talk: t, stamps: stampKeys.filter((k) => t.counts[k] > 0) }));
}

/** A person's own certificate: their talk's stamp counts, prizes and mentions. Private. */
export function certificate(s: State, participantId: string) {
  const owner = participantId.replace(/\+$/, '');
  const talk = talks(s).find((t) => t.presenter.id === owner);
  if (!talk) return null;
  const v = verdict(s);
  const prizes: PrizeKey[] = [],
    mentions: { prize: PrizeKey; place: 2 | 3 }[] = [];
  for (const key of [...prizeOrder, 'cappello'] as PrizeKey[]) {
    const p = v[key].podium,
      on = (step: Talk[]) => step.some((x) => x.round.id === talk.round.id);
    if (on(p[1])) prizes.push(key);
    else if (on(p[2])) mentions.push({ prize: key, place: 2 });
    else if (on(p[3])) mentions.push({ prize: key, place: 3 });
  }
  return { talk, prizes, mentions };
}
