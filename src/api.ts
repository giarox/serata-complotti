import { createClient } from '@supabase/supabase-js';
import {
  applyAction,
  initialState,
  makeId,
  normalize,
  snapshot,
  voters,
  type State,
  type Action,
  type Actor,
} from './domain';
/** A name to pick when entering: a request, or its witness / co-speaker (companionOf = whose). */
export type Entrant = { id: string; name: string; companionOf?: string };
/** Demo-mode check, same normalisation as the database: guests' word ignores case and spaces. */
const demoOk = (code: string, gm: boolean) =>
  // Local demo only: a fake PIN, never the real one. Guests need nothing.
  gm ? code.trim() === DEMO_PIN : true;
export const DEMO_PIN = '0000';
const env = (import.meta as unknown as { env: Record<string, string> }).env;
export const live = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY);
/** The test evening opens with ?prova: separate data, separate session, never visible to real guests. */
export const sandbox = typeof location !== 'undefined' && new URLSearchParams(location.search).has('prova');
const client = live
  ? createClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      sandbox ? { auth: { storageKey: 'sb-complotti-prova' } } : undefined,
    )
  : null;
const key = sandbox ? 'complotti-demo-prova' : 'complotti-demo-v1';
const actorKey = sandbox ? 'party-actor-prova' : 'party-actor';
/** Link to the test evening, from the current address. */
export const testLink = () => location.origin + location.pathname + '?prova';
export const readDemo = (): State => {
  try {
    const s = JSON.parse(localStorage.getItem(key) || 'null');
    return s ? normalize(s) : initialState();
  } catch {
    return initialState();
  }
};
function writeDemo(s: State) {
  localStorage.setItem(key, JSON.stringify(s));
  window.dispatchEvent(new Event('party-update'));
}
export async function getState(actor: Actor): Promise<State> {
  if (!client) return snapshot(readDemo(), actor);
  const { data, error } = await client.rpc('party_snapshot');
  if (error) throw new Error(error.message);
  return normalize(data);
}
export async function action(actor: Actor, command: Action) {
  if (!client) {
    // Serialize writes from tabs in the same browser. Demo is not a security boundary.
    await navigator.locks.request('complotti-demo', () => writeDemo(applyAction(readDemo(), actor, command)));
  } else {
    const { error } = await client.rpc('party_action', { command });
    if (error) throw new Error(error.message);
  }
}
/** participantId may be empty for a GM who only conducts. */
export async function login(code: string, participantId: string, gm: boolean): Promise<Actor> {
  if (!client) {
    if (!demoOk(code, gm)) throw new Error('Password non corretta.');
    if (gm) return participantId ? { role: 'gm', participantId } : { role: 'gm' };
    return { role: 'guest', participantId };
  }
  const { data: session } = await client.auth.getSession();
  if (!session.session) {
    const { error } = await client.auth.signInAnonymously();
    if (error) throw new Error(error.message);
  }
  const { data, error } = await client.rpc('party_join', {
    passcode: code,
    person_id: participantId || null,
    as_gm: gm,
    sandbox,
  });
  if (error) throw new Error(error.message);
  return data;
}
/** Self-registration from the invite: event password + first and last name. */
export async function register(code: string, fullName: string): Promise<Actor> {
  if (!client) {
    if (!demoOk(code, false)) throw new Error('Password non corretta.');
    const id = makeId(fullName);
    const guest: Actor = { role: 'guest' };
    await navigator.locks.request('complotti-demo', () =>
      writeDemo(applyAction(readDemo(), guest, { type: 'register', id, name: fullName })),
    );
    return { role: 'guest', participantId: id };
  }
  await entryList();
  const { data, error } = await client.rpc('party_register', { passcode: code, full_name: fullName, sandbox });
  if (error) throw new Error(error.message);
  return data;
}
export async function entryList(): Promise<State['participants']> {
  if (!client) return readDemo().participants;
  const { data: session } = await client.auth.getSession();
  if (!session.session) {
    const { error } = await client.auth.signInAnonymously();
    if (error) throw new Error(error.message);
  }
  return []; // Names are fetched after validating the event password.
}
/** Both the event password and the GM password unlock the list of names. */
export async function unlockNames(code: string, gm = false): Promise<Entrant[]> {
  if (!client) {
    if (!demoOk(code, gm)) throw new Error('Password non corretta.');
    return voters(readDemo()).map((v) =>
      v.companion ? { id: v.id, name: v.name, companionOf: v.owner.name } : { id: v.id, name: v.name },
    );
  }
  await entryList();
  const { data, error } = await client.rpc('party_names', { passcode: code, sandbox });
  if (error) throw new Error(error.message);
  return data;
}
export async function restoreActor(): Promise<Actor | null> {
  if (!client) {
    try {
      return JSON.parse(sessionStorage.getItem(actorKey) || 'null');
    } catch {
      return null;
    }
  }
  const { data: session } = await client.auth.getSession();
  if (!session.session) return null;
  const { data, error } = await client.rpc('party_actor');
  if (error) return null;
  return data;
}
export function watch(update: () => void) {
  window.addEventListener('storage', update);
  window.addEventListener('party-update', update);
  window.addEventListener('online', update);
  window.addEventListener('focus', update);
  const visibility = () => {
    if (!document.hidden) update();
  };
  document.addEventListener('visibilitychange', visibility);
  const channel = client
    ?.channel('party-state')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'party_signal' }, update)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') update();
    });
  // Snapshot refresh also recovers a missed notification; no votes or secrets in the signal table.
  const interval = window.setInterval(() => {
    if (client && !document.hidden) update();
  }, 10000);
  return () => {
    window.removeEventListener('storage', update);
    window.removeEventListener('party-update', update);
    window.removeEventListener('online', update);
    window.removeEventListener('focus', update);
    document.removeEventListener('visibilitychange', visibility);
    clearInterval(interval);
    if (channel) void client?.removeChannel(channel);
  };
}
export async function leave() {
  sessionStorage.removeItem(actorKey);
  if (client) await client.auth.signOut();
}
export function saveActor(actor: Actor) {
  sessionStorage.setItem(actorKey, JSON.stringify(actor));
}
export function resetDemo() {
  if (!live) writeDemo(initialState());
}
export function exportData() {
  if (live) throw new Error('Export disponibile dopo il reveal tramite la vista risultati.');
  return readDemo();
}
