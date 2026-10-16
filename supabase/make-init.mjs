// Usage: npm run make-init            → first setup, or change passwords keeping names/votes
//        npm run make-init -- --reset → start a clean event (deletes rounds and votes!)
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { buildInitSql, hashPasswords, validateRoster } from './init-sql.mjs';

const here = new URL('.', import.meta.url);
const reset = process.argv.includes('--reset');
const roster = validateRoster(JSON.parse(await readFile(new URL('roster.json', here), 'utf8')));

const rl = createInterface({ input: stdin, terminal: false });
const lines = rl[Symbol.asyncIterator]();
const ask = async (prompt) => {
  stdout.write(prompt);
  const { value } = await lines.next();
  return value ?? '';
};
console.log(
  `\nSerata Complotti — ${roster.length} nomi letti da supabase/roster.json${reset ? ' (RESET COMPLETO)' : ''}\n`,
);
const guest = (await ask('Password per gli ospiti (da condividere): ')).trim();
const gm = (await ask('Password della regia (solo per te, diversa): ')).trim();
rl.close();
if (guest.length < 6 || gm.length < 8) throw new Error('Usa almeno 6 caratteri per gli ospiti e 8 per la regia.');
if (guest === gm) throw new Error('Le due password devono essere diverse.');

const [guestHash, gmHash] = await hashPasswords(guest, gm);
const out = new URL('init.PRIVATE.sql', here);
await writeFile(out, buildInitSql({ guestHash, gmHash, roster, reset }), { mode: 0o600 });
console.log(`\nFatto: supabase/init.PRIVATE.sql
1. Supabase → SQL Editor → incolla il contenuto del file → Run.
2. Poi cancella il file. Le password non sono salvate da nessuna parte: annotale tu.\n`);
