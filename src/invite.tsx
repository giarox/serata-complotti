import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from 'lucide-react';
import type { Actor, Participant } from './domain';
import * as api from './api';
import { Button, Mark, Stamp } from './ui';

type Step = 'invite' | 'key' | 'name' | 'returning' | 'gm';
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

export function Entry({ onEnter }: { onEnter: (a: Actor) => void }) {
  const [step, setStep] = useState<Step>('invite'),
    [after, setAfter] = useState<'name' | 'returning'>('name'),
    [code, setCode] = useState(''),
    [names, setNames] = useState<Pick<Participant, 'id' | 'name'>[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => setCode(readInviteKey()), []);

  async function go(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  /** Validate the password (from the link or typed) and move on. */
  function unlock(target: 'name' | 'returning', typed = code) {
    setAfter(target);
    if (!typed) return setStep('key');
    void go(async () => {
      try {
        setNames(await api.unlockNames(typed));
      } catch (e) {
        setStep('key');
        throw new Error(
          (e as Error).message.includes('Password')
            ? 'Questa parola d’ordine non apre niente. Ricontrolla il messaggio d’invito.'
            : (e as Error).message,
        );
      }
      try {
        sessionStorage.setItem(KEY, typed);
      } catch {
        /* private mode: fine */
      }
      setStep(target);
    });
  }
  const back = (to: Step = 'invite') => {
    setError('');
    setStep(to);
  };

  return (
    <div className="entry invite">
      <div className="entry-brand">
        <Mark />
        <span>SERATA COMPLOTTI</span>
        <span className="mono">CONGRESSO N. 001</span>
      </div>
      {step === 'invite' && (
        <InviteLetter
          onAccept={() => unlock('name')}
          onReturning={() => unlock('returning')}
          busy={busy}
          error={error}
        />
      )}
      {step === 'key' && (
        <form
          className="entry-card step-card"
          onSubmit={(e) => {
            e.preventDefault();
            unlock(after, code.trim());
          }}
        >
          <span className="mono">CONTROLLO DI SICUREZZA</span>
          <h2>Qual è la parola d’ordine?</h2>
          <p>Era scritta nel messaggio d’invito. Se non ce l’hai, chiedila a chi ti ha invitato. A bassa voce.</p>
          <label>
            Parola d’ordine
            <input
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          {!api.live && (
            <div className="demo-credentials">
              <strong>DEMO LOCALE</strong>
              <p>
                Parola d’ordine: <code>complotti</code>
              </p>
            </div>
          )}
          <Button type="submit" disabled={busy || !code.trim()}>
            {busy ? 'Verifica in corso…' : 'Avanti'}
            <ArrowRight size={18} />
          </Button>
          <button type="button" className="text-button entry-switch" onClick={() => back()}>
            <ArrowLeft size={14} /> Torna all’invito
          </button>
        </form>
      )}
      {step === 'name' && <NameStep code={code} onEnter={onEnter} onBack={() => back()} />}
      {step === 'returning' && <ReturningStep code={code} names={names} onEnter={onEnter} onBack={() => back()} />}
      {step === 'gm' && <GmStep onEnter={onEnter} onBack={() => back()} />}
      <div className="entry-footer">
        <span>NESSUNA TEORIA È STATA VERIFICATA DURANTE LA REALIZZAZIONE DI QUESTA SERATA.</span>
        {step !== 'gm' && (
          <button type="button" className="text-button gm-door" onClick={() => back('gm')}>
            <LockKeyhole size={12} /> Accesso riservato alla regia
          </button>
        )}
      </div>
    </div>
  );
}

function InviteLetter({
  onAccept,
  onReturning,
  busy,
  error,
}: {
  onAccept: () => void;
  onReturning: () => void;
  busy: boolean;
  error: string;
}) {
  return (
    <div className="invite-layout">
      <section className="invite-intro">
        <p className="eyebrow">Comunicazione riservata. Distruggere dopo la lettura.</p>
        <h1>Sei stato selezionato.</h1>
        <p className="invite-lede">Non chiederci come ti abbiamo trovato. Sappiamo che hai fatto le tue ricerche.</p>
      </section>
      <article className="letter">
        <Stamp sub="Solo per menti aperte">Top secret</Stamp>
        <p className="letter-open">
          Il <strong>Congresso Clandestino dei Ricercatori Indipendenti</strong> si riunisce a porte chiuse. Ci saranno
          menti aperte, un proiettore e nessuna fonte attendibile.
        </p>
        <h2>Come funziona la serata</h2>
        <ol className="clues">
          <li>
            <strong>Chi vuole sale sul palco e svela la sua teoria.</strong> Con le slide, con dei fogli, con un
            cartellone o solo con la voce. Nessun ordine: si va a coraggio.
          </li>
          <li>
            <strong>Il pubblico fa domande.</strong> Chi presenta risponde improvvisando, come i veri esperti in TV.
          </li>
          <li>
            <strong>Si vota dal telefono.</strong> Quattro premi in palio, tra cui l’ambitissimo Supercazzola. I
            risultati restano segreti fino alla fine. Ovviamente.
          </li>
        </ol>
        <h2>Per entrare nel registro</h2>
        <ul className="needs">
          <li className="now">
            <Check size={18} />
            <span>
              <strong>Adesso: nome e cognome.</strong> Basta questo, ci vogliono dieci secondi.
            </span>
          </li>
          <li>
            <span className="box" />
            <span>
              <strong>Prima della serata: un titolo da congresso ridicolo.</strong> Per esempio:{' '}
              <em>Dott. Paolo Pesaresi, studioso dei finti uccelli</em>.
            </span>
          </li>
          <li>
            <span className="box" />
            <span>
              <strong>Se presenti: il titolo della tua rivelazione e come la presenti.</strong> Slide di Google (ti
              serve il link) oppure alla vecchia maniera, con fogli e oggetti.
            </span>
          </li>
        </ul>
        <p className="letter-note">
          Il resto lo completi quando vuoi, da questa stessa pagina. Niente app, niente account: questo telefono si
          ricorderà di te.
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <Button className="letter-cta" onClick={onAccept} disabled={busy}>
          {busy ? 'Un momento…' : 'Accetto la missione'}
          <ArrowRight size={18} />
        </Button>
        <button type="button" className="text-button letter-returning" onClick={onReturning} disabled={busy}>
          Sono già nel registro (nuovo telefono o pagina chiusa)
        </button>
      </article>
    </div>
  );
}

function NameStep({ code, onEnter, onBack }: { code: string; onEnter: (a: Actor) => void; onBack: () => void }) {
  const [first, setFirst] = useState(''),
    [last, setLast] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!first.trim() || !last.trim()) return setError('Servono sia il nome sia il cognome.');
    setBusy(true);
    setError('');
    try {
      onEnter(await api.register(code, `${first.trim()} ${last.trim()}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="entry-card step-card" onSubmit={submit}>
      <span className="mono">ISCRIZIONE AL REGISTRO</span>
      <h2>Come ti chiami davvero?</h2>
      <p>Lo vedranno tutti sul proiettore. Il titolo ridicolo arriva dopo, promesso.</p>
      <label>
        Nome
        <input autoFocus autoComplete="given-name" required value={first} onChange={(e) => setFirst(e.target.value)} />
      </label>
      <label>
        Cognome
        <input autoComplete="family-name" required value={last} onChange={(e) => setLast(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Ti stiamo schedando…' : 'Mettimi nel registro'}
        <ArrowRight size={18} />
      </Button>
      <button type="button" className="text-button entry-switch" onClick={onBack}>
        <ArrowLeft size={14} /> Torna all’invito
      </button>
    </form>
  );
}

function ReturningStep({
  code,
  names,
  onEnter,
  onBack,
}: {
  code: string;
  names: Pick<Participant, 'id' | 'name'>[];
  onEnter: (a: Actor) => void;
  onBack: () => void;
}) {
  const [id, setId] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onEnter(await api.login(code, id, false));
    } catch (e) {
      const m = (e as Error).message;
      setError(
        m.includes('già in uso')
          ? 'Questo nome risulta aperto su un altro telefono. Chiedi alla regia di liberarlo.'
          : m,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="entry-card step-card" onSubmit={submit}>
      <span className="mono">RIENTRO AGENTE</span>
      <h2>Bentornato. Chi sei?</h2>
      <p>Scegli il tuo nome dalla lista. Se non ci sei, torna indietro e iscriviti.</p>
      <label>
        Il tuo nome
        <select required value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Scegli dalla lista</option>
          {names.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || !id}>
        {busy ? 'Controllo impronte…' : 'Sono io'}
        <ArrowRight size={18} />
      </Button>
      <button type="button" className="text-button entry-switch" onClick={onBack}>
        <ArrowLeft size={14} /> Torna all’invito
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
        <ArrowLeft size={14} /> Torna all’invito
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
