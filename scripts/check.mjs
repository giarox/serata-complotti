// Fast, targeted checks: only what the current changes could have broken.
//   npm run check          → checks for uncommitted changes (or the last commit if clean)
//   npm run check:full     → everything, including the browser journeys (before the event)
import { execSync } from 'node:child_process';

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const run = (label, cmd) => {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { stdio: 'inherit' });
};
let files = execSync('git status --porcelain -uall', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .map((l) => l.slice(3).replace(/^.* -> /, ''));
if (!files.length) files = sh('git diff --name-only HEAD~1 HEAD').split('\n').filter(Boolean);
const any = (re) => files.some((f) => re.test(f));

console.log('Changed:', files.join(', ') || 'nothing');
const plan = [];
if (any(/\.(ts|tsx)$/)) plan.push(['Typecheck', 'npx tsc -b --noEmit']);
if (any(/^src\/(domain|api|event)\.ts$|^tests\/[^/]+\.test\.ts$/))
  plan.push(['Rules tests', 'npx vitest run tests/domain.test.ts tests/awards.test.ts tests/dossier.test.ts']);
if (any(/^supabase\/|^tests\/db\//)) plan.push(['Database tests', 'npx vitest run tests/db']);
if (!plan.length) console.log('\nOnly copy/style/docs changed: nothing to test. Ship it.');
for (const [label, cmd] of plan) run(label, cmd);
console.log('\n✓ Ready to push.');
