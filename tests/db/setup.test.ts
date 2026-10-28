// Runs supabase/setup.sql in a local Postgres (PGlite) with small stand-ins for Supabase's
// auth schema and roles, then calls the functions as real guests/GM would, through the
// `authenticated` role — never as an all-powerful administrator.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error plain JS helper shared with the make-init script
import { buildInitSql, hashPasswords, normGuest, validateRoster } from '../../supabase/init-sql.mjs';

const setupSql = readFileSync(new URL('../../supabase/setup.sql', import.meta.url), 'utf8');
const roster = validateRoster(JSON.parse(readFileSync(new URL('../../supabase/roster.json', import.meta.url), 'utf8')));
const GUEST = 'NonCieLoDicono Test';
const GM = '9137';
let hashes: [string, string];
let db: PGlite;

const supabaseStandIns = `
create schema if not exists extensions;
create schema if not exists auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
`;

/** Runs one query as the signed-in user `uid` through the `authenticated` role. */
async function as<T = unknown>(uid: string | null, sql: string, params: unknown[] = []) {
  await db.query(`select set_config('test.uid', $1, false)`, [uid ?? '']);
  await db.exec(uid ? 'set role authenticated' : 'set role anon');
  try {
    const { rows } = await db.query<{ r: T }>(sql, params);
    return rows[0]?.r as T;
  } finally {
    await db.exec('reset role');
  }
}
const user = async () => {
  const id = randomUUID();
  await db.query('insert into auth.users(id) values ($1)', [id]);
  return id;
};
const join = (uid: string, passcode: string, person: string | null, gm = false) =>
  as<{ role: string; participantId?: string }>(uid, 'select public.party_join($1, $2, $3) as r', [
    passcode,
    person,
    gm,
  ]);
const act = (uid: string, command: object) =>
  as(uid, 'select public.party_action($1::jsonb) as r', [JSON.stringify(command)]);
type Snap = {
  phase: string;
  activeRoundId: string | null;
  votes: { voterId: string; roundId: string; idea: boolean; qa: boolean }[];
  reviewed?: string[];
  rounds: { id: string }[];
  voteCount: number;
  claimed?: string[];
  settings: { spectatorsVote: boolean; maxAwards: number | null };
};
const snap = (uid: string) => as<Snap>(uid, 'select public.party_snapshot() as r');
const ballot = { idea: true, ricerca: true, performance: false, qa: false };
const none = { idea: false, ricerca: false, performance: false, qa: false };

beforeAll(async () => {
  hashes = await hashPasswords(normGuest(GUEST), GM);
}, 30000);

let gm: string, giulia: string, marco: string, paolo: string;
beforeEach(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(supabaseStandIns);
  await db.exec(setupSql);
  await db.exec(buildInitSql({ guestHash: hashes[0], gmHash: hashes[1], roster }));
  [gm, giulia, marco, paolo] = await Promise.all([user(), user(), user(), user()]);
  await join(gm, GM, null, true);
  await join(giulia, GUEST, 'giulia');
  await join(marco, GUEST, 'marco');
  await join(paolo, GUEST, 'paolo');
}, 30000);

async function openVoting(presenter = 'paolo') {
  await act(gm, { type: 'start', participantId: presenter });
  const roundId = (await snap(gm)).activeRoundId!;
  await act(gm, { type: 'phase', phase: 'questions', roundId });
  await act(gm, { type: 'phase', phase: 'voting', roundId });
  return roundId;
}

describe('access', () => {
  it('denies direct table reads and writes, even for signed-in users', async () => {
    await expect(as(giulia, 'select state as r from public.party_store')).rejects.toThrow(/permission denied/);
    await expect(as(giulia, 'select count(*) as r from public.party_members')).rejects.toThrow(/permission denied/);
    await expect(as(giulia, `update public.party_signal set revision = 0`)).rejects.toThrow(/permission denied/);
  });

  it('denies every function to visitors who are not signed in', async () => {
    await expect(as(null, `select public.party_names('${GUEST}') as r`)).rejects.toThrow(/permission denied/);
    await expect(as(null, 'select public.party_snapshot() as r')).rejects.toThrow(/permission denied/);
  });

  it('shows names to any signed-in guest, checks a typed PIN, and lets only the GM PIN into the regia', async () => {
    const stranger = await user();
    await expect(as(stranger, 'select public.party_names($1) as r', ['sbagliata'])).rejects.toThrow(
      'Password non corretta',
    );
    expect(await as<unknown[]>(stranger, 'select public.party_names($1) as r', [''])).toHaveLength(roster.length);
    expect(await as<unknown[]>(stranger, 'select public.party_names($1) as r', [GM])).toHaveLength(roster.length);
    await expect(join(stranger, GUEST, null, true)).rejects.toThrow('Password non corretta');
    await expect(snap(stranger)).rejects.toThrow('Entra nel congresso');
  });

  it('rejects a name that is already taken or not on the list', async () => {
    await expect(join(await user(), GUEST, 'giulia')).rejects.toThrow('Nome già in uso');
    await expect(join(await user(), GUEST, 'sconosciuto')).rejects.toThrow('Nome non disponibile');
    await expect(join(await user(), GUEST, null)).rejects.toThrow('Scegli il tuo nome');
  });

  it('lets guests vote but never conduct', async () => {
    for (const command of [
      { type: 'start', participantId: 'marco' },
      { type: 'reveal' },
      { type: 'release', participantId: 'marco' },
      {
        type: 'settings',
        settings: {
          maxAwards: 1,
          awardOrder: ['idea', 'ricerca', 'performance', 'qa'],
          spectatorsVote: true,
        },
      },
    ])
      await expect(act(giulia, command)).rejects.toThrow('Solo la regia');
  });
});

describe('ballots', () => {
  it('stores one editable ballot per person, built from the server-side identity', async () => {
    const roundId = await openVoting();
    await act(giulia, { type: 'vote', roundId, ballot: { ...ballot, voterId: 'marco', roundId: 'altro' } });
    await act(giulia, { type: 'vote', roundId, ballot: { ...none, qa: true } });
    const mine = await snap(giulia);
    expect(mine.votes).toHaveLength(1);
    expect(mine.votes[0]).toMatchObject({ voterId: 'giulia', qa: true, idea: false });
    expect(mine.voteCount).toBe(1);
  });

  it('rejects self-stamps, a third stamp and malformed ballots; accepts zero stamps', async () => {
    const roundId = await openVoting();
    await expect(act(paolo, { type: 'vote', roundId, ballot })).rejects.toThrow('tuo fascicolo');
    await expect(act(giulia, { type: 'vote', roundId, ballot: { ...ballot, qa: true } })).rejects.toThrow('Due timbri');
    for (const bad of [{ ...ballot, idea: 'sì' }, { ...ballot, idea: 1 }, { idea: true }, null])
      await expect(act(giulia, { type: 'vote', roundId, ballot: bad })).rejects.toThrow();
    expect((await snap(gm)).voteCount).toBe(0);
    await act(giulia, { type: 'vote', roundId, ballot: none });
    expect((await snap(gm)).voteCount).toBe(1);
  });

  it('rejects ballots before opening, after closing, and for another round', async () => {
    await act(gm, { type: 'start', participantId: 'paolo' });
    const first = (await snap(gm)).activeRoundId!;
    await expect(act(giulia, { type: 'vote', roundId: first, ballot })).rejects.toThrow('chiusa');
    await act(gm, { type: 'phase', phase: 'questions', roundId: first });
    await act(gm, { type: 'phase', phase: 'voting', roundId: first });
    await act(giulia, { type: 'vote', roundId: first, ballot });
    await act(gm, { type: 'phase', phase: 'waiting', roundId: first });
    await expect(act(marco, { type: 'vote', roundId: first, ballot })).rejects.toThrow('chiusa');
    const second = await openVoting('marco');
    await expect(act(giulia, { type: 'vote', roundId: first, ballot })).rejects.toThrow('chiusa');
    await act(giulia, { type: 'vote', roundId: second, ballot });
    expect((await snap(gm)).voteCount).toBe(1);
  });

  it('does not start another presenter while voting is open', async () => {
    await openVoting();
    await expect(act(gm, { type: 'start', participantId: 'marco' })).rejects.toThrow('Concludi il turno');
  });

  it('keeps ballots secret until the reveal, including from the GM', async () => {
    const roundId = await openVoting();
    await act(giulia, { type: 'vote', roundId, ballot });
    expect((await snap(marco)).votes).toEqual([]);
    expect((await snap(gm)).votes).toEqual([]);
    expect((await snap(gm)).voteCount).toBe(1);
    await act(gm, { type: 'phase', phase: 'waiting', roundId });
    await act(gm, { type: 'reveal' });
    expect((await snap(marco)).votes).toHaveLength(1);
  });
});

describe('review', () => {
  async function twoTalks() {
    const first = await openVoting('paolo');
    await act(giulia, { type: 'vote', roundId: first, ballot });
    await act(gm, { type: 'phase', phase: 'waiting', roundId: first });
    const second = await openVoting('marco');
    await act(gm, { type: 'phase', phase: 'waiting', roundId: second });
    return [first, second];
  }
  it('lets everyone move stamps on any finished talk, confirm, and keeps ballots private', async () => {
    const [first, second] = await twoTalks();
    await expect(act(giulia, { type: 'review' })).rejects.toThrow('Solo la regia');
    await act(gm, { type: 'review' });
    await act(giulia, { type: 'vote', roundId: first, ballot: { ...none, qa: true } });
    await act(giulia, { type: 'vote', roundId: second, ballot: none }); // a ballot missed during the evening
    await expect(act(marco, { type: 'vote', roundId: second, ballot })).rejects.toThrow('tuo fascicolo');
    await act(giulia, { type: 'confirmReview' });
    await act(giulia, { type: 'confirmReview' });
    expect((await snap(gm)).reviewed).toEqual(['giulia']);
    expect((await snap(giulia)).votes).toHaveLength(2);
    expect((await snap(marco)).votes).toEqual([]);
    expect((await snap(gm)).votes).toEqual([]);
  });
  it('locks every ballot once the verdict starts; stepping back reopens the review', async () => {
    const [first] = await twoTalks();
    await act(gm, { type: 'review' });
    await act(gm, { type: 'reveal' });
    await expect(act(giulia, { type: 'vote', roundId: first, ballot: none })).rejects.toThrow('chiusa');
    await expect(act(giulia, { type: 'confirmReview' })).rejects.toThrow('chiusa');
    for (let i = 0; i < 21; i++) await act(gm, { type: 'nextAward' });
    await expect(act(gm, { type: 'nextAward' })).rejects.toThrow();
    await act(gm, { type: 'back' });
    expect((await snap(gm)).phase).toBe('review');
    await act(giulia, { type: 'vote', roundId: first, ballot: none });
  });
});

describe('GM as participant, spectators, settings and releasing a name', () => {
  it('lets a GM with a name vote and see only their own ballot', async () => {
    const director = await user();
    expect(await join(director, GM, 'gianluca', true)).toEqual({ role: 'gm', participantId: 'gianluca' });
    const roundId = await openVoting();
    await act(director, { type: 'vote', roundId, ballot });
    await act(giulia, { type: 'vote', roundId, ballot });
    expect((await snap(director)).votes.map((v) => v.voterId)).toEqual(['gianluca']);
  });

  it('lets witnesses and co-speakers vote from their own phone, never on their own talk', async () => {
    const edit = async (id: string, partner: string, partnerName: string) => {
      const p = (
        await as<{ participants: { id: string }[] }>(gm, 'select public.party_snapshot() as r')
      ).participants.find((x) => x.id === id)!;
      await act(gm, { type: 'participant', participant: { ...p, partner, partnerName } });
    };
    await edit('paolo', 'copresenter', 'Camilla');
    await edit('giulia', 'witness', 'Ugo');
    const names = await as<{ id: string; name: string }[]>(giulia, 'select public.party_names($1) as r', ['']);
    expect(names.filter((n) => n.id.endsWith('+')).map((n) => n.name)).toEqual(['Camilla', 'Ugo']);
    const [camilla, ugo] = [await user(), await user()];
    await join(camilla, GUEST, 'paolo+');
    await join(ugo, GUEST, 'giulia+');
    await expect(join(await user(), GUEST, 'marco+')).rejects.toThrow('Nome non disponibile');
    const roundId = await openVoting('paolo');
    await expect(act(camilla, { type: 'vote', roundId, ballot })).rejects.toThrow('tuo fascicolo');
    await act(ugo, { type: 'vote', roundId, ballot });
    expect((await snap(ugo)).votes.map((v) => v.voterId)).toEqual(['giulia+']);
  });

  it('validates award settings and freezes them at the reveal', async () => {
    const order = ['qa', 'idea', 'ricerca', 'performance'];
    for (const settings of [
      { maxAwards: 0, awardOrder: order, spectatorsVote: true },
      { maxAwards: 1.5, awardOrder: order, spectatorsVote: true },
      { maxAwards: null, awardOrder: ['idea', 'idea', 'ricerca', 'qa'], spectatorsVote: true },
      { maxAwards: null, awardOrder: order, spectatorsVote: 'sì' },
    ])
      await expect(act(gm, { type: 'settings', settings })).rejects.toThrow('non valide');
    await act(gm, {
      type: 'settings',
      settings: { maxAwards: 1, awardOrder: order, spectatorsVote: true, extra: 'x' },
    });
    expect((await snap(giulia)).settings).toEqual({ maxAwards: 1, awardOrder: order, spectatorsVote: true });
    const roundId = await openVoting();
    await act(gm, { type: 'phase', phase: 'waiting', roundId });
    await act(gm, { type: 'reveal' });
    await expect(
      act(gm, { type: 'settings', settings: { maxAwards: 2, awardOrder: order, spectatorsVote: true } }),
    ).rejects.toThrow('reveal');
  });

  it('lets the GM release a mistaken name so the right person can enter', async () => {
    expect((await snap(gm)).claimed?.sort()).toEqual(['giulia', 'marco', 'paolo']);
    expect((await snap(giulia)).claimed).toBeUndefined();
    await act(gm, { type: 'release', participantId: 'giulia' });
    expect((await snap(gm)).claimed?.sort()).toEqual(['marco', 'paolo']);
    await expect(snap(giulia)).rejects.toThrow('Entra nel congresso');
    const realGiulia = await user();
    expect(await join(realGiulia, GUEST, 'giulia')).toEqual({ role: 'guest', participantId: 'giulia' });
  });
});

describe('self-registration and own dossier', () => {
  const registerAs = (uid: string, passcode: string, name: string) =>
    as<{ role: string; participantId: string }>(uid, 'select public.party_register($1, $2) as r', [passcode, name]);
  type P = {
    id: string;
    name: string;
    role: string;
    title: string;
    deckUrl: string;
    mode: string | null;
    spectator: boolean;
  };
  const people = async (uid: string) =>
    (await as<{ participants: P[] }>(uid, 'select public.party_snapshot() as r')).participants;

  it('registers anyone with the link: no password, just a name', async () => {
    const anna = await user();
    await expect(registerAs(anna, GUEST, 'A')).rejects.toThrow('nome');
    await expect(registerAs(anna, GUEST, 'x'.repeat(41))).rejects.toThrow('nome');
    const actor = await registerAs(anna, '', '  Anna   Rossi ');
    expect(actor.role).toBe('guest');
    expect(actor.participantId).toMatch(/^anna-rossi-[0-9a-f]{4}$/);
    const me = (await people(anna)).find((p) => p.id === actor.participantId)!;
    expect(me).toMatchObject({ name: 'Anna Rossi', role: '', mode: null, spectator: false });
    // Registering again from the same phone returns the same identity.
    expect(await registerAs(anna, GUEST, 'Altro Nome')).toEqual(actor);
    // Two people with the same name are fine.
    const twin = await registerAs(await user(), GUEST, 'Anna Rossi');
    expect(twin.participantId).not.toBe(actor.participantId);
  });

  it('lets guests edit only their own dossier, with server-side checks', async () => {
    const anna = await user();
    const { participantId: id } = await registerAs(anna, GUEST, 'Anna Rossi');
    const base = {
      id,
      name: 'Anna Rossi',
      role: 'Esperta di scie',
      title: 'LE SCIE',
      deckUrl: '',
      mode: 'slides',
      spectator: false,
    };
    await act(anna, {
      type: 'participant',
      participant: { ...base, deckUrl: 'https://docs.google.com/presentation/d/abc/edit' },
    });
    let me = (await people(anna)).find((p) => p.id === id)!;
    expect(me).toMatchObject({
      role: 'Esperta di scie',
      mode: 'slides',
      deckUrl: 'https://docs.google.com/presentation/d/abc/edit',
    });
    await expect(
      act(anna, { type: 'participant', participant: { ...base, deckUrl: 'https://evil.example/x' } }),
    ).rejects.toThrow('Google Slides');
    await act(anna, {
      type: 'participant',
      participant: { ...base, mode: 'paper', deckUrl: 'https://docs.google.com/presentation/d/abc' },
    });
    me = (await people(anna)).find((p) => p.id === id)!;
    expect(me).toMatchObject({ mode: 'paper', deckUrl: '', spectator: false });
    await expect(
      act(anna, {
        type: 'participant',
        participant: {
          id: 'giulia',
          name: 'Giulia',
          role: 'Hackerata',
          title: '',
          deckUrl: '',
          mode: 'none',
          spectator: true,
        },
      }),
    ).rejects.toThrow('non è tuo');
    await expect(act(anna, { type: 'participant', participant: { ...base, id: 'nuovo-id' } })).rejects.toThrow(
      'non è tuo',
    );
  });

  it('freezes a dossier after its owner presented, but not for the GM', async () => {
    const anna = await user();
    const { participantId: id } = await registerAs(anna, GUEST, 'Anna Rossi');
    const base = { id, name: 'Anna Rossi', role: 'R', title: 'T', deckUrl: '', mode: 'paper', spectator: false };
    await act(anna, { type: 'participant', participant: base });
    await act(gm, { type: 'start', participantId: id });
    await expect(act(anna, { type: 'participant', participant: { ...base, title: 'X' } })).rejects.toThrow(
      'Stai presentando',
    );
    const roundId = (await snap(gm)).activeRoundId!;
    await act(gm, { type: 'phase', phase: 'questions', roundId });
    await act(gm, { type: 'phase', phase: 'voting', roundId });
    await act(gm, { type: 'phase', phase: 'waiting', roundId });
    await expect(act(anna, { type: 'participant', participant: { ...base, title: 'X' } })).rejects.toThrow(
      'già presentato',
    );
    await act(gm, { type: 'participant', participant: { ...base, title: 'Corretto dal GM' } });
    expect((await people(gm)).find((p) => p.id === id)!.title).toBe('Corretto dal GM');
  });

  it('lets the GM step back and reopen the last vote', async () => {
    const anna = await user();
    const { participantId: id } = await registerAs(anna, '', 'Anna Rossi');
    await act(anna, {
      type: 'participant',
      participant: { id, name: 'Anna Rossi', role: 'R', title: '', deckUrl: '', mode: 'paper', spectator: false },
    });
    await act(gm, { type: 'start', participantId: id });
    const roundId = (await snap(gm)).activeRoundId!;
    await act(gm, { type: 'phase', phase: 'questions', roundId });
    await act(gm, { type: 'back' });
    expect((await snap(gm)).phase).toBe('presenting');
    await act(gm, { type: 'phase', phase: 'questions', roundId });
    await act(gm, { type: 'phase', phase: 'voting', roundId });
    await act(gm, { type: 'phase', phase: 'waiting', roundId });
    await act(gm, { type: 'back' });
    expect(await snap(gm)).toMatchObject({ phase: 'voting', activeRoundId: roundId });
    await expect(act(anna, { type: 'back' })).rejects.toThrow('Solo la regia');
  });

  it('keeps the test evening completely apart from the real one', async () => {
    const realBefore = await snap(gm);
    const tester = await user();
    const t = await as<{ participantId: string }>(tester, 'select public.party_register($1, $2, true) as r', [
      '',
      'Camilla',
    ]);
    const testGm = await user();
    expect(await as(testGm, 'select public.party_join($1, null, true, true) as r', [GM])).toEqual({ role: 'gm' });
    await expect(as(await user(), 'select public.party_join($1, null, true, true) as r', ['0000'])).rejects.toThrow(
      'Password non corretta',
    );
    type S = Snap & { participants: { id: string; bot?: boolean }[]; sandbox: boolean };
    const testView = await as<S>(testGm, 'select public.party_snapshot() as r');
    expect(testView.sandbox).toBe(true);
    expect(testView.participants.map((p) => p.id)).toEqual([t.participantId]);
    await act(testGm, { type: 'addBots', n: 8 });
    await act(testGm, { type: 'start', participantId: t.participantId });
    const rid = (await as<S>(testGm, 'select public.party_snapshot() as r')).activeRoundId!;
    await act(testGm, { type: 'phase', phase: 'questions', roundId: rid });
    await act(testGm, { type: 'phase', phase: 'voting', roundId: rid });
    await act(testGm, { type: 'botVotes' });
    expect((await as<S>(testGm, 'select public.party_snapshot() as r')).voteCount).toBe(8);
    // Through the review to the reveal: every screen then receives the ballots, so the podiums fill up.
    await act(testGm, { type: 'phase', phase: 'waiting', roundId: rid });
    await act(testGm, { type: 'review' });
    await act(testGm, { type: 'botVotes' });
    await act(testGm, { type: 'reveal' });
    const revealed = await as<S>(testGm, 'select public.party_snapshot() as r');
    expect(revealed.phase).toBe('results');
    expect(revealed.votes.length).toBe(8);
    // Each tester draws its own stamps (one shared draw left every podium empty or identical).
    const kinds = new Set(revealed.votes.map((v) => JSON.stringify(v, ['idea', 'ricerca', 'performance', 'qa'])));
    expect(kinds.size).toBeGreaterThan(1);
    await act(testGm, { type: 'reset', everyone: true });
    // The real evening did not move, and its guests are still linked.
    const realAfter = await as<S>(gm, 'select public.party_snapshot() as r');
    expect(realAfter.sandbox).toBe(false);
    expect(realAfter.participants.length).toBe((realBefore as S).participants.length);
    expect(realAfter.participants.some((p) => p.id === t.participantId || p.bot)).toBe(false);
    expect(await as(giulia, 'select public.party_actor() as r')).toEqual({ role: 'guest', participantId: 'giulia' });
    await expect(act(gm, { type: 'addBots', n: 2 })).rejects.toThrow('solo nella serata di prova');
  });

  it('queues slide commands from the presenter (or the GM) for the helper, readable only by the GM', async () => {
    const anna = await user();
    const { participantId: id } = await registerAs(anna, '', 'Anna Rossi');
    const deck = 'https://docs.google.com/presentation/d/abcdefghijklmnop/edit';
    await act(anna, {
      type: 'participant',
      participant: { id, name: 'Anna Rossi', role: 'R', title: '', deckUrl: deck, mode: 'slides', spectator: false },
    });
    await expect(act(anna, { type: 'slide', dir: 'next' })).rejects.toThrow('durante la presentazione');
    await act(gm, { type: 'start', participantId: id });
    await act(anna, { type: 'slide', dir: 'next' });
    await act(gm, { type: 'slide', dir: 'prev' });
    await expect(act(giulia, { type: 'slide', dir: 'next' })).rejects.toThrow('Solo chi presenta');
    const roundId = (await snap(gm)).activeRoundId!;
    await act(gm, { type: 'phase', phase: 'questions', roundId });
    type Row = { seq: number; log: { cmd: string; deck: string }[] };
    const row = (uid: string) => as<Row>(uid, 'select to_jsonb(t) as r from public.party_slide t where id = true');
    const seen = await row(gm);
    expect(seen.log.slice(-4).map((e) => e.cmd)).toEqual(['open', 'next', 'prev', 'close']);
    expect(seen.log.slice(-4)[0].deck).toBe(deck);
    expect(await row(anna)).toBeUndefined();
  });

  it('keeps admission in the GM’s hands', async () => {
    const anna = await user();
    const { participantId: id } = await registerAs(anna, '', 'Anna Rossi');
    const base = { id, name: 'Anna Rossi', role: 'R', title: '', deckUrl: '', mode: 'paper', spectator: false };
    const mine = async () => (await people(gm)).find((p) => p.id === id) as unknown as { admission: string };
    expect((await mine()).admission).toBe('pending');
    await act(anna, { type: 'participant', participant: { ...base, admission: 'admitted' } });
    expect((await mine()).admission).toBe('pending');
    await act(gm, { type: 'participant', participant: { ...base, admission: 'admitted' } });
    await act(anna, { type: 'participant', participant: { ...base, role: 'Altro' } });
    expect((await mine()).admission).toBe('admitted');
  });

  it('lets only the GM remove a person, with their turns, votes and phone link', async () => {
    const anna = await user();
    const { participantId: id } = await registerAs(anna, GUEST, 'Anna Rossi');
    const base = { id, name: 'Anna Rossi', role: 'R', title: '', deckUrl: '', mode: 'paper', spectator: false };
    await act(anna, { type: 'participant', participant: base });
    await act(gm, { type: 'start', participantId: id });
    const roundId = (await snap(gm)).activeRoundId!;
    await expect(act(gm, { type: 'remove', participantId: id })).rejects.toThrow('Sta presentando');
    await act(gm, { type: 'phase', phase: 'questions', roundId });
    await act(gm, { type: 'phase', phase: 'voting', roundId });
    await act(giulia, {
      type: 'vote',
      roundId,
      ballot,
    });
    await act(gm, { type: 'phase', phase: 'waiting', roundId });
    await expect(act(giulia, { type: 'remove', participantId: id })).rejects.toThrow('Solo la regia');
    await act(gm, { type: 'remove', participantId: id });
    const after = await snap(gm);
    expect(after.participants.some((p) => p.id === id)).toBe(false);
    expect(after.rounds.some((r) => r.id === roundId)).toBe(false);
    expect((await snap(giulia)).votes.some((v) => v.roundId === roundId)).toBe(false);
    expect(await as(anna, 'select public.party_actor() as r')).toBeNull();
  });
});

describe('secrets on the server', () => {
  it('hides other people’s talk details from guests until they present, but not names or readiness', async () => {
    const ugo = await user();
    const { participantId: id } = await as<{ participantId: string }>(
      ugo,
      'select public.party_register($1, $2) as r',
      [GUEST, 'Ugo'],
    );
    await act(ugo, {
      type: 'participant',
      participant: {
        id,
        name: 'Ugo',
        role: 'Rettiliano onorario',
        title: 'SEGRETO',
        deckUrl: '',
        mode: 'paper',
        spectator: false,
        plusOne: true,
      },
    });
    type Seen = { id: string; name: string; title: string; role: string; masked?: boolean; ready?: boolean };
    const seenBy = async (uid: string) =>
      (await as<{ participants: Seen[] }>(uid, 'select public.party_snapshot() as r')).participants.find(
        (p) => p.id === id,
      )!;
    expect(await seenBy(giulia)).toMatchObject({
      name: 'Ugo',
      title: '',
      role: 'Rettiliano onorario',
      masked: true,
      ready: true,
      plusOne: true,
    });
    expect(await seenBy(gm)).toMatchObject({ name: 'Ugo', title: 'SEGRETO', role: 'Rettiliano onorario' });
    expect(await seenBy(ugo)).toMatchObject({ title: 'SEGRETO' });
    await act(gm, { type: 'start', participantId: id });
    expect(await seenBy(giulia)).toMatchObject({ name: 'Ugo', title: 'SEGRETO' });
  });

  it('accepts the 4-digit GM PIN only as typed', async () => {
    await expect(join(await user(), '1234', null, true)).rejects.toThrow('Password non corretta');
    expect(await join(await user(), ' 9137 ', null, true)).toEqual({ role: 'gm' });
  });
});
