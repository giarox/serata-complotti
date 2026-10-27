import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import type { Actor, Participant } from './domain';
import * as api from './api';
import { Button, Mark, Stamp } from './ui';
import { DossierFields, dossierProblem, emptyDossier } from './dossier';
import { EVENT_DAY } from './event';

type Step = 'book' | 'returning' | 'gm';
const KEY = 'complotti-invite-key';

/** The invite link carries the event password: …/#invito=PAROLA. Read it once, then hide it from the address bar. */
function readInviteKey(): string {
  try {
    const fromHash = new URLSearchParams(location.hash.replace(/^#/, '')).get('invito');
    const fromQuery = new URLSearchParams(location.search).get('invito');
    const found = fromHash ?? fromQuery;
    if (found) {
      sessionStorage.setItem(KEY, found);
      history.replaceState(null, '', location.pathname + location.search.replace(/[?&]invito=[^&]*/, ''));
      return found;
    }
    return sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}
function rememberKey(code: string) {
  try {
    sessionStorage.setItem(KEY, code);
  } catch {
    /* private mode: fine */
  }
}
const friendly = (m: string) =>
  m.includes('Password') || m.includes('PIN')
    ? 'Parola d’ordine sbagliata. Coincidenze? Io non credo. Ricontrolla il messaggio d’invito.'
    : m;

export function Entry({ onEnter }: { onEnter: (a: Actor) => void }) {
  const [step, setStep] = useState<Step>('book'),
    [code, setCode] = useState(''),
    [fromLink, setFromLink] = useState(false);
  useEffect(() => {
    const k = readInviteKey();
    setCode(k);
    setFromLink(!!k);
  }, []);
  return (
    <div className="entry invite">
      <div className="entry-brand">
        <Mark />
        <span>SERATA COMPLOTTI</span>
      </div>
      {step === 'book' && (
        <Booking
          code={code}
          setCode={setCode}
          fromLink={fromLink}
          onEnter={onEnter}
          onReturning={() => setStep('returning')}
        />
      )}
      {step === 'returning' && (
        <ReturningStep
          code={code}
          setCode={setCode}
          fromLink={fromLink}
          onEnter={onEnter}
          onBack={() => setStep('book')}
        />
      )}
      {step === 'gm' && <GmStep onEnter={onEnter} onBack={() => setStep('book')} />}
      <div className="entry-footer">
        {step !== 'gm' && (
          <Button secondary className="gm-door" onClick={() => setStep('gm')}>
            <LockKeyhole size={16} /> Accesso riservato alla regia
          </Button>
        )}
      </div>
    </div>
  );
}

/** The only registration screen: name, silly title and how they take part, all at once. */
function Booking({
  code,
  setCode,
  fromLink,
  onEnter,
  onReturning,
}: {
  code: string;
  setCode: (c: string) => void;
  fromLink: boolean;
  onEnter: (a: Actor) => void;
  onReturning: () => void;
}) {
  const [draft, setDraft] = useState<Participant>(() => ({ ...emptyDossier(), plusOne: false })),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  function problem(): string | null {
    if (draft.name.trim().length < 2) return 'Scrivi il tuo nome. Tanto lo sanno già, ma serve anche a noi.';
    if (!draft.mode) return 'Scegli la modalità di presentazione: con o senza tecnologia.';
    if (!draft.role.trim()) return 'Manca la qualifica. Nessuna idea? Tocca “Genera qualifica”.';
    return dossierProblem(draft);
  }
  async function book() {
    const p = problem();
    if (p) return setError(p);
    setBusy(true);
    setError('');
    try {
      const name = draft.name.trim();
      const actor = await api.register(code.trim(), name);
      rememberKey(code.trim());
      if (actor.participantId)
        await api.action(actor, {
          type: 'participant',
          participant: {
            ...draft,
            id: actor.participantId,
            name,
            role: draft.mode === 'none' ? '' : draft.role,
            deckUrl: draft.mode === 'slides' ? draft.deckUrl : '',
          },
        });
      onEnter(actor);
    } catch (e) {
      setError(friendly((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="invite-layout">
      <section className="invite-intro event-head">
        <p className="event-kicker">{EVENT_DAY} — 1° Congresso clandestino dei ricercatori indipendenti</p>
        <h1 className="event-title">
          <span>Siccome non cielo dicono,</span>
          <span>cielo diciamo noi.</span>
        </h1>
        <dl className="event-meta">
          <div>
            <dt>Edizione</dt>
            <dd>I</dd>
          </div>
          <div>
            <dt>Sede</dt>
            <dd>Top secret</dd>
          </div>
          <div>
            <dt>Ingresso</dt>
            <dd>Su ammissione</dd>
          </div>
        </dl>
        <p className="event-sub">I posti sono pochi: richiedi l’ammissione e la regia deciderà chi entra.</p>
      </section>
      <form
        className="booking letter on-paper"
        onSubmit={(e) => {
          e.preventDefault();
          void book();
        }}
      >
        <Stamp sub="Non divulgare">Top secret</Stamp>
        <h2>Richiesta di ammissione</h2>
        <p className="booking-lede">
          Le richieste verranno protocollate in ordine di arrivo. L’orario esatto è già stato annotato.
        </p>
        <div className="form-line">
          <label htmlFor="f-name">Nome del relatore</label>
          <input
            id="f-name"
            autoComplete="given-name"
            maxLength={40}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <DossierFields value={draft} onChange={setDraft} withAudience />
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <Button type="submit" className="booking-cta" disabled={busy}>
          {busy ? 'Ti stiamo schedando…' : 'Richiedi l’ammissione'}
        </Button>
        <Button secondary className="booking-alt" disabled={busy} onClick={onReturning}>
          Sono già ammesso
        </Button>
      </form>
    </div>
  );
}

function ReturningStep({
  code,
  setCode,
  fromLink,
  onEnter,
  onBack,
}: {
  code: string;
  setCode: (c: string) => void;
  fromLink: boolean;
  onEnter: (a: Actor) => void;
  onBack: () => void;
}) {
  const [names, setNames] = useState<Pick<Participant, 'id' | 'name'>[]>([]),
    [id, setId] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function load(c: string) {
    setBusy(true);
    setError('');
    try {
      setNames(await api.unlockNames(c.trim()));
      rememberKey(c.trim());
    } catch (e) {
      setError(friendly((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (code) void load(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!names.length) return void load(code);
    setBusy(true);
    setError('');
    try {
      onEnter(await api.login(code.trim(), id, false));
    } catch (e) {
      const m = (e as Error).message;
      setError(
        m.includes('già in uso')
          ? 'Risulti già aperto su un altro telefono. Sospetto. Chiedi alla regia di liberarti.'
          : friendly(m),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="entry-card step-card" onSubmit={submit}>
      <h2>Bentornato. Chi sei?</h2>
      <p>Telefono nuovo o pagina chiusa? Scegliti dalla lista.</p>
      {names.length > 0 && (
        <label>
          Chi sei
          <select required value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Scegli dalla lista</option>
            {names.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || (names.length > 0 && !id)}>
        {busy ? 'Controllo impronte…' : names.length ? 'Sono io' : 'Mostra la lista'}
        <ArrowRight size={18} />
      </Button>
      <Button secondary className="entry-switch" onClick={onBack}>
        <ArrowLeft size={18} /> Indietro
      </Button>
    </form>
  );
}

function GmStep({ onEnter, onBack }: { onEnter: (a: Actor) => void; onBack: () => void }) {
  const [code, setCode] = useState(''),
    [names, setNames] = useState<Pick<Participant, 'id' | 'name'>[]>([]),
    [id, setId] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!names.length) setNames(await api.unlockNames(code, true));
      else onEnter(await api.login(code, id, true));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="entry-card step-card" onSubmit={submit}>
      <h2>Entra in regia.</h2>
      <p>
        {names.length ? 'Se presenti o voti anche tu, scegli il tuo nome.' : 'Qui si decide cosa sapranno gli altri.'}
      </p>
      <label>
        PIN della regia
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          required
          value={code}
          disabled={names.length > 0}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      {names.length > 0 && (
        <label>
          Il tuo nome
          <select value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Solo regia: non presento e non voto</option>
            {names.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Un momento…' : names.length ? 'Entra in regia' : 'Continua'}
        <ArrowRight size={18} />
      </Button>
      <Button secondary className="entry-switch" onClick={onBack}>
        <ArrowLeft size={18} /> Indietro
      </Button>
      {!api.live && (
        <div className="demo-credentials">
          <strong>DEMO LOCALE</strong>
          <p>
            PIN regia demo: <code>{api.DEMO_PIN}</code>
          </p>
        </div>
      )}
    </form>
  );
}
