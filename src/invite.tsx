import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, LockKeyhole } from 'lucide-react';
import type { Actor, Participant } from './domain';
import * as api from './api';
import { Button, Mark, Stamp } from './ui';
import { DossierFields, dossierProblem, emptyDossier } from './dossier';

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
  m.includes('Password') ? 'Parola d’ordine sbagliata. Ricontrolla il messaggio d’invito.' : m;

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
          <button type="button" className="text-button gm-door" onClick={() => setStep('gm')}>
            <LockKeyhole size={12} /> Accesso riservato alla regia
          </button>
        )}
      </div>
    </div>
  );
}

function KeyField({ code, setCode }: { code: string; setCode: (c: string) => void }) {
  return (
    <label className="key-field">
      Parola d’ordine <span className="req">la trovi nel messaggio d’invito</span>
      <input
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      {!api.live && <span className="field-hint">Demo: complotti</span>}
    </label>
  );
}

/** The whole invite is one form: book a speaker slot with an alias, add the rest whenever. */
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
  const [draft, setDraft] = useState<Participant>(emptyDossier()),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function book(spectator: boolean) {
    const problem = dossierProblem(draft);
    if (problem) return setError(problem);
    if (!code.trim()) return setError('Manca la parola d’ordine. È nel messaggio d’invito.');
    setBusy(true);
    setError('');
    try {
      const actor = await api.register(code.trim(), draft.name.trim(), draft.alias.trim());
      rememberKey(code.trim());
      const details = spectator ? { ...draft, mode: 'none' as const } : draft;
      const hasDetails =
        spectator || details.role.trim() || details.title.trim() || details.mode || details.deckUrl.trim();
      if (hasDetails && actor.participantId)
        await api.action(actor, {
          type: 'participant',
          participant: { ...details, id: actor.participantId, name: draft.name.trim(), alias: draft.alias.trim() },
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
      <section className="invite-intro">
        <p className="eyebrow">Comunicazione riservata</p>
        <h1>Sei stato selezionato.</h1>
        <p className="invite-lede">
          Il congresso cerca relatori. Blocca il tuo posto adesso: i dettagli li aggiungi quando sei pronto. Tutto il
          resto lo scoprirai in serata.
        </p>
      </section>
      <form
        className="booking letter on-paper"
        onSubmit={(e) => {
          e.preventDefault();
          void book(false);
        }}
      >
        <Stamp sub="Non divulgare">Top secret</Stamp>
        <span className="mono">MODULO DI PRENOTAZIONE</span>
        <h2>Blocca il tuo posto da relatore</h2>
        {!fromLink && <KeyField code={code} setCode={setCode} />}
        <DossierFields value={draft} onChange={setDraft} />
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <Button type="submit" className="booking-cta" disabled={busy}>
          {busy ? 'Ti stiamo schedando…' : 'Blocca il mio posto'}
          <ArrowRight size={18} />
        </Button>
        <div className="booking-secondary">
          <button type="button" className="text-button" disabled={busy} onClick={() => void book(true)}>
            <Eye size={14} /> Non presento, vengo solo a giudicare
          </button>
          <button type="button" className="text-button" disabled={busy} onClick={onReturning}>
            Ho già prenotato
          </button>
        </div>
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
          ? 'Risulti già aperto su un altro telefono. Chiedi alla regia di liberarti.'
          : friendly(m),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="entry-card step-card" onSubmit={submit}>
      <span className="mono">RIENTRO AGENTE</span>
      <h2>Bentornato. Chi sei?</h2>
      <p>Nuovo telefono o pagina chiusa? Scegliti dalla lista (con l’alias, se ne hai uno).</p>
      {(!fromLink || !names.length) && !names.length && <KeyField code={code} setCode={setCode} />}
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
      <button type="button" className="text-button entry-switch" onClick={onBack}>
        <ArrowLeft size={14} /> Torna alla prenotazione
      </button>
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
      <span className="mono">ACCESSO REGIA</span>
      <h2>Entra in regia.</h2>
      <p>{names.length ? 'Se presenti o voti anche tu, scegli il tuo nome.' : 'La conduzione è nelle tue mani.'}</p>
      <label>
        Password della regia
        <input
          type="password"
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
      <button type="button" className="text-button entry-switch" onClick={onBack}>
        <ArrowLeft size={14} /> Torna alla prenotazione
      </button>
      {!api.live && (
        <div className="demo-credentials">
          <strong>DEMO LOCALE</strong>
          <p>
            Regia: <code>regia-demo</code> · Ospiti: <code>complotti</code>
          </p>
        </div>
      )}
    </form>
  );
}
