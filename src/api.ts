import { createClient } from '@supabase/supabase-js';
import { applyAction, initialState, makeId, normalize, snapshot, type State, type Action, type Actor } from './domain';
/** Demo-mode check, same normalisation as the database: guests' word ignores case and spaces. */
const demoOk = (code: string, gm: boolean) =>
  gm ? code.trim() === '2480' : code.replace(/\s+/g, '').toUpperCase() === 'NONCIELODICONO';
const env = (import.meta as unknown as { env: Record<string, string> }).env;
export const live = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY);
const client = live ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY) : null;
const key = 'complotti-demo-v1';
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
  const { data, error } = await client.rpc('party_register', { passcode: code, full_name: fullName });
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
export async function unlockNames(code: string, gm = false): Promise<State['participants']> {
  if (!client) {
    if (!demoOk(code, gm)) throw new Error('Password non corretta.');
    return readDemo().participants;
  }
  await entryList();
  const { data, error } = await client.rpc('party_names', { passcode: code });
  if (error) throw new Error(error.message);
  return data;
}
export async function restoreActor(): Promise<Actor | null> {
  if (!client) {
    try {
      return JSON.parse(sessionStorage.getItem('party-actor') || 'null');
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
  sessionStorage.removeItem('party-actor');
  if (client) await client.auth.signOut();
}
export function saveActor(actor: Actor) {
  sessionStorage.setItem('party-actor', JSON.stringify(actor));
}
export function resetDemo() {
  if (!live) writeDemo(initialState());
}
export function exportData() {
  if (live) throw new Error('Export disponibile dopo il reveal tramite la vista risultati.');
  return readDemo();
}
