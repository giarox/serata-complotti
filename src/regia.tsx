import React, { useState } from 'react';
import { LockKeyholeOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { modes, snapshot, type Admission, type Participant, type State } from './domain';
import { DossierHome } from './dossier';
import * as api from './api';
import { Button } from './ui';

/** How many people a request brings: the speaker plus their witness or co-speaker. */
export const headcount = (p: Participant) => 1 + (p.partner || p.plusOne ? 1 : 0);
const admOf = (p: Participant): Admission => p.admission ?? 'pending';
const sum = (list: Participant[]) => list.reduce((n, p) => n + headcount(p), 0);
const people = (n: number) => (n === 1 ? '1 persona' : `${n} persone`);

/** The numbers the GM needs before deciding: requests, people, and what admitting everyone would mean. */
export function Overview({ s }: { s: State }) {
  const all = s.participants,
    by = (a: Admission) => all.filter((p) => admOf(p) === a);
  const pending = by('pending'),
    admitted = by('admitted'),
    reserve = by('reserve');
  const cells: [string, Participant[], string][] = [
    ['Richieste', all, 'all'],
    ['Da valutare', pending, 'pending'],
    ['Ammessi', admitted, 'admitted'],
    ['Riserva', reserve, 'reserve'],
  ];
  return (
    <section className="panel overview">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Effettivi</p>
          <h2>Chi potrebbe esserci</h2>
        </div>
      </div>
      <dl className="overview-grid">
        {cells.map(([label, list, key]) => (
          <div key={key} className={'ov ' + key}>
            <dt>{label}</dt>
            <dd>
              <strong>{list.length}</strong>
              <span>{people(sum(list))}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="overview-note">
        In sala ora: <strong>{people(sum(admitted))}</strong>
        {pending.length > 0 && (
          <>
            {' '}
            · ammettendo tutte le richieste da valutare: <strong>{people(sum(admitted) + sum(pending))}</strong>
          </>
        )}
        . Accompagnatori richiesti: {all.filter((p) => p.partner === 'witness').length} testimoni e{' '}
        {all.filter((p) => p.partner === 'copresenter').length} co-relatori.
      </p>
    </section>
  );
}

const admissionChoices: [Admission, string][] = [
  ['pending', 'Da valutare'],
  ['admitted', 'Ammesso'],
  ['reserve', 'Riserva'],
];

/** Every request as a card, filterable by status, with one-tap decisions. Built for the phone first. */
export function RequestsBoard({
  s,
  busy,
  onAdmit,
  onEdit,
  onRemove,
  onRelease,
  onAdd,
  isPresenting,
}: {
  s: State;
  busy: boolean;
  onAdmit: (p: Participant, a: Admission) => void;
  onEdit: (p: Participant) => void;
  onRemove: (p: Participant) => void;
  onRelease: (p: Participant) => void;
  onAdd: () => void;
  isPresenting: (p: Participant) => boolean;
}) {
  const count = (a: Admission | 'all') => s.participants.filter((p) => a === 'all' || admOf(p) === a).length;
  const [filter, setFilter] = useState<Admission | 'all'>(() => (count('pending') > 0 ? 'pending' : 'all'));
  const list = s.participants.filter((p) => filter === 'all' || admOf(p) === filter);
  const tabs: [Admission | 'all', string][] = [
    ['pending', 'Da valutare'],
    ['admitted', 'Ammessi'],
    ['reserve', 'Riserva'],
    ['all', 'Tutte'],
  ];
  return (
    <section className="panel board">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Fascicoli</p>
          <h2>Le richieste</h2>
        </div>
        <Button secondary disabled={s.phase !== 'waiting'} onClick={onAdd}>
          <Plus size={17} /> Aggiungi
        </Button>
      </div>
      <div className="board-tabs" role="tablist" aria-label="Filtra le richieste">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? 'on' : ''}
            onClick={() => setFilter(key)}
          >
            {label} <span>{count(key)}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="board-empty">Nessuna richiesta qui.</p>
      ) : (
        <ul className="board-list">
          {list.map((p) => {
            const adm = admOf(p),
              mode = modes.find((m) => m.key === p.mode)?.label,
              locked = isPresenting(p);
            return (
              <li key={p.id} className={'req-card ' + adm}>
                <div className="req-head">
                  <strong className="req-name">{p.name}</strong>
                  <span className="req-count">{headcount(p) === 1 ? '1 persona' : '2 persone'}</span>
                </div>
                <p className="req-role">{p.role ? `«${p.role}»` : 'Qualifica non indicata'}</p>
                <ul className="req-facts">
                  {p.bot && <li>Tester finto</li>}
                  <li>{mode ?? 'Modalità non scelta'}</li>
                  {p.mode === 'slides' && (
                    <li className={p.deckUrl ? '' : 'warn'}>{p.deckUrl ? 'Link slide ok' : 'Link slide mancante'}</li>
                  )}
                  {p.partner === 'witness' && <li>+ testimone: {p.partnerName || '?'}</li>}
                  {p.partner === 'copresenter' && <li>+ co-relatore: {p.partnerName || '?'}</li>}
                </ul>
                <div className="req-decide" role="radiogroup" aria-label={'Ammissione di ' + p.name}>
                  {admissionChoices.map(([a, label]) => (
                    <button
                      key={a}
                      role="radio"
                      aria-checked={adm === a}
                      className={'decide ' + a + (adm === a ? ' on' : '')}
                      disabled={busy || adm === a}
                      onClick={() => onAdmit(p, a)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="req-tools">
                  <button
                    className="tool"
                    aria-label={'Modifica ' + p.name}
                    disabled={locked || s.phase === 'results'}
                    onClick={() => onEdit(p)}
                  >
                    <Pencil size={15} /> Modifica
                  </button>
                  {api.live && s.claimed?.includes(p.id) && (
                    <button className="tool" aria-label={'Libera ' + p.name} onClick={() => onRelease(p)}>
                      <LockKeyholeOpen size={15} /> Libera telefono
                    </button>
                  )}
                  <button
                    className="tool danger"
                    aria-label={'Elimina ' + p.name}
                    disabled={locked}
                    onClick={() => onRemove(p)}
                  >
                    <Trash2 size={15} /> Elimina
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Test evening: from the real regia, a way in; inside the test, fake testers on demand. */
export function TestLab({
  s,
  busy,
  perform,
}: {
  s: State;
  busy: boolean;
  perform: (a: import('./domain').Action) => Promise<boolean>;
}) {
  const [copied, setCopied] = useState(false);
  const link = api.testLink();
  if (!api.sandbox)
    return (
      <section className="panel testlab">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Serata di prova</p>
            <h2>Prova tutto senza toccare niente</h2>
          </div>
        </div>
        <p className="footnote">
          Una serata parallela, con iscritti, turni e voti suoi. Gli iscritti veri non la vedono e questa serata non
          cambia. Entri in regia con lo stesso PIN; manda il link a chi vuoi far provare come relatore.
        </p>
        <div className="result-actions">
          <a className="button" href={link} target="_blank" rel="noreferrer">
            Apri la serata di prova
          </a>
          <Button secondary onClick={() => void navigator.clipboard?.writeText(link).then(() => setCopied(true))}>
            {copied ? 'Link copiato' : 'Copia il link per i tester'}
          </Button>
        </div>
      </section>
    );
  const bots = s.participants.filter((p) => p.bot).length;
  return (
    <section className="panel testlab">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Serata di prova</p>
          <h2>Tester finti</h2>
        </div>
      </div>
      <p className="footnote">
        {bots ? `${bots} tester finti in sala, già ammessi.` : 'Nessun tester finto, per ora.'} Danno 0–2 timbri a caso
        quando glielo dici tu: durante la votazione, o in revisione (dove confermano anche). Li puoi far presentare:
        scegli il loro nome come un relatore qualsiasi.
      </p>
      <div className="result-actions">
        <Button secondary disabled={busy} onClick={() => void perform({ type: 'addBots', n: 4 })}>
          Aggiungi 4 tester finti
        </Button>
        <Button
          secondary
          disabled={busy || (s.phase !== 'voting' && s.phase !== 'review')}
          onClick={() => void perform({ type: 'botVotes' })}
        >
          {s.phase === 'review' ? 'Fai rivedere i tester' : 'Fai timbrare i tester'}
        </Button>
        <a className="button secondary" href={location.origin + location.pathname}>
          Torna alla serata vera
        </a>
      </div>
    </section>
  );
}

/** Phone remote for the slides: big Next, smaller Back. The helper on the projector Mac does the rest. */
export function SlideRemote({ actor }: { actor: import('./domain').Actor }) {
  const [error, setError] = useState(''),
    [last, setLast] = useState<'next' | 'prev' | null>(null);
  async function send(dir: 'next' | 'prev') {
    setError('');
    setLast(dir);
    try {
      await api.action(actor, { type: 'slide', dir });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      window.setTimeout(() => setLast(null), 250);
    }
  }
  return (
    <div className="slide-remote">
      <button
        type="button"
        className={'remote-btn prev' + (last === 'prev' ? ' hit' : '')}
        onClick={() => void send('prev')}
      >
        ← Indietro
      </button>
      <button
        type="button"
        className={'remote-btn next' + (last === 'next' ? ' hit' : '')}
        onClick={() => void send('next')}
      >
        Avanti →
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Read-only mirror of a guest's confirmation page, built with the same masking the database applies. */
export function GuestMirror({ s }: { s: State }) {
  const [open, setOpen] = useState(false),
    [id, setId] = useState('');
  const who = s.participants.find((p) => p.id === id) ?? s.participants[0];
  const seen = who ? snapshot(s, { role: 'guest', participantId: who.id }) : null;
  return (
    <section className="panel mirror">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Vista ospite</p>
          <h2>Cosa vede chi ha fatto richiesta</h2>
        </div>
        <Button secondary onClick={() => setOpen(!open)} disabled={!who}>
          {open ? 'Nascondi' : 'Mostra'}
        </Button>
      </div>
      <p className="footnote">
        {who
          ? 'Degli altri vedono nome, qualifica, esito, modalità e accompagnatore. Resta nascosto solo il link delle slide.'
          : 'Nessuna richiesta ancora: la vista comparirà con il primo iscritto.'}
      </p>
      {open && who && seen && (
        <>
          <label className="mirror-pick">
            Guarda come
            <select value={who.id} onChange={(e) => setId(e.target.value)}>
              {s.participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mirror-frame" inert>
            <DossierHome
              key={who.id}
              s={seen}
              actor={{ role: 'guest', participantId: who.id }}
              busy
              perform={async () => false}
            />
          </div>
          <p className="footnote">Solo da guardare: qui non si modifica niente.</p>
        </>
      )}
    </section>
  );
}

/** The Google Slides deck id, if the link is a real Slides link (same rule as the helper). */
const deckId = (url: string | undefined) =>
  /^https:\/\/docs\.google\.com\/presentation\/d\/([A-Za-z0-9_-]{10,})/.exec((url ?? '').trim())?.[1] ?? null;
/**
 * Asks Google for a small picture of the deck without ever showing it: an image that loads means the deck
 * opens for anyone with the link and has at least one slide. A private deck answers with a sign-in page,
 * which is not an image, so it fails. Nothing is added to the page: no spoilers.
 */
function probeDeck(id: string): Promise<boolean> {
  const tryImage = (src: string) =>
    new Promise<boolean>((resolve) => {
      const img = new Image();
      const timer = window.setTimeout(() => resolve(false), 15000);
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        window.clearTimeout(timer);
        resolve(img.naturalWidth > 0);
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        resolve(false);
      };
      img.src = src;
    });
  const bust = Date.now();
  return tryImage(`https://docs.google.com/presentation/d/${id}/export/png?cb=${bust}`).then(
    (ok) => ok || tryImage(`https://drive.google.com/thumbnail?sz=w200&id=${id}&cb=${bust}`),
  );
}
type DeckStatus = 'checking' | 'ok' | 'fail' | 'missing' | 'invalid';
const deckCopy: Record<DeckStatus, string> = {
  checking: 'Controllo in corso…',
  ok: 'Si apre',
  fail: 'Non si apre: link non condiviso con «Chiunque abbia il link», presentazione vuota o cancellata',
  missing: 'Manca il link',
  invalid: 'Non è un link di Google Slides',
};
/** The GM checks every Slides link before the evening, without seeing a single slide. */
export function SlidesCheck({ s }: { s: State }) {
  const decks = s.participants.filter((p) => p.mode === 'slides' && (!p.bot || api.sandbox));
  const [status, setStatus] = useState<Record<string, DeckStatus>>({});
  const [running, setRunning] = useState(false);
  async function run() {
    setRunning(true);
    const next: Record<string, DeckStatus> = {};
    for (const p of decks) next[p.id] = !p.deckUrl?.trim() ? 'missing' : deckId(p.deckUrl) ? 'checking' : 'invalid';
    setStatus({ ...next });
    await Promise.all(
      decks.map(async (p) => {
        const id = deckId(p.deckUrl);
        if (!id) return;
        const ok = await probeDeck(id);
        setStatus((st) => ({ ...st, [p.id]: ok ? 'ok' : 'fail' }));
      }),
    );
    setRunning(false);
  }
  return (
    <section className="panel slides-check">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Prima della serata</p>
          <h2>Controllo delle slide</h2>
        </div>
      </div>
      <p className="footnote">
        Verifica che ogni presentazione si apra per chiunque abbia il link. Nessuna slide viene mostrata: niente
        spoiler.
      </p>
      {decks.length === 0 ? (
        <p className="footnote">Nessuno ha scelto di presentare con le slide, per ora.</p>
      ) : (
        <>
          <ul className="slides-check-list">
            {decks.map((p) => {
              const st = status[p.id];
              return (
                <li key={p.id} className={st ? 'st-' + st : ''}>
                  <strong>{p.name}</strong>
                  <span>{st ? deckCopy[st] : p.deckUrl ? 'Da controllare' : deckCopy.missing}</span>
                </li>
              );
            })}
          </ul>
          <div className="result-actions">
            <Button disabled={running} onClick={() => void run()}>
              {running ? 'Controllo in corso…' : 'Controlla le slide'}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
