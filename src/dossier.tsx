import React, { useEffect, useState } from 'react';
import { Check, Copy, Dices, MessageCircle } from 'lucide-react';
import {
  dossierGaps,
  editBlocker,
  modes,
  slidesUrlPattern,
  type Action,
  type Actor,
  type Participant,
  type State,
} from './domain';
import { DEADLINE_LABEL, DOSSIER_DEADLINE } from './event';
import { Button, Stamp } from './ui';

export const roleIdeas = [
  'Studioso dei finti uccelli',
  'Esperta di scie sospette',
  'Cartografo della Terra cava',
  'Decifratrice di scontrini',
  'Analista di piccioni governativi',
  'Archivista dei segreti condominiali',
  'Teorico del Wi-Fi telepatico',
  'Perito in allunaggi da studio',
  'Sommelier di acqua fluorata',
  'Interprete dei cerchi nel grano',
  'Ispettore dei calzini spaiati',
];
const pick = (list: string[], not = '') => {
  const options = list.filter((x) => x !== not);
  return options[Math.floor(Math.random() * options.length)];
};
export const emptyDossier = (): Participant => ({
  id: '',
  name: '',
  role: '',
  title: '',
  deckUrl: '',
  mode: null,
  spectator: false,
});
/** Client-side check before saving; the server repeats it. */
export function dossierProblem(d: Participant): string | null {
  if (d.name.trim().length < 2) return 'Scrivi il tuo nome.';
  if (d.mode === 'slides' && d.deckUrl.trim() && !slidesUrlPattern.test(d.deckUrl.trim()))
    return 'Quello non sembra un link di Google Slides: deve iniziare con https://docs.google.com/presentation/';
  return null;
}

/** Time left until the dossier deadline, ticking every second. */
export function Countdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = DOSSIER_DEADLINE.getTime() - now;
  if (left <= 0)
    return (
      <div className="countdown expired" role="timer">
        <span className="mono">TEMPO SCADUTO</span>
        <strong>Il fascicolo doveva essere consegnato.</strong>
        <small>Completalo subito: la regia chiuderà un occhio. Solo uno.</small>
      </div>
    );
  const sec = Math.floor(left / 1000),
    d = Math.floor(sec / 86400),
    h = Math.floor((sec % 86400) / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="countdown" role="timer" aria-label={`Mancano ${d} giorni e ${h} ore alla consegna`}>
      <span className="mono">IL FASCICOLO VA CONSEGNATO ENTRO</span>
      <div className="countdown-digits" aria-hidden="true">
        <span>
          {d}
          <small>giorni</small>
        </span>
        <span>
          {pad(h)}
          <small>ore</small>
        </span>
        <span>
          {pad(m)}
          <small>min</small>
        </span>
        <span>
          {pad(s)}
          <small>sec</small>
        </span>
      </div>
      <small>Scadenza: {DEADLINE_LABEL}. Dopo, il fascicolo verrà secretato.</small>
    </div>
  );
}

/** The details needed before the evening: silly title, how, and the Slides link. No talk title: no spoilers, not even for the GM. */
export function DossierFields({ value, onChange }: { value: Participant; onChange: (p: Participant) => void }) {
  const set = (patch: Partial<Participant>) => onChange({ ...value, ...patch });
  return (
    <>
      <div className="field-row">
        <label>
          Titolo da congresso
          <input
            maxLength={80}
            placeholder="Es. Studioso dei finti uccelli"
            value={value.role}
            onChange={(e) => set({ role: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="icon-button dice"
          aria-label="Suggerisci un titolo"
          onClick={() => set({ role: pick(roleIdeas, value.role) })}
        >
          <Dices size={20} />
        </button>
      </div>
      <div className="field-mode" role="radiogroup" aria-label="Come presenti">
        <span className="label">Come presenti</span>
        <div className="mode-chips">
          {modes
            .filter((m) => m.key !== 'none')
            .map((m) => (
              <button
                type="button"
                role="radio"
                aria-checked={value.mode === m.key}
                key={m.key}
                className={'mode-chip ' + (value.mode === m.key ? 'chosen' : '')}
                onClick={() => set({ mode: m.key })}
              >
                <strong>{m.label}</strong>
                <span>{m.hint}</span>
              </button>
            ))}
        </div>
      </div>
      {value.mode === 'slides' && (
        <label>
          Link Google Slides
          <input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://docs.google.com/presentation/…"
            value={value.deckUrl}
            onChange={(e) => set({ deckUrl: e.target.value })}
          />
          <details className="howto">
            <summary>Dove trovo il link?</summary>
            Nella presentazione tocca <strong>Condividi</strong>, imposta <strong>Chiunque abbia il link</strong>, poi{' '}
            <strong>Copia link</strong> e incollalo qui.
          </details>
        </label>
      )}
    </>
  );
}

/** Screen 2: countdown, the dossier to complete, then the registry of everyone else. */
export function DossierHome({
  s,
  actor,
  busy,
  perform,
  compact = false,
}: {
  s: State;
  actor: Actor;
  busy: boolean;
  perform: (a: Action) => Promise<boolean>;
  compact?: boolean;
}) {
  const me = s.participants.find((p) => p.id === actor.participantId);
  const [draft, setDraft] = useState<Participant | null>(null),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  if (!me) return null;
  const value = draft ?? me,
    gaps = dossierGaps(me),
    blocker = editBlocker(s, actor, me.id),
    audience = me.mode === 'none',
    dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(me);
  const change = (p: Participant) => {
    setDraft(p);
    setSaved(false);
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = dossierProblem(value);
    if (problem) return setError(problem);
    setError('');
    if (await perform({ type: 'participant', participant: value })) {
      setDraft(null);
      setSaved(true);
    }
  }
  const sheet = (
    <form className="booking on-paper" onSubmit={submit} id="fascicolo">
      {gaps.length === 0 ? (
        <Stamp className="ok" sub={audience ? 'Spettatore' : 'Fascicolo completo'}>
          Ammesso
        </Stamp>
      ) : (
        <Stamp sub="Posto bloccato">Prenotato</Stamp>
      )}
      <span className="mono">FASCICOLO DI {me.name.toUpperCase()}</span>
      {blocker ? (
        <p className="footnote">{blocker}</p>
      ) : audience ? (
        <>
          <h2>Sei tra il pubblico.</h2>
          <p className="booking-lede">Hai cambiato idea? Scegli come presentare e il posto da relatore è tuo.</p>
          <DossierFields value={value} onChange={change} />
        </>
      ) : (
        <>
          <h2>{gaps.length ? 'Completa il fascicolo' : 'Tutto pronto.'}</h2>
          <p className="booking-lede">
            {gaps.length
              ? `Manca: ${gaps.join(', ')}. Puoi salvare anche un pezzo alla volta.`
              : 'Puoi ancora cambiare qualcosa fino al tuo turno.'}
          </p>
          <DossierFields value={value} onChange={change} />
        </>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {!blocker && (
        <Button type="submit" className="booking-cta" disabled={busy || !dirty}>
          {busy ? 'Archiviazione…' : saved && !dirty ? 'Salvato' : 'Salva il fascicolo'}
          <Check size={18} />
        </Button>
      )}
    </form>
  );
  if (compact)
    return (
      <details className="dossier-compact">
        <summary>Il tuo fascicolo{gaps.length ? ': da completare' : ''}</summary>
        {sheet}
      </details>
    );
  return (
    <section className="booked">
      <p className="eyebrow">Posto bloccato</p>
      <h1>Benvenuto, {me.name}.</h1>
      {!audience && gaps.length > 0 && <Countdown />}
      {sheet}
      <Registry s={s} meId={me.id} />
    </section>
  );
}

type Status = 'ready' | 'booked' | 'audience';
const statusOf = (p: Participant): Status =>
  p.mode === 'none' ? 'audience' : dossierGaps(p).length === 0 ? 'ready' : 'booked';
const statusLabel: Record<Status, string> = {
  ready: 'Fascicolo pronto',
  booked: 'Posto bloccato, fascicolo incompleto',
  audience: 'Pubblico',
};
const order: Record<Status, number> = { ready: 0, booked: 1, audience: 2 };

/** Who else is in and how far along they are. Names and status only: titles stay secret. */
export function Registry({ s, meId }: { s: State; meId?: string }) {
  const people = [...s.participants].sort((a, b) => order[statusOf(a)] - order[statusOf(b)]);
  const speakers = people.filter((p) => statusOf(p) !== 'audience'),
    ready = speakers.filter((p) => statusOf(p) === 'ready').length;
  return (
    <section className="registry" aria-labelledby="registry-title">
      <div className="registry-head">
        <h2 id="registry-title">Il registro</h2>
        <p>
          {speakers.length === 1 ? '1 posto da relatore bloccato' : `${speakers.length} posti da relatore bloccati`},{' '}
          {ready} {ready === 1 ? 'fascicolo pronto' : 'fascicoli pronti'}.{' '}
          {speakers.length > ready
            ? 'I ritardatari verranno segnalati alle autorità competenti.'
            : 'Nessun ritardatario. Sospetto.'}
        </p>
      </div>
      <ol className="registry-list">
        {people.map((p) => {
          const st = statusOf(p);
          return (
            <li key={p.id} className={'registry-row ' + st + (p.id === meId ? ' me' : '')}>
              <span className="registry-name">
                {p.name}
                {p.id === meId && <small>tu</small>}
              </span>
              <span className={'registry-status ' + st}>
                {st === 'ready' && <Check size={14} />}
                {p.id === meId && st === 'booked' ? <a href="#fascicolo">Completa il tuo</a> : statusLabel[st]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** GM tool: build the invite link with the event password inside, ready to paste in a chat. */
export function InvitePanel() {
  const [code, setCode] = useState(''),
    [copied, setCopied] = useState(false);
  const base = location.origin + location.pathname;
  const link = code.trim() ? `${base}#invito=${encodeURIComponent(code.trim())}` : '';
  const message = `Sei stato selezionato. Blocca il tuo posto (e non dirlo a nessuno): ${link}`;
  return (
    <section className="panel invite-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Per chi deve ancora iscriversi</p>
          <h2>Il link d’invito</h2>
        </div>
        <MessageCircle size={22} />
      </div>
      <p className="footnote">
        Scrivi la parola d’ordine degli ospiti: il link la contiene già, così i tuoi amici non devono digitare niente.
      </p>
      <label>
        Parola d’ordine degli ospiti
        <input
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setCopied(false);
          }}
        />
      </label>
      {link && (
        <>
          <p className="invite-link">{link}</p>
          <div className="result-actions">
            <Button
              onClick={() => {
                void navigator.clipboard?.writeText(message).then(() => setCopied(true));
              }}
            >
              <Copy size={17} /> {copied ? 'Copiato' : 'Copia messaggio'}
            </Button>
            <a
              className="button secondary"
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={17} /> Manda su WhatsApp
            </a>
          </div>
        </>
      )}
    </section>
  );
}
