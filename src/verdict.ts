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
/** Where a talk landed on one stamp prize's podium (for the Cappello infographic). */
export type Placement = { prize: StampKey; place: 1 | 2 | 3 };
export type Prize = {
  key: PrizeKey;
  podium: Podium;
  /** Won by two talks (pari merito). Never more than two. */
  shared: boolean;
  /** Stamp prizes only: won by someone who already had a prize, because nobody else was left (rule d). */
  double?: boolean;
  /** Cappello only: each winner's placements on the four stamp podiums. */
  placements?: Record<string, Placement[]>;
};

/** Groups talks by a score, best first, into at most `n` levels; zero scores never count. */
function levels(list: Talk[], score: (t: Talk) => number, n = Infinity): Talk[][] {
  const groups: Talk[][] = [];
  for (const t of [...list].sort((a, b) => score(b) - score(a) || a.order - b.order)) {
    if (score(t) <= EPS) continue;
    const g = groups.find((x) => same(score(x[0]), score(t)));
    if (g) g.push(t);
    else if (groups.length < n) groups.push([t]);
  }
  return groups;
}
/** A reproducible "draw of the Congress": a stable pseudo-random rank per talk (FNV-1a of seed + round id). */
function drawRank(seed: string, t: Talk) {
  let h = 0x811c9dc5;
  for (const ch of seed + '|' + t.round.id) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h;
}
const coveted: StampKey[] = ['idea', 'ricerca', 'performance', 'qa'];

/**
 * The four stamp prizes and the Cappello (see "Sistema di voto — Timbri", premiazione v2).
 * Stamp prizes, all together:
 *  a) one stamp prize per person (a shared prize counts for both), except rule d;
 *  b) "the ladder": whoever wins elsewhere steps aside; the winners are the free candidates at the top share:
 *     one alone wins, two tied share it, three or more tied → exactly two (the search tries every pair);
 *  c) never skip a free candidate at the top for someone lower;
 *  d) if no free candidate is left, the raw first wins it anyway (one winner) — a double prize;
 *  e) no stamps at all in a category → prize not awarded.
 * Among the valid assignments, in order: most prizes kept by clear raw leaders; highest sum of winning
 * shares (merit: a prize never drifts to fewer stamps just to name one more person); most different people
 * awarded; fewest doubles; fewest shared prizes; highest sum of the winners' total shares; a reproducible draw.
 * Podiums: 1st = winners; 2nd and 3rd = the next share levels among the other candidates, prize winners
 * elsewhere included. Cappello: medal table on those podiums (3/2/1 points), ties by total share, shared by
 * two at most, then the draw. It can add up to a stamp prize.
 */
export function verdict(s: State): Record<PrizeKey, Prize> {
  const all = talks(s).filter((t) => t.ballots > 0);
  const seed = s.rounds[0]?.id ?? 'congresso';
  const rank = (t: Talk) => drawRank(seed, t);
  const id = (t: Talk) => t.round.id;
  const cands = Object.fromEntries(coveted.map((k) => [k, all.filter((t) => t.share[k] > EPS)])) as Record<
    StampKey,
    Talk[]
  >;
  const raw = Object.fromEntries(coveted.map((k) => [k, levels(cands[k], (t) => t.share[k])])) as Record<
    StampKey,
    Talk[][]
  >;
  // Options per prize: one talk, or two tied talks; nothing only when nobody got that stamp.
  const options = coveted.map((k) => {
    if (!cands[k].length) return [[]] as Talk[][];
    const out: Talk[][] = [];
    for (const lv of raw[k]) {
      for (const t of lv) out.push([t]);
      for (let i = 0; i < lv.length; i++) for (let j = i + 1; j < lv.length; j++) out.push([lv[i], lv[j]]);
    }
    return out;
  });
  type Pick = Talk[][];
  /**
   * Checks an assignment, given which prizes are "doubles" (rule d). A double's winner doesn't count as taken
   * for the other prizes; every other winner does.
   */
  const valid = (pick: Pick, doubles: boolean[]) => {
    const taken = (except: number) => new Set(pick.flatMap((w, j) => (j === except || doubles[j] ? [] : w.map(id))));
    for (let i = 0; i < 4; i++) {
      const k = coveted[i],
        W = pick[i];
      if (!cands[k].length) {
        if (W.length || doubles[i]) return false;
        continue;
      }
      const elsewhere = taken(i);
      const free = cands[k].filter((t) => !elsewhere.has(id(t)));
      if (doubles[i]) {
        // d) nobody free: one winner from the raw top, who already won elsewhere.
        if (free.length || W.length !== 1 || !raw[k][0].some((t) => id(t) === id(W[0]))) return false;
        continue;
      }
      if (!free.length) return false;
      const top = Math.max(...free.map((t) => t.share[k]));
      const F = free.filter((t) => same(t.share[k], top));
      if (W.length !== Math.min(F.length, 2) || !W.every((w) => F.some((f) => id(f) === id(w)))) return false;
    }
    // a) one stamp prize per person, doubles aside.
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++)
      if (!doubles[i])
        for (const w of pick[i]) {
          if (seen.has(id(w))) return false;
          seen.add(id(w));
        }
    return true;
  };
  const score = (pick: Pick, doubles: boolean[]) => {
    const clear = coveted.filter(
      (k, i) => raw[k][0]?.length === 1 && pick[i].some((w) => id(w) === id(raw[k][0][0])),
    ).length;
    const people = new Set(pick.flat().map(id)).size;
    const shares = pick.reduce((n, W, i) => n + (W[0] ? W[0].share[coveted[i]] : 0), 0);
    const totals = pick.flat().reduce((n, w) => n + w.total, 0);
    const draw = pick
      .flat()
      .map(rank)
      .sort((a, b) => a - b);
    // Merit before headcount: the stamps received decide, sharing only helps on true ties (Gianluca, 28 Oct).
    return [
      clear,
      shares,
      people,
      -doubles.filter(Boolean).length,
      -pick.filter((W) => W.length === 2).length,
      totals,
      draw,
    ] as const;
  };
  const better = (a: ReturnType<typeof score>, b: ReturnType<typeof score>) => {
    for (let i = 0; i < 6; i++) if (!same(a[i] as number, b[i] as number)) return (a[i] as number) > (b[i] as number);
    const da = a[6],
      db = b[6];
    for (let i = 0; i < Math.min(da.length, db.length); i++) if (da[i] !== db[i]) return da[i] < db[i];
    return false;
  };
  let best: Pick = coveted.map(() => []),
    bestDoubles: boolean[] = [false, false, false, false],
    bestScore: ReturnType<typeof score> | null = null;
  const flags = Array.from({ length: 16 }, (_, m) => [0, 1, 2, 3].map((i) => !!(m & (1 << i))));
  const walk = (i: number, pick: Pick) => {
    if (i === 4) {
      for (const d of flags) {
        if (!valid(pick, d)) continue;
        const sc = score(pick, d);
        if (!bestScore || better(sc, bestScore)) {
          best = pick.map((w) => [...w]);
          bestDoubles = d;
          bestScore = sc;
        }
      }
      return;
    }
    for (const W of options[i]) {
      pick[i] = W;
      walk(i + 1, pick);
    }
  };
  walk(0, [[], [], [], []]);

  const result = {} as Record<PrizeKey, Prize>;
  coveted.forEach((k, i) => {
    const W = [...best[i]].sort((a, b) => a.order - b.order);
    const won = new Set(W.map(id));
    const rest = levels(
      cands[k].filter((t) => !won.has(id(t))),
      (t) => t.share[k],
      2,
    );
    result[k] = {
      key: k,
      podium: { 1: W, 2: rest[0] ?? [], 3: rest[1] ?? [] },
      shared: W.length === 2,
      double: bestDoubles[i],
    };
  });
  // Cappello: medal table on the podiums shown (1st 3 points, 2nd 2, 3rd 1).
  const points = new Map<string, number>(),
    placed = new Map<string, Placement[]>();
  for (const k of coveted)
    for (const place of [1, 2, 3] as const)
      for (const t of result[k].podium[place]) {
        points.set(id(t), (points.get(id(t)) ?? 0) + 4 - place);
        placed.set(id(t), [...(placed.get(id(t)) ?? []), { prize: k, place }]);
      }
  const ranked = all
    .filter((t) => (points.get(id(t)) ?? 0) > 0)
    .sort((a, b) => (points.get(id(b)) ?? 0) - (points.get(id(a)) ?? 0) || b.total - a.total || rank(a) - rank(b));
  const tiedTop = ranked.filter(
    (t) => ranked[0] && points.get(id(t)) === points.get(id(ranked[0])) && same(t.total, ranked[0].total),
  );
  const capWinners = tiedTop.slice(0, 2).sort((a, b) => a.order - b.order);
  const capIds = new Set(capWinners.map(id));
  const capRest = levels(
    ranked.filter((t) => !capIds.has(id(t))),
    (t) => points.get(id(t)) ?? 0,
    2,
  );
  result.cappello = {
    key: 'cappello',
    podium: { 1: capWinners, 2: capRest[0] ?? [], 3: capRest[1] ?? [] },
    shared: capWinners.length === 2,
    placements: Object.fromEntries(
      capWinners.map((t) => [
        id(t),
        (placed.get(id(t)) ?? []).sort(
          (a, b) => a.place - b.place || coveted.indexOf(a.prize) - coveted.indexOf(b.prize),
        ),
      ]),
    ),
  };
  return result;
}
/** Medal-table points per talk (for tests and the regia export). */
export function medalPoints(s: State) {
  const v = verdict(s),
    out: Record<string, number> = {};
  for (const k of coveted)
    for (const place of [1, 2, 3] as const)
      for (const t of v[k].podium[place]) out[t.presenter.id] = (out[t.presenter.id] ?? 0) + 4 - place;
  return out;
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
