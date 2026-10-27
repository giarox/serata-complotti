#!/usr/bin/env node
// Serata Complotti — Slides helper for the projector Mac.
//
// What it does: when a turn with slides starts, it opens that Google Slides deck in presentation
// mode as a new tab of the front Chrome window (the full-screen projector view). When the presenter
// taps Avanti/Indietro on their phone, it presses → / ← in Chrome, so animations and videos behave
// exactly as in Slides. When the turn moves to question time, it leaves the presentation and closes
// the tab, so the projector view is back.
//
// Run it on the Mac connected to the projector:
//   npm run helper            (the real evening)
//   npm run helper -- --prova (the test evening)
// It asks for the GM PIN (or reads it from SC_PIN). macOS will ask to allow Terminal to control
// "System Events" and to use Accessibility: say yes (System Settings → Privacy & Security).
//
// Commands come from the database; only the evening's GM can read them and only the current
// presenter (or the GM) can send them.
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, env, exit, platform } from 'node:process';

// Public by design (same values the website uses).
const URL = env.VITE_SUPABASE_URL || 'https://jjftlmjaxzbyadpwtnrf.supabase.co';
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_krLefCQTesVIjEN6JI_xNA_p5DRUiua';
const sandbox = argv.includes('--prova');
const dryRun = argv.includes('--dry-run'); // log commands without touching the keyboard
const POLL_MS = 300;

const say = (msg) => console.log(`[${new Date().toLocaleTimeString('it-IT')}] ${msg}`);
const run = (cmd, args) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, (err, out) => (err ? reject(new Error(err.message.split('\n')[0])) : resolve(out))),
  );
const osa = (script) => (dryRun ? Promise.resolve() : run('osascript', ['-e', script]));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Only real Google Slides links; we open the /present view of that deck id. */
function presentUrl(deck) {
  const m = /^https:\/\/docs\.google\.com\/presentation\/d\/([A-Za-z0-9_-]{10,})/.exec(String(deck || '').trim());
  return m ? `https://docs.google.com/presentation/d/${m[1]}/present` : null;
}

let deckOpen = false;
const key = (code) =>
  osa(`tell application "Google Chrome" to activate
delay 0.05
tell application "System Events" to key code ${code}`);

async function handle(entry) {
  const { cmd, deck } = entry;
  if (cmd === 'open') {
    const url = presentUrl(deck);
    if (!url) return say(`Link non valido, salto: ${deck}`);
    if (deckOpen) await close();
    say(`Apro le slide: ${url}`);
    if (!dryRun) await run('open', ['-a', 'Google Chrome', url]);
    deckOpen = true;
  } else if (cmd === 'next') {
    say('→ Avanti');
    await key(124);
  } else if (cmd === 'prev') {
    say('← Indietro');
    await key(123);
  } else if (cmd === 'close') {
    await close();
  }
}
async function close() {
  if (!deckOpen) return;
  say('Chiudo le slide e torno alla vista proiettore');
  await key(53); // Esc: leave presentation mode
  await pause(400);
  await osa(`tell application "Google Chrome" to close active tab of front window`);
  deckOpen = false;
}

async function main() {
  if (platform !== 'darwin' && !dryRun) {
    console.error('Questo helper funziona su macOS (usa AppleScript). Prova con --dry-run per vedere i comandi.');
    exit(1);
  }
  const pin =
    env.SC_PIN ||
    (await (async () => {
      const rl = createInterface({ input: stdin, output: stdout });
      const answer = await rl.question(`PIN della regia${sandbox ? ' (serata di prova)' : ''}: `);
      rl.close();
      return answer.trim();
    })());
  const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: true } });
  const { error: authErr } = await db.auth.signInAnonymously();
  if (authErr) throw new Error('Accesso anonimo non riuscito: ' + authErr.message);
  const { error: joinErr } = await db.rpc('party_join', { passcode: pin, person_id: null, as_gm: true, sandbox });
  if (joinErr) throw new Error(joinErr.message);
  say(`Collegato come regia (${sandbox ? 'serata di prova' : 'serata vera'}). In ascolto dei comandi…`);
  say('Tieni la vista proiettore aperta in Chrome, a schermo intero, in primo piano.');

  const id = !sandbox;
  const first = await db.from('party_slide').select('seq').eq('id', id).maybeSingle();
  if (first.error) throw new Error(first.error.message);
  let last = first.data?.seq ?? 0;
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const { data, error } = await db.from('party_slide').select('seq,log').eq('id', id).maybeSingle();
      if (error) throw error;
      if (data && data.seq > last) {
        const todo = (data.log || []).filter((e) => e.seq > last).sort((a, b) => a.seq - b.seq);
        for (const e of todo) {
          try {
            await handle(e);
          } catch (err) {
            say(`Problema con "${e.cmd}": ${err.message}. Controlla i permessi di Accessibilità per il Terminale.`);
          }
          last = e.seq;
        }
        last = data.seq;
      }
    } catch (err) {
      say(`Connessione: ${err.message || err}`);
    } finally {
      busy = false;
    }
  }, POLL_MS);
}

main().catch((err) => {
  console.error('Errore: ' + err.message);
  exit(1);
});
