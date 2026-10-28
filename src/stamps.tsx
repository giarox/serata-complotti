import React, { useEffect, useState, type ReactNode } from 'react';
import { Check, Stamp as StampIcon } from 'lucide-react';
import {
  activeRound,
  displayName,
  emptyBallot,
  MAX_STAMPS,
  ownerOf,
  presenter,
  stamp,
  stampCount,
  stamps,
  voterOf,
  voters,
  type Action,
  type Actor,
  type Ballot,
  type StampKey,
  type State,
} from './domain';
import {
  certificate,
  prizeOrder,
  registro,
  revealMoment,
  revealOver,
  revealedPrizes,
  talks,
  verdict,
  type PrizeKey,
  type Talk,
} from './verdict';
import { Fit } from './fit';
import { ConfettiBurst, Laurel } from './ceremony';
import { Button, Mark } from './ui';

type Perform = (a: Action) => Promise<boolean>;
export const list = (names: string[]) =>
  names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
const namesOf = (step: Talk[]) => list(step.map((t) => displayName(t.presenter)));

/** Prize names, reasons and the line that opens each one on the projector. */
export const prizes: Record<PrizeKey, { name: string; reason: string; opener: string; stamp?: StampKey }> = {
  qa: {
    name: stamp('qa').prize,
    reason: stamp('qa').reason,
    opener: 'Non sono un esperto, ma… alcune risposte sfidavano la gravità.',
    stamp: 'qa',
  },
  performance: {
    name: stamp('performance').prize,
    reason: stamp('performance').reason,
    opener: 'Non importa cosa ci ha detto. Importa che ci abbiamo creduto.',
    stamp: 'performance',
  },
  ricerca: {
    name: stamp('ricerca').prize,
    reason: stamp('ricerca').reason,
    opener: 'Ho fatto le mie ricerche. Qualcuno più di altri.',
    stamp: 'ricerca',
  },
  idea: {
    name: stamp('idea').prize,
    reason: stamp('idea').reason,
    opener: 'Ma sai che… certe idee non vengono da sole?',
    stamp: 'idea',
  },
  cappello: {
    name: 'Il Cappello di Stagnola d’Oro',
    reason: 'Gran Maestro del Congresso',
    opener: 'Siccome non cielo dicono, cielo diciamo noi.',
  },
};

/** A rubber stamp: inked when pressed, a dashed ghost when not. Name always written: colour never alone. */
export function StampMark({
  k,
  on = true,
  small = false,
  className = '',
}: {
  k: StampKey | 'cappello';
  on?: boolean;
  small?: boolean;
  className?: string;
}) {
  const title = k === 'cappello' ? 'GRAN MAESTRO' : stamp(k).title;
  const ink = k === 'cappello' ? '#b8935a' : stamp(k).ink;
  return (
    <span
      className={'ink-stamp' + (on ? ' on' : ' off') + (small ? ' small' : '') + ' ' + className}
      style={{ '--ink': ink } as React.CSSProperties}
    >
      {title}
    </span>
  );
}

/* ------------------------------------------------------------------ phones ------------------------------------------------------------------ */

/** The ballot: four stamps, at most two. The vote is valid only once the server confirms it. */
export function StampBallot({ s, actor, busy, perform }: { s: State; actor: Actor; busy: boolean; perform: Perform }) {
  const r = activeRound(s)!,
    p = presenter(s)!,
    saved = s.votes.find((v) => v.roundId === r.id && v.voterId === actor.participantId);
  const [draft, setDraft] = useState<Ballot>(() => (saved ? pick(saved) : emptyBallot())),
    [dirty, setDirty] = useState(false),
    [full, setFull] = useState(false),
    [askEmpty, setAskEmpty] = useState(false);
  const n = stampCount(draft);
  function toggle(k: StampKey) {
    if (!draft[k] && n >= MAX_STAMPS) {
      setFull(true);
      navigator.vibrate?.(60);
      window.setTimeout(() => setFull(false), 600);
      return;
    }
    setDraft({ ...draft, [k]: !draft[k] });
    setDirty(true);
    setAskEmpty(false);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (n === 0 && !askEmpty) return setAskEmpty(true);
    if (await perform({ type: 'vote', roundId: r.id, ballot: draft })) {
      setDirty(false);
      setAskEmpty(false);
    }
  }
  return (
    <form className="voting-form stamp-ballot" onSubmit={submit}>
      <p className="eyebrow">TIMBRA IL FASCICOLO / VOTO RISERVATO</p>
      <div className="ballot-person">
        <span>
          Stai timbrando <strong>{displayName(p)}</strong>
        </span>
        {p.role && <h2>{p.role}</h2>}
      </div>
      <p className="ballot-intro">
        <strong>Il fascicolo è nelle tue mani ora.</strong> Abbiamo bisogno dei tuoi timbri di approvazione per
        catalogarlo accuratamente. Ci fidiamo di te, più o meno.
      </p>
      <div className="ballot-hint">
        <div>
          <strong>Il Congresso vuole sapere: cosa ti ha colpito?</strong>
          <span>Nessun timbro, uno o al massimo due. L’inchiostro costa.</span>
        </div>
        <strong className={'stamp-count' + (full ? ' full' : '')}>Timbri: {n}/2</strong>
      </div>
      <div className={'stamp-grid' + (full ? ' shake' : '')} role="group" aria-label="I timbri">
        {stamps.map((c) => (
          <button
            key={c.key}
            type="button"
            className={'stamp-choice' + (draft[c.key] ? ' pressed' : '')}
            aria-pressed={draft[c.key]}
            onClick={() => toggle(c.key)}
          >
            <StampMark k={c.key} on={draft[c.key]} />
            <span className="stamp-line">{c.line}</span>
            <span className="stamp-joke">{c.joke}</span>
          </button>
        ))}
      </div>
      {full && (
        <p role="alert" className="field-error">
          Due timbri al massimo. Toglierne uno per cambiare idea.
        </p>
      )}
      {saved && (
        <p className="saved-banner" role="status">
          <Check size={17} />
          {dirty
            ? 'Fascicolo consegnato. Hai modifiche da consegnare.'
            : 'Fascicolo consegnato. Puoi cambiarlo fino alla chiusura.'}
        </p>
      )}
      {askEmpty && (
        <p className="footnote" role="status">
          Nessun timbro? Va bene, anche il silenzio è una presa di posizione.
        </p>
      )}
      <Button type="submit" disabled={busy || (!!saved && !dirty && !askEmpty)}>
        {busy
          ? 'Consegna in corso…'
          : askEmpty
            ? 'Consegna senza timbri'
            : saved
              ? 'Consegna le modifiche'
              : 'Consegna il fascicolo'}
        <Check size={18} />
      </Button>
    </form>
  );
}
const pick = (b: Ballot): Ballot => ({
  idea: !!b.idea,
  ricerca: !!b.ricerca,
  performance: !!b.performance,
  qa: !!b.qa,
});

/** The review: every finished talk, your stamps on each, saved at every tap. */
export function ReviewBoard({ s, actor, busy, perform }: { s: State; actor: Actor; busy: boolean; perform: Perform }) {
  const me = actor.participantId ?? '',
    all = talks(s),
    confirmed = (s.reviewed ?? []).includes(me);
  const [draft, setDraft] = useState<Record<string, Ballot>>({});
  const ballotOf = (roundId: string) => {
    const v = s.votes.find((x) => x.roundId === roundId && x.voterId === me);
    return draft[roundId] ?? (v ? pick(v) : emptyBallot());
  };
  const [full, setFull] = useState('');
  async function toggle(roundId: string, k: StampKey) {
    const b = ballotOf(roundId);
    if (!b[k] && stampCount(b) >= MAX_STAMPS) {
      setFull(roundId);
      navigator.vibrate?.(60);
      window.setTimeout(() => setFull(''), 600);
      return;
    }
    const next = { ...b, [k]: !b[k] };
    setDraft({ ...draft, [roundId]: next });
    const ok = await perform({ type: 'vote', roundId, ballot: next });
    if (!ok)
      setDraft((d) => {
        const rest = { ...d };
        delete rest[roundId];
        return rest;
      });
  }
  // Server state wins once it catches up.
  useEffect(() => setDraft({}), [s.revision]);
  return (
    <section className="review-board">
      <p className="eyebrow">REVISIONE DEI FASCICOLI</p>
      <h1>Rivedi le tue timbrature.</h1>
      <p className="review-lede">Ora che hai visto tutti, puoi spostare i timbri. Massimo due per fascicolo.</p>
      <ol className="review-list">
        {all.map((t) => {
          const mine = ownerOf(me) === t.presenter.id,
            b = ballotOf(t.round.id);
          return (
            <li
              key={t.round.id}
              className={'review-row' + (mine ? ' mine' : '') + (full === t.round.id ? ' shake' : '')}
            >
              <div className="review-who">
                <span className="mono">{String(t.order).padStart(2, '0')}</span>
                <div>
                  <strong>{displayName(t.presenter)}</strong>
                  {t.presenter.role && <small>{t.presenter.role}</small>}
                </div>
                <em className="review-count">{mine ? 'Il tuo fascicolo' : `${stampCount(b)}/2`}</em>
              </div>
              {!mine && (
                <div className="review-stamps" role="group" aria-label={'Timbri per ' + displayName(t.presenter)}>
                  {stamps.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={b[c.key]}
                      className={'stamp-chip' + (b[c.key] ? ' pressed' : '')}
                      disabled={busy && !b[c.key]}
                      onClick={() => void toggle(t.round.id, c.key)}
                    >
                      <StampMark k={c.key} on={b[c.key]} small />
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="review-confirm">
        {confirmed ? (
          <p className="saved-banner" role="status">
            <Check size={17} /> Confermato. Puoi ancora cambiare finché la regia non chiude.
          </p>
        ) : (
          <Button disabled={busy} onClick={() => void perform({ type: 'confirmReview' })}>
            Confermo le mie timbrature <Check size={18} />
          </Button>
        )}
      </div>
    </section>
  );
}

/** During the reveal the phone asks you to look up; at the end it hands you your certificate. */
export function GuestReveal({ s, actor }: { s: State; actor: Actor }) {
  if (!revealOver(s))
    return (
      <section className="guest-stage reveal-wait">
        <span className="phase-badge">Il verdetto</span>
        <Mark large />
        <h1>Guardate il proiettore.</h1>
        <p>Il telefono potrebbe essere intercettato. Alla fine qui arriverà il tuo attestato.</p>
      </section>
    );
  return <Certificate s={s} actor={actor} />;
}

/** A private certificate: name, title, prizes or mentions, stamp counts. Only for your own talk. */
export function Certificate({ s, actor }: { s: State; actor: Actor }) {
  const v = voterOf(s, actor.participantId);
  const witness = v?.companion && v.owner.partner === 'witness';
  const c = v && !witness ? certificate(s, v.owner.id) : null;
  const name = v ? (v.companion ? v.name : displayName(v.owner)) : '';
  return (
    <article className="certificate">
      <p className="mono">ATTESTATO DI PARTECIPAZIONE · 1° CONGRESSO DEI RICERCATORI INDIPENDENTI</p>
      <h1>{name}</h1>
      {c?.talk.presenter.role && <p className="cert-role">«{c.talk.presenter.role}»</p>}
      {!c ? (
        <p className="cert-body">
          {witness ? 'Testimone oculare' : 'Membro del pubblico'}: hai visto tutto e non dirai niente. Il Congresso ti
          ringrazia per la vigilanza.
        </p>
      ) : (
        <>
          {c.prizes.map((k) => (
            <p key={k} className="cert-prize">
              <StampIcon size={18} /> {prizes[k].name} <small>{prizes[k].reason}</small>
            </p>
          ))}
          {c.mentions.map((m) => (
            <p key={m.prize} className="cert-mention">
              {m.place}° posto · {prizes[m.prize].name}
            </p>
          ))}
          {stampKeysWith(c.talk).length ? (
            <ul className="cert-stamps">
              {stamps.map((x) =>
                c.talk.counts[x.key] > 0 ? (
                  <li key={x.key}>
                    <StampMark k={x.key} small />
                    <span>
                      Il popolo ti ha timbrato <strong>{c.talk.counts[x.key]}</strong>{' '}
                      {c.talk.counts[x.key] === 1 ? 'volta' : 'volte'}.
                    </span>
                  </li>
                ) : null,
              )}
            </ul>
          ) : (
            <p className="cert-body">
              Nessun timbro: il tuo fascicolo è così segreto che nemmeno il pubblico ha osato toccarlo.
            </p>
          )}
        </>
      )}
      <p className="cert-foot">Questo attestato è riservato: lo vedi solo tu.</p>
    </article>
  );
}
const stampKeysWith = (t: Talk) => stamps.filter((x) => t.counts[x.key] > 0);

/* ---------------------------------------------------------------- projector ---------------------------------------------------------------- */

/** Vote open: who is being judged, and what each stamp means (in big type, for the first talk above all). */
export function VotingSlide({ s, top }: { s: State; top: ReactNode }) {
  const p = presenter(s);
  return (
    <div className="projector pj-stage pj-vote">
      {top}
      <div className="codeline">
        <span>VOTAZIONE APERTA</span>
        <i />
        <span>TIMBRATE DAL TELEFONO</span>
      </div>
      <p className="pj-lead">Sotto giudizio</p>
      {p && (
        <Fit as="h1" className="pj-name" lines={1} min={0.45}>
          {displayName(p)}
        </Fit>
      )}
      <p className="pj-punch">Il Congresso vuole sapere: cosa vi ha colpito?</p>
      <p className="pj-sub pj-vote-limit">Nessun timbro, uno o al massimo due. L’inchiostro costa.</p>
      <div className="pj-stamps">
        {stamps.map((c) => (
          <div key={c.key} className="pj-stamp-card">
            <StampMark k={c.key} />
            <span>{c.line}</span>
            <em>{c.joke}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewSlide({ s, top }: { s: State; top: ReactNode }) {
  const done = (s.reviewed ?? []).length;
  return (
    <div className="projector pj-break pj-review">
      {top}
      <Mark large />
      <div className="codeline">
        <span>REVISIONE</span>
        <i />
        <span>RISERVATO</span>
      </div>
      <h1>Revisione dei fascicoli in corso.</h1>
      <p className="pj-sub">Ora che avete visto tutti, potete spostare i timbri dal telefono. Poi si delibera.</p>
      <p className="pj-confirmed">
        <strong>{done}</strong> {done === 1 ? 'persona ha confermato' : 'persone hanno confermato'}
      </p>
    </div>
  );
}

/** The reveal: per prize open → 3rd → 2nd → 1st (with confetti); interlude; the Cappello; the Registro. */
export function RevealSlide({ s, top }: { s: State; top: ReactNode }) {
  const m = revealMoment(s);
  if (!m) return <div className="projector">{top}</div>;
  if (m.kind === 'interlude')
    return (
      <div className="projector pj-break pj-interlude">
        {top}
        <Mark large />
        <div className="codeline">
          <span>GRAN FINALE</span>
          <i />
          <span>RISERVATO</span>
        </div>
        <h1>Ora, per il gran finale.</h1>
        <p className="pj-sub">Il vincitore assoluto della serata.</p>
      </div>
    );
  if (m.kind === 'registro') return <RegistroSlide s={s} top={top} />;
  const v = verdict(s)[m.prize],
    info = prizes[m.prize],
    number = m.prize === 'cappello' ? 'PREMIO SPECIALE' : `PREMIO 0${prizeOrder.indexOf(m.prize as never) + 1} DI 04`;
  if (m.kind === 'open')
    return (
      <div className={'projector pj-stage pj-open-prize' + (m.prize === 'cappello' ? ' gold' : '')}>
        {top}
        <div className="codeline">
          <span>{number}</span>
          <i />
          <span>BUSTA SIGILLATA</span>
        </div>
        <p className="pj-lead">E il prossimo premio è</p>
        <h1>{info.name}</h1>
        <p className="pj-sub">{info.reason}</p>
        {info.stamp ? (
          <div className="pj-big-stamp">
            <StampMark k={info.stamp} />
          </div>
        ) : (
          <div className="pj-big-stamp">
            <StampMark k="cappello" />
          </div>
        )}
        <p className="pj-punch">{info.opener}</p>
      </div>
    );
  // Podium: 3rd and 2nd under a spotlight, then the winner with the confetti.
  const place = m.place,
    done = place === 1,
    first = v.podium[1],
    shown = (n: 1 | 2 | 3) => (n === 3 ? true : n === 2 ? place <= 2 : place === 1);
  const featured = v.podium[place],
    one = featured.length === 1 ? featured[0].presenter : null;
  const step = (n: 2 | 3) => (
    <div className={'pj-step pj-step-' + n + (shown(n) ? ' open' : ' sealed') + (place === n ? ' lit' : '')}>
      <Fit as="span" className="pj-step-name" lines={3} min={0.6}>
        {!shown(n) ? '?' : v.podium[n].length ? namesOf(v.podium[n]) : '—'}
      </Fit>
      <b>{n}°</b>
    </div>
  );
  return (
    <div className={'projector pj-stage pj-award ' + m.prize + (done ? ' done' : ' suspense')}>
      {top}
      {done && first.length > 0 && <ConfettiBurst key={m.prize} />}
      <div className="codeline">
        <span>{number}</span>
        <i />
        <span>{info.name.toUpperCase()}</span>
      </div>
      {done ? (
        <div className="pj-wreath">
          <Laurel />
          <div className="pj-wreath-in">
            <p className="pj-lead">{first.length ? (v.shared ? 'Pari merito' : `${info.name} va a`) : info.name}</p>
            <Fit as="h1" className="pj-name" lines={2}>
              {first.length ? namesOf(first) : 'Premio insabbiato.'}
            </Fit>
            {first.length === 1 && first[0].presenter.role && <Fit className="pj-role">{first[0].presenter.role}</Fit>}
            <p className="pj-sub">{first.length ? info.reason : 'Il Congresso nega che sia mai esistito.'}</p>
            {first.length > 0 && info.stamp && (
              <div className="pj-stamp-drop">
                <StampMark k={info.stamp} />
              </div>
            )}
            {first.length > 0 && m.prize === 'cappello' && v.placements && (
              // The Cappello's infographic: where the winner landed on the four podiums. No points shown.
              <div className="pj-medals">
                {first.map((t) => (
                  <ul key={t.round.id} aria-label={'Piazzamenti di ' + displayName(t.presenter)}>
                    {first.length > 1 && <li className="pj-medals-who">{displayName(t.presenter)}</li>}
                    {(v.placements![t.round.id] ?? []).map((pl) => (
                      <li key={pl.prize}>
                        <b>{pl.place}°</b>
                        <StampMark k={pl.prize} small />
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            )}
          </div>
          <Laurel right />
        </div>
      ) : (
        <div className="pj-feature" key={place}>
          <p className="pj-place">
            {place}° posto{featured.length > 1 ? ' · pari merito' : ''}
          </p>
          <Fit as="h1" className="pj-name" lines={2}>
            {featured.length ? namesOf(featured) : 'Posto vacante.'}
          </Fit>
          {one?.role && <Fit className="pj-role">{one.role}</Fit>}
          {!featured.length && <p className="pj-sub">Nessuno sul gradino. Sospetto.</p>}
        </div>
      )}
      <div className="pj-podium-steps">
        {step(2)}
        <div className={'pj-step pj-step-1' + (done ? ' open lit' : ' sealed')}>
          <b>1°</b>
        </div>
        {step(3)}
      </div>
    </div>
  );
}

/** Everyone who presented, with the stamps they received at least once. No counts, evening order. */
export function RegistroSlide({ s, top }: { s: State; top: ReactNode }) {
  const rows = registro(s);
  return (
    <div className="projector pj-registro">
      {top}
      <p className="eyebrow">IL CONGRESSO HA PARLATO</p>
      <h1>Il Registro dei Timbri.</h1>
      <ol className="pj-registro-grid" style={{ '--n': rows.length } as React.CSSProperties}>
        {rows.map(({ talk, stamps: got }) => (
          <li key={talk.round.id}>
            <Fit as="strong" lines={2} min={0.55}>
              {displayName(talk.presenter)}
            </Fit>
            {got.length ? (
              <span className="pj-registro-stamps">
                {got.map((k) => (
                  <StampMark key={k} k={k} small />
                ))}
              </span>
            ) : (
              <em>Fascicolo secretato</em>
            )}
          </li>
        ))}
      </ol>
      <p className="pj-thanks">
        Grazie a tutti i ricercatori, ai co-relatori, ai testimoni e al pubblico. Avete visto troppo: ora siete dei
        nostri. Controllate il telefono: c’è il vostro attestato.
      </p>
      <div className="codeline">
        <span>FASCICOLO CHIUSO</span>
        <i />
        <span>CONTINUA… CONGRESSO N. 002</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ regia ------------------------------------------------------------------ */

/** What the next tap shows on the projector — never the names, so the GM enjoys the surprise too. */
export function nextStepLabel(s: State) {
  const next = revealMoment({ phase: 'results', revealed: s.revealed + 1 });
  if (!next || s.revealed >= 22) return 'Fine: il Registro è sul proiettore.';
  if (next.kind === 'interlude') return 'Prossimo: il gran finale';
  if (next.kind === 'registro') return 'Prossimo: il Registro dei Timbri';
  const name = prizes[next.prize].name;
  return next.kind === 'open' ? `Prossimo: apertura · ${name}` : `Prossimo: ${next.place}° posto · ${name}`;
}
export function nowLabel(s: State) {
  const m = revealMoment(s);
  if (!m) return '';
  if (m.kind === 'interlude') return 'Sul proiettore: il passaggio al gran finale.';
  if (m.kind === 'registro') return 'Sul proiettore: il Registro dei Timbri. Ognuno ha l’attestato sul telefono.';
  const name = prizes[m.prize].name;
  return m.kind === 'open' ? `Sul proiettore: apertura · ${name}.` : `Sul proiettore: ${m.place}° posto · ${name}.`;
}

/** The fixed rules, in short, where the provisional settings used to be. */
export function RulesSummary() {
  return (
    <section className="panel rules-summary">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">LE REGOLE DEL VERDETTO</p>
          <h2>Timbri, revisione, cinque premi</h2>
        </div>
      </div>
      <ul className="rules-list">
        <li>Dopo ogni talk ognuno dà da 0 a 2 timbri. Mai sul proprio fascicolo.</li>
        <li>Prima del verdetto c’è la revisione: si possono spostare i timbri su tutti i talk.</li>
        <li>
          Quattro premi-timbro, uno a testa: chi ha già vinto “scala” e il premio va al successivo con più timbri. Due
          pari in testa lo condividono; se non resta nessuno libero, il primo vince un secondo premio.
        </li>
        <li>
          Il <strong>Cappello di Stagnola d’Oro</strong> va al miglior medagliere sui podi (1° 3 punti, 2° 2, 3° 1) e si
          può sommare a un altro premio.
        </li>
        <li>Sul proiettore niente numeri: solo podi, 3° → 2° → 1°.</li>
      </ul>
      <div className="stamp-legend">
        {stamps.map((c) => (
          <span key={c.key}>
            <StampMark k={c.key} small /> {c.prize}
          </span>
        ))}
      </div>
    </section>
  );
}

/** Regia, after the reveal: the prizes already on the projector (nothing ahead of it). */
export function RevealedList({ s }: { s: State }) {
  const done = revealedPrizes(s);
  if (!done.length) return null;
  const v = verdict(s);
  return (
    <section className="panel revealed-list">
      <p className="eyebrow">GIÀ SVELATI</p>
      <ul>
        {done.map((k) => (
          <li key={k}>
            <strong>{prizes[k].name}</strong>
            <span>{v[k].podium[1].length ? namesOf(v[k].podium[1]) : 'Insabbiato'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** How many voters exist, and how many confirmed the review. */
export function reviewTally(s: State) {
  return { confirmed: (s.reviewed ?? []).length, voters: voters(s).length };
}
