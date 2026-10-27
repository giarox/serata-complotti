import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Eye,
  Radio,
  Users,
  Monitor,
  Trophy,
  ArrowRight,
  ArrowUpRight,
  LockKeyhole,
  Check,
  X,
  Plus,
  Pencil,
  FileText,
  CircleHelp,
  Download,
  LogOut,
  Maximize,
  ArrowLeft,
  ChevronRight,
  Vote as VoteIcon,
  MessageCircle,
  Play,
  Settings2,
  LockKeyholeOpen,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  activeRound,
  awards,
  categories,
  category,
  countVotes,
  defaultSettings,
  displayName,
  dossierGaps,
  modes,
  phaseNames,
  presenter,
  voteBlocker,
  type Action,
  type Admission,
  type Actor,
  type Ballot,
  type Participant,
  type Settings,
  type State,
} from './domain';
import * as api from './api';
import '@fontsource/antonio/600.css';
import '@fontsource/antonio/700.css';
import '@fontsource/special-elite/400.css';
import '@fontsource/arimo/400.css';
import '@fontsource/arimo/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './style.css';
import { Button, Mark, Stamp } from './ui';
import { Entry } from './invite';
import { DossierHome, InvitePanel } from './dossier';
const blank: Participant = {
  id: '',
  name: '',
  role: '',
  title: '',
  deckUrl: '',
  mode: null,
  spectator: false,
};
const iconSize = 19;
function App() {
  const [actor, setActor] = useState<Actor | null>(null),
    [state, setState] = useState<State | null>(null),
    [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('regia'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Participant | null>(null),
    [selected, setSelected] = useState<Participant | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null),
    [connected, setConnected] = useState(navigator.onLine);
  const [screen, setScreen] = useState(new URLSearchParams(location.search).get('view') === 'screen');
  useEffect(() => {
    api
      .restoreActor()
      .then((a) => {
        setActor(a);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  const refresh = useCallback(async () => {
    if (!actor) return;
    try {
      const s = await api.getState(actor);
      setState((prev) => (!prev || s.revision >= prev.revision ? s : prev));
      setConnected(navigator.onLine);
    } catch (e) {
      setConnected(false);
      setError((e as Error).message);
    }
  }, [actor]);
  useEffect(() => {
    void refresh();
    return api.watch(() => void refresh());
  }, [refresh]);
  useEffect(() => {
    const off = () => setConnected(false);
    window.addEventListener('offline', off);
    return () => window.removeEventListener('offline', off);
  }, []);
  async function perform(a: Action): Promise<boolean> {
    if (!actor || busy) return false;
    setBusy(true);
    setError('');
    try {
      await api.action(actor, a);
      await refresh();
      setSelected(null);
      setEditing(null);
      setConfirm(null);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function enter(a: Actor) {
    api.saveActor(a);
    setActor(a);
    setState(null);
    setError('');
  }
  async function logout() {
    await api.leave();
    setActor(null);
    setState(null);
    setScreen(false);
  }
  const s = state;
  const round = s ? activeRound(s) : undefined,
    person = s ? presenter(s) : undefined;
  if (loading)
    return (
      <div className="loading">
        <Mark />
        <p>Apertura del fascicolo…</p>
      </div>
    );
  if (!actor) return <Entry onEnter={enter} />;
  if (!s)
    return (
      <div className="loading">
        <Mark />
        <p>{error || 'Collegamento al congresso…'}</p>
        <Button secondary onClick={() => void logout()}>
          Torna all’ingresso
        </Button>
      </div>
    );
  function download() {
    if (!s) return;
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'complotti-risultati.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const completed = s.rounds.filter((r) => r.closed && !r.cancelled).length;
  const me = s.participants.find((p) => p.id === actor.participantId);
  return (
    <div className={screen ? 'app screen-mode' : 'app'}>
      {!screen && actor.role === 'gm' && (
        <aside className="sidebar">
          <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
            <Mark />
            <div>
              SERATA
              <br />
              COMPLOTTI<span>CONGRESSO N. 001</span>
            </div>
          </a>
          <div className="sidebar-label">IL QUARTIER GENERALE</div>
          <nav>
            {[
              ['regia', Radio, 'Regia della serata'],
              ['fascicoli', Users, 'I fascicoli'],
              ['premi', Trophy, 'Il verdetto'],
            ].map(([id, Icon, label]) => (
              <button key={String(id)} className={tab === id ? 'nav-active' : ''} onClick={() => setTab(String(id))}>
                {React.createElement(Icon as typeof Radio, { size: iconSize })}
                {String(label)}
                {id === 'regia' && <i className="dot" />}
              </button>
            ))}
            <button onClick={() => setScreen(true)}>
              <Monitor size={iconSize} />
              Vista proiettore
              <ArrowUpRight size={15} />
            </button>
          </nav>
          <div className="sidebar-bottom">
            <div className="mini-dossier">
              <LockKeyhole size={20} />
              <span>
                Accesso riservato
                <br />
                <strong>Solo per menti aperte.</strong>
              </span>
            </div>
            <button className="logout" onClick={() => void logout()}>
              <LogOut size={16} /> Esci dalla regia
            </button>
            <span className="edition">EDIZIONE ALPHA / 2026</span>
          </div>
        </aside>
      )}
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            {screen ? 'Sala proiezione' : actor.role === 'gm' ? 'Quartier generale' : 'Congresso clandestino'}{' '}
            <ChevronRight size={13} />{' '}
            <strong>
              {screen
                ? 'Schermo'
                : actor.role === 'gm'
                  ? tab === 'fascicoli'
                    ? 'I fascicoli'
                    : tab === 'premi'
                      ? 'Il verdetto'
                      : 'Regia della serata'
                  : s.participants.find((p) => p.id === actor.participantId)?.name}
            </strong>
          </span>
          <div className="top-actions">
            <span className={'connection ' + (!connected ? 'disconnected' : '')}>
              <i className="dot" />
              {!api.live ? 'Demo locale' : connected ? 'Collegato' : 'Riconnessione…'}
            </span>
            {screen ? (
              <button className="icon-button" aria-label="Esci dalla vista proiettore" onClick={() => setScreen(false)}>
                <X size={18} />
              </button>
            ) : actor.role === 'guest' ? (
              <button className="icon-button" aria-label="Esci" onClick={() => void logout()}>
                <LogOut size={18} />
              </button>
            ) : (
              <span className="avatar" title={me ? 'Regia · ' + me.name : 'Solo regia'}>
                {me ? me.name.slice(0, 2).toUpperCase() : 'GM'}
              </span>
            )}
          </div>
        </header>
        {!api.live && (
          <div className="demo-bar">
            <span>
              <strong>LABORATORIO DEMO</strong> Dati salvati in questo browser · nessuna connessione Supabase
            </span>
            <div>
              <button
                onClick={() => {
                  const a: Actor = { role: 'gm', participantId: 'gianluca' };
                  enter(a);
                  setScreen(false);
                }}
              >
                Regia
              </button>
              <select
                aria-label="Prova un partecipante"
                value={actor.participantId ?? ''}
                onChange={(e) => {
                  if (e.target.value) {
                    enter({ role: 'guest', participantId: e.target.value });
                    setScreen(false);
                  }
                }}
              >
                <option value="">Prova un partecipante</option>
                {s.participants.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {error && (
          <div role="alert" className="alert">
            {error}
            <button aria-label="Chiudi avviso" onClick={() => setError('')}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
            <button aria-label="Chiudi messaggio" onClick={() => setNotice('')}>
              <X size={16} />
            </button>
          </div>
        )}
        <main className={actor.role === 'guest' ? 'content guest-content' : 'content'}>
          {screen ? (
            <Projector s={s} />
          ) : actor.role === 'guest' ? (
            <Guest s={s} actor={actor} busy={busy} perform={perform} />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    <span /> ACCESSO LIVELLO: REGIA
                  </p>
                  <h1>
                    {tab === 'fascicoli'
                      ? 'Ogni teoria ha un volto.'
                      : tab === 'premi'
                        ? 'La verità viene a galla.'
                        : 'Tieni insieme il complotto.'}
                  </h1>
                  <p>
                    {tab === 'fascicoli'
                      ? 'Prepara i ricercatori, le prove e i loro fascicoli.'
                      : tab === 'premi'
                        ? 'Quattro categorie. Nessun premio alla normalità.'
                        : 'Tu conduci la serata. Loro mettono in dubbio tutto il resto.'}
                  </p>
                </div>
                <Stamp sub="Strettamente confidenziale">Top secret</Stamp>
              </div>
              <div className="mobile-nav">
                <button onClick={() => setTab('regia')}>Regia</button>
                <button onClick={() => setTab('fascicoli')}>Fascicoli</button>
                <button onClick={() => setTab('premi')}>Verdetto</button>
                <button onClick={() => setScreen(true)}>Schermo</button>
              </div>
              {tab === 'regia' && (
                <>
                  <section className="stat-strip">
                    <div>
                      <Users />
                      <span>
                        Al congresso
                        <strong>
                          {(s.participants.length + s.participants.filter((p) => p.plusOne).length)
                            .toString()
                            .padStart(2, '0')}{' '}
                          <small>persone ({s.participants.filter((p) => p.plusOne).length} collaboratori)</small>
                        </strong>
                      </span>
                    </div>
                    <div>
                      <FileText />
                      <span>
                        Fascicoli discussi
                        <strong>
                          {completed.toString().padStart(2, '0')}{' '}
                          <small>su {s.participants.filter((p) => !p.spectator).length}</small>
                        </strong>
                      </span>
                    </div>
                    <div>
                      <LockKeyhole />
                      <span>
                        Il verdetto
                        <strong className="word-stat">{s.phase === 'results' ? 'Svelato' : 'Top secret'}</strong>
                      </span>
                    </div>
                  </section>
                  <section className="live-panel">
                    <div className="section-top">
                      <span className="eyebrow">
                        <i className="dot" /> IL PUNTO DELLA SITUAZIONE
                      </span>
                      <span className="phase-badge">{phaseNames[s.phase]}</span>
                    </div>
                    <div className="live-body">
                      <div className="live-copy">
                        <span className="mono">
                          {round
                            ? 'FASCICOLO ATTIVO / ' + String(s.rounds.length).padStart(3, '0')
                            : 'NESSUN FASCICOLO APERTO'}
                        </span>
                        <h2>
                          {person
                            ? person.role || displayName(person)
                            : s.phase === 'results'
                              ? 'Ci sono delle conclusioni.'
                              : 'La parola al prossimo sospettato.'}
                        </h2>
                        <p>
                          {person ? (
                            <>
                              <strong>{displayName(person)}</strong>
                              {person.role ? ` · ${person.role}` : ''}
                            </>
                          ) : s.phase === 'results' ? (
                            'Il congresso ha parlato. Svela una categoria alla volta.'
                          ) : (
                            'Scegli chi vuole presentare. L’ordine lo decide la serata.'
                          )}
                        </p>
                        <div className="primary-actions">
                          {s.phase === 'presenting' && (
                            <Button
                              disabled={busy || !connected}
                              onClick={() => void perform({ type: 'phase', phase: 'questions', roundId: round!.id })}
                            >
                              Passa al question time <MessageCircle size={18} />
                            </Button>
                          )}
                          {s.phase === 'questions' && (
                            <Button
                              disabled={busy || !connected}
                              onClick={() => setConfirm({ type: 'phase', phase: 'voting', roundId: round!.id })}
                            >
                              Apri il voto per {person ? displayName(person) : ''}
                              <ArrowRight size={18} />
                            </Button>
                          )}
                          {s.phase === 'voting' && (
                            <>
                              <Button
                                disabled={busy || !connected}
                                onClick={() => setConfirm({ type: 'phase', phase: 'waiting', roundId: round!.id })}
                              >
                                Chiudi la votazione <LockKeyhole size={18} />
                              </Button>
                              <span className="vote-tally">{countVotes(s)} voti ricevuti</span>
                            </>
                          )}
                          {s.phase === 'waiting' && (
                            <a className="button" href="#relatori">
                              Scegli un ricercatore
                              <ArrowRight size={18} />
                            </a>
                          )}
                          {s.phase === 'results' && (
                            <Button onClick={() => setTab('premi')}>
                              Vai al verdetto
                              <Trophy size={18} />
                            </Button>
                          )}
                        </div>
                        {round && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => setConfirm({ type: 'cancel', roundId: round.id })}
                          >
                            Annulla questo turno
                          </button>
                        )}
                      </div>
                      <div className="dossier-art" aria-hidden="true">
                        <div className="art-paper">
                          <span>ARCHIVIO RISERVATO</span>
                          <Eye strokeWidth={1} />
                          <strong>
                            Non è una
                            <br />
                            coincidenza.
                          </strong>
                          <div className="art-lines" />
                          <em>PROVA 001</em>
                        </div>
                        <div className="art-tape" />
                        <span className="art-cross">chi c’era davvero?</span>
                        <svg className="art-strings" viewBox="0 0 248 208" preserveAspectRatio="none">
                          <line x1="74" y1="34" x2="196" y2="48" />
                          <line x1="74" y1="34" x2="150" y2="158" />
                          <line x1="196" y1="48" x2="150" y2="158" />
                          <circle cx="74" cy="34" r="5" />
                          <circle cx="196" cy="48" r="5" />
                          <circle cx="150" cy="158" r="5" />
                        </svg>
                      </div>
                    </div>
                    <div className="phase-track">
                      {(['presenting', 'questions', 'voting', 'waiting'] as const).map((phase, i) => (
                        <div key={phase} className={s.phase === phase ? 'current' : ''}>
                          <span>{String(i + 1).padStart(2, '0')}</span>
                          {['Presentazione', 'Question time', 'Votazione', 'Prossimo turno'][i]}
                          {i < 3 && <ChevronRight size={14} />}
                        </div>
                      ))}
                    </div>
                  </section>
                  {me && <GmOwnTurn s={s} actor={actor} busy={busy} perform={perform} />}
                  <div className="lower-grid">
                    <section className="panel" id="relatori">
                      <div className="panel-heading">
                        <div>
                          <p className="eyebrow">CHI HA QUALCOSA DA DIRE?</p>
                          <h2>I ricercatori</h2>
                        </div>
                        <button className="text-button" onClick={() => setTab('fascicoli')}>
                          Tutti i fascicoli <ArrowUpRight size={16} />
                        </button>
                      </div>
                      <People s={s} onSelect={setSelected} onEdit={setEditing} />
                    </section>
                    <aside className="side-notes">
                      <div className="note-card">
                        <span className="note-number">PROMEMORIA N. 01</span>
                        <CircleHelp size={26} />
                        <h3>
                          Prima le domande.
                          <br />
                          Poi i giudizi.
                        </h3>
                        <p>Il question time è dal vivo. Quando è finito, apri tu la votazione.</p>
                      </div>
                      <div className="quiet-card">
                        <Monitor size={22} />
                        <div>
                          <h3>La sala è pronta?</h3>
                          <p>Apri lo schermo del congresso sul proiettore.</p>
                          <button className="text-button" onClick={() => setScreen(true)}>
                            Apri vista proiettore <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="integration-note">
                        <span className="dot amber" /> Collegamento Slides da aggiungere.
                        <br />
                        Puoi provare tutta la serata senza.
                      </div>
                    </aside>
                  </div>
                </>
              )}
              {tab === 'fascicoli' && <InvitePanel />}
              {tab === 'fascicoli' && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">L’ARCHIVIO DEL CONGRESSO</p>
                      <h2>Ricercatori e infiltrati</h2>
                    </div>
                    <Button
                      secondary
                      disabled={s.phase !== 'waiting'}
                      onClick={() => setEditing({ ...blank, id: crypto.randomUUID() })}
                    >
                      <Plus size={17} />
                      Aggiungi un nome
                    </Button>
                  </div>
                  <People
                    s={s}
                    onSelect={setSelected}
                    onEdit={setEditing}
                    onRelease={(p) => setConfirm({ type: 'release', participantId: p.id })}
                    onRemove={(p) => setConfirm({ type: 'remove', participantId: p.id })}
                    onAdmit={(p, admission) => void perform({ type: 'participant', participant: { ...p, admission } })}
                    all
                  />
                  <p className="footnote">
                    Gli ospiti si iscrivono da soli con il link d’invito e completano il fascicolo dal telefono. Tu puoi
                    correggere tutto da qui.
                    {api.live
                      ? ' Se qualcuno ha scelto il nome sbagliato, usa “Libera” e fallo rientrare.'
                      : ' Nella versione collegata potrai liberare un nome scelto per errore.'}
                  </p>
                </section>
              )}
              {tab === 'premi' && (
                <>
                  {s.phase !== 'results' && <AwardSettings s={s} busy={busy} perform={perform} />}
                  <Results s={s} />
                  <div className="result-actions">
                    {s.phase === 'waiting' && (
                      <Button disabled={busy || !completed} onClick={() => setConfirm({ type: 'reveal' })}>
                        Inizia il reveal
                        <Trophy size={18} />
                      </Button>
                    )}
                    {s.phase === 'results' && s.revealed < 4 && (
                      <Button disabled={busy} onClick={() => void perform({ type: 'nextAward' })}>
                        Svela la prossima categoria
                        <ArrowRight size={18} />
                      </Button>
                    )}
                    {s.phase === 'results' && (
                      <Button secondary onClick={download}>
                        <Download size={17} />
                        Esporta risultati
                      </Button>
                    )}
                  </div>
                  <p className="footnote">
                    A pari merito vince chi non ha ancora un premio; se nessuno o tutti ne hanno già uno, il premio è
                    condiviso. Le medie si confrontano senza arrotondare.
                  </p>
                </>
              )}
              <footer>
                <span>LA VERITÀ È QUI DENTRO. FORSE.</span>
                <span>SERATA COMPLOTTI / N. 001</span>
                {!api.live && (
                  <button
                    onClick={() => {
                      if (window.confirm('Cancellare tutti i turni e i voti della demo?')) {
                        api.resetDemo();
                        setTab('regia');
                      }
                    }}
                  >
                    Ricomincia la demo
                  </button>
                )}
              </footer>
            </>
          )}
        </main>
      </div>
      {selected && (
        <Modal title="Apriamo questo fascicolo?" onClose={() => setSelected(null)}>
          <p className="eyebrow">IL PROSSIMO RELATORE</p>
          <h3 className="modal-talk">{displayName(selected)}</h3>
          <p>{selected.role || 'Titolo da ricercatore non pervenuto'}</p>
          <p className="footnote">
            {selected.mode === 'paper'
              ? 'Presentazione dal vivo: niente slide, sul proiettore restano nome e titolo.'
              : selected.mode === 'slides' && selected.deckUrl
                ? 'Presentazione con slide. Per ora il deck si apre a mano sul computer del proiettore.'
                : selected.mode === 'slides'
                  ? 'Ha scelto le slide ma non ha lasciato il link: fatti dare il deck prima di iniziare.'
                  : 'Non ha ancora detto come presenta. Chiediglielo prima di iniziare.'}
          </p>
          {dossierGaps(selected).length > 0 && (
            <p className="award-reason">Fascicolo incompleto: manca {dossierGaps(selected).join(', ')}.</p>
          )}
          <Button disabled={busy} onClick={() => void perform({ type: 'start', participantId: selected.id })}>
            Inizia con {displayName(selected)}
            <Play size={17} />
          </Button>
        </Modal>
      )}
      {editing && (
        <Editor
          participant={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(p) => void perform({ type: 'participant', participant: p })}
        />
      )}
      {confirm && (
        <Modal
          title={
            confirm.type === 'cancel'
              ? 'Annullare il turno?'
              : confirm.type === 'release'
                ? 'Liberare questo nome?'
                : confirm.type === 'remove'
                  ? 'Eliminare questa persona?'
                  : confirm.type === 'reveal'
                    ? 'È il momento della verità?'
                    : confirm.type === 'phase' && confirm.phase === 'voting'
                      ? 'Aprire la votazione?'
                      : 'Chiudere la votazione?'
          }
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm.type === 'cancel'
              ? 'Il turno e gli eventuali voti verranno esclusi. Il ricercatore tornerà disponibile.'
              : confirm.type === 'remove'
                ? `${s.participants.find((p) => p.id === confirm.participantId)?.name} sparirà dal registro, con i suoi turni e voti, e il suo telefono verrà scollegato. Non si può annullare.`
                : confirm.type === 'release'
                  ? `Il telefono che ha scelto ${s.participants.find((p) => p.id === confirm.participantId)?.name} verrà scollegato. I voti già dati restano salvati; la persona giusta potrà rientrare con questo nome.`
                  : confirm.type === 'reveal'
                    ? `Le regole dei premi verranno bloccate${s.settings.maxAwards ? ` (massimo ${s.settings.maxAwards} per persona)` : ''}. La serata passa al reveal finale.`
                    : confirm.type === 'phase' && confirm.phase === 'voting'
                      ? `Si voterà per ${person ? displayName(person) : ''}.`
                      : 'Dopo la chiusura non sarà più possibile inviare o modificare i voti.'}
          </p>
          <Button disabled={busy} onClick={() => void perform(confirm)}>
            Conferma
            <Check size={18} />
          </Button>
        </Modal>
      )}
    </div>
  );
}
function People({
  s,
  onSelect,
  onEdit,
  onRelease,
  onAdmit,
  onRemove,
  all = false,
}: {
  s: State;
  onSelect: (p: Participant) => void;
  onEdit: (p: Participant) => void;
  onRelease?: (p: Participant) => void;
  onRemove?: (p: Participant) => void;
  onAdmit?: (p: Participant, a: Admission) => void;
  all?: boolean;
}) {
  return (
    <div className="people-list">
      {s.participants
        .filter((p) => all || !p.spectator)
        .map((p, i) => {
          const done = s.rounds.some((r) => r.presenterId === p.id && r.closed && !r.cancelled),
            active = presenter(s)?.id === p.id,
            used = s.rounds.some((r) => r.presenterId === p.id && !r.cancelled);
          return (
            <article className={'person-row ' + (done ? 'person-done' : '')} key={p.id}>
              <div className={'person-avatar color-' + (i % 4)}>{p.name.slice(0, 1)}</div>
              <div className="person-info">
                <h3>
                  {p.name}
                  {active && <span className="tiny-status">In corso</span>}
                  {done && <Check size={14} />}
                </h3>
                <p>{p.role || 'Titolo da ricercatore mancante'}</p>
                <span>
                  {p.mode === 'none' ? 'Solo pubblico' : ''}
                  {p.mode && p.mode !== 'none' && (
                    <em className="mode-tag">{modes.find((m) => m.key === p.mode)?.short}</em>
                  )}
                  {p.plusOne && <em className="mode-tag">+1</em>}
                  {dossierGaps(p).length > 0 && <em className="mode-tag todo">Fascicolo incompleto</em>}
                </span>
                {onAdmit && (
                  <select
                    className={'admit-select ' + (p.admission ?? 'pending')}
                    aria-label={'Ammissione di ' + p.name}
                    value={p.admission ?? 'pending'}
                    onChange={(e) => onAdmit(p, e.target.value as Admission)}
                  >
                    <option value="pending">In attesa</option>
                    <option value="admitted">Ammesso</option>
                    <option value="reserve">Riserva</option>
                  </select>
                )}
              </div>
              {all ? (
                <div className="row-actions">
                  {onRelease && s.claimed?.includes(p.id) && (
                    <button className="choose-button" aria-label={'Libera ' + p.name} onClick={() => onRelease(p)}>
                      <LockKeyholeOpen size={14} /> Libera
                    </button>
                  )}
                  {onRemove && (
                    <button
                      className="icon-button"
                      aria-label={'Elimina ' + p.name}
                      disabled={presenter(s)?.id === p.id}
                      onClick={() => onRemove(p)}
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label={'Modifica ' + p.name}
                    disabled={s.phase === 'results' || presenter(s)?.id === p.id}
                    onClick={() => onEdit(p)}
                  >
                    <Pencil size={17} />
                  </button>
                </div>
              ) : (
                <button
                  className="choose-button"
                  disabled={used || p.spectator || s.phase !== 'waiting'}
                  onClick={() => onSelect(p)}
                >
                  {done ? 'Concluso' : active ? 'In corso' : 'Scegli'}
                  {!used && <ArrowRight size={15} />}
                </button>
              )}
            </article>
          );
        })}
    </div>
  );
}
function Guest({
  s,
  actor,
  busy,
  perform,
}: {
  s: State;
  actor: Actor;
  busy: boolean;
  perform: (a: Action) => Promise<boolean>;
}) {
  const p = presenter(s),
    r = activeRound(s),
    me = s.participants.find((p) => p.id === actor.participantId);
  if (s.phase === 'results')
    return (
      <>
        <p className="eyebrow">IL CONGRESSO HA PARLATO</p>
        <h1>Il verdetto.</h1>
        <Results s={s} />
      </>
    );
  const blocker = voteBlocker(s, actor.participantId);
  if (s.phase === 'voting' && r && !blocker)
    return <Voting key={r.id} s={s} actor={actor} busy={busy} perform={perform} />;
  // Before the first talk the page is the guest's registration dossier.
  if (s.phase === 'waiting' && s.rounds.length === 0)
    return <DossierHome s={s} actor={actor} busy={busy} perform={perform} />;
  return (
    <>
      <div className="guest-welcome">
        <span className="eyebrow">SEI DENTRO. NON DIRLO A NESSUNO.</span>
        <span className="guest-id">{me ? displayName(me) : ''}</span>
      </div>
      <section className="guest-stage">
        <span className="phase-badge">{phaseNames[s.phase]}</span>
        <Mark large />
        <h1>
          {s.phase === 'waiting'
            ? 'Apri la mente. Non troppo, che entra il 5G.'
            : s.phase === 'questions'
              ? 'Fatti delle domande.'
              : s.phase === 'voting'
                ? 'Ora parlano gli altri.'
                : r?.presenterId === actor.participantId
                  ? 'La parola è tua. Svegliali.'
                  : 'Ascolta. Prendi appunti. Non fidarti di nessuno.'}
        </h1>
        <p>
          {s.phase === 'waiting'
            ? 'Il prossimo ricercatore sta per farsi avanti. Questa pagina si aggiorna da sola (sì, è inquietante).'
            : s.phase === 'voting'
              ? `${blocker ?? ''} Aspetta che la regia chiuda il turno.`
              : s.phase === 'questions'
                ? 'Alza la mano e fai la tua domanda scomoda dal vivo. Il voto arriva dopo.'
                : r?.presenterId === actor.participantId
                  ? me?.mode === 'paper'
                    ? 'Presenti dal vivo: niente slide, tutto carisma. Sul proiettore ci sono il tuo nome e il tuo titolo.'
                    : 'Stai presentando. Il telecomando delle slide arriverà qui.'
                  : 'Tra poco potrai emettere il tuo verdetto insindacabile.'}
        </p>
        {p && (
          <div className="guest-dossier">
            <span className="mono">FASCICOLO ATTIVO</span>
            <h2>{displayName(p)}</h2>
            <span>{p.role || 'Titolo top secret'}</span>
          </div>
        )}
        {r?.presenterId === actor.participantId && s.phase === 'presenting' && me?.mode !== 'paper' && (
          <div className="slide-placeholder">
            <Button secondary disabled>
              <ArrowLeft size={18} />
              Precedente
            </Button>
            <Button secondary disabled>
              Successiva
              <ArrowRight size={18} />
            </Button>
            <small>Telecomando Slides non ancora collegato</small>
          </div>
        )}
      </section>
      {s.phase === 'waiting' && <DossierHome s={s} actor={actor} busy={busy} perform={perform} compact />}
    </>
  );
}
function Voting({
  s,
  actor,
  busy,
  perform,
}: {
  s: State;
  actor: Actor;
  busy: boolean;
  perform: (a: Action) => Promise<boolean>;
}) {
  const r = activeRound(s)!,
    p = presenter(s)!,
    saved = s.votes.find((v) => v.roundId === r.id && v.voterId === actor.participantId);
  const [draft, setDraft] = useState<Partial<Ballot>>(saved ?? {}),
    [dirty, setDirty] = useState(false);
  const complete = categories.every((c) => draft[c.key] !== undefined);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await perform({ type: 'vote', roundId: r.id, ballot: draft as Ballot });
  }
  return (
    <form className="voting-form" onSubmit={submit}>
      <p className="eyebrow">IL TUO VERDETTO / VOTO RISERVATO</p>
      <h1>Convinto o confuso?</h1>
      <div className="ballot-person">
        <span>
          Stai votando per <strong>{displayName(p)}</strong>
        </span>
        <h2>{p.role}</h2>
      </div>
      {saved && (
        <p className="saved-banner" role="status">
          <Check size={17} />
          {dirty ? 'Voto salvato. Hai modifiche da inviare.' : 'Voto salvato. Puoi modificarlo fino alla chiusura.'}
        </p>
      )}
      {categories.slice(0, 3).map((c, i) => (
        <fieldset key={c.key}>
          <legend>
            <span>0{i + 1}</span>
            {c.title}
          </legend>
          <p>{c.description}</p>
          <div className="score-options" role="group" aria-label={c.label}>
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                aria-pressed={draft[c.key] === n}
                onClick={() => {
                  setDraft({ ...draft, [c.key]: n });
                  setDirty(true);
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="scale-labels">
            <span>Per niente</span>
            <span>Assolutamente</span>
          </div>
        </fieldset>
      ))}
      <fieldset>
        <legend>
          <span>04</span>BONUS SUPERCAZZOLA
        </legend>
        <p>La risposta al question time era una supercazzola degna di questo nome?</p>
        <div className="yes-no">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={draft.supercazzola === v}
              onClick={() => {
                setDraft({ ...draft, supercazzola: v });
                setDirty(true);
              }}
            >
              {v ? 'Sì, come se fosse antani.' : 'No, troppo sensata.'}
            </button>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={!complete || busy}>
        {busy ? 'Salvataggio…' : saved ? 'Aggiorna il voto' : 'Consegna il verdetto'}
        <Check size={18} />
      </Button>
      <p className="footnote">
        Tutte le risposte sono obbligatorie. I punteggi restano segreti fino al reveal, come tutto il resto.
      </p>
    </form>
  );
}
const fmt = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 2 });
const list = (names: string[]) =>
  names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
function Results({ s }: { s: State }) {
  const all = awards(s);
  return (
    <div className="awards-grid">
      {all.map((award, i) => {
        const c = category(award.key),
          open = s.phase === 'results' && i < s.revealed,
          unit = award.key === 'supercazzola' ? ' sì' : ' / 10';
        return (
          <section className={'award-card ' + (open ? 'award-open' : '')} key={award.key}>
            <span className="mono">CATEGORIA 0{i + 1}</span>
            {open ? <Trophy size={27} /> : <LockKeyhole size={27} />}
            <h2>{c.title}</h2>
            {!open ? (
              <p>Il verdetto è ancora sotto chiave.</p>
            ) : (
              <>
                {award.winners.length ? (
                  <div className="award-winner">
                    <span className="mono">{award.outcome === 'shared' ? 'PARI MERITO' : 'IL PREMIO VA A'}</span>
                    <strong>{list(award.winners.map(displayName))}</strong>
                    <small>
                      {fmt(award.value!)}
                      {unit}
                    </small>
                  </div>
                ) : (
                  <p>
                    {award.rows.length ? 'Nessun premio assegnato in questa categoria.' : 'Nessun intervento concluso.'}
                  </p>
                )}
                {award.outcome === 'tieBreak' && (
                  <p className="award-reason">
                    Pari merito con {list(award.passedOver.map(displayName))},{' '}
                    {award.passedOver.length > 1 ? 'che hanno' : 'che ha'} già un premio: vince chi non ne ha ancora.
                  </p>
                )}
                {award.capped.length > 0 && (
                  <p className="award-reason">
                    {list(award.capped.map(displayName))} {award.capped.length > 1 ? 'hanno' : 'ha'} già raggiunto il
                    massimo di premi per persona.
                  </p>
                )}
                {award.rows.length > 0 && (
                  <ol>
                    {award.rows.map((row) => (
                      <li key={row.participant.id}>
                        <span>
                          {displayName(row.participant)}
                          <small>{row.count} voti</small>
                        </span>
                        <strong>
                          {row.value === null ? '—' : fmt(row.value)}
                          <small>{unit}</small>
                        </strong>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
function AwardSettings({ s, busy, perform }: { s: State; busy: boolean; perform: (a: Action) => Promise<boolean> }) {
  const current = s.settings;
  const save = (patch: Partial<Settings>) => void perform({ type: 'settings', settings: { ...current, ...patch } });
  const move = (i: number, by: number) => {
    const order = [...current.awardOrder];
    [order[i], order[i + by]] = [order[i + by], order[i]];
    save({ awardOrder: order });
  };
  const isDefault = JSON.stringify(current) === JSON.stringify(defaultSettings());
  return (
    <section className="panel award-settings">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">REGOLE PROVVISORIE · DA CONFERMARE</p>
          <h2>Come si assegnano i premi</h2>
        </div>
        <SlidersHorizontal size={22} />
      </div>
      <div className="settings-grid">
        <label>
          Premi massimi per persona
          <select
            aria-label="Premi massimi per persona"
            value={current.maxAwards ?? ''}
            disabled={busy}
            onChange={(e) => save({ maxAwards: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Nessun limite</option>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={current.spectatorsVote}
            disabled={busy}
            onChange={(e) => save({ spectatorsVote: e.target.checked })}
          />
          Anche il pubblico senza presentazione vota
        </label>
        <div className="order-list" role="group" aria-label="Ordine del reveal">
          <span>Ordine del reveal</span>
          <ol>
            {current.awardOrder.map((key, i) => (
              <li key={key}>
                <span>
                  <small>0{i + 1}</small> {category(key).title}
                </span>
                <span>
                  <button
                    className="icon-button"
                    aria-label={'Anticipa ' + category(key).label}
                    disabled={busy || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={'Posticipa ' + category(key).label}
                    disabled={busy || i === current.awardOrder.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="footnote">
        L’ordine conta: spareggi e limite guardano i premi già svelati. {isDefault ? 'Impostazioni iniziali.' : ''} Le
        regole si bloccano all’inizio del reveal.
      </p>
    </section>
  );
}
/** Shown in the GM view when the GM also has a name: their ballot, or their presenter controls. */
function GmOwnTurn({
  s,
  actor,
  busy,
  perform,
}: {
  s: State;
  actor: Actor;
  busy: boolean;
  perform: (a: Action) => Promise<boolean>;
}) {
  const r = activeRound(s),
    me = s.participants.find((p) => p.id === actor.participantId)!;
  if (s.phase === 'voting' && r && !voteBlocker(s, me.id))
    return (
      <section className="panel gm-own-turn">
        <Voting key={r.id} s={s} actor={actor} busy={busy} perform={perform} />
      </section>
    );
  if (s.phase === 'presenting' && r?.presenterId === me.id)
    return (
      <section className="panel gm-own-turn">
        <p className="eyebrow">STAI PRESENTANDO TU, {displayName(me).toUpperCase()}</p>
        <div className="slide-placeholder">
          <Button secondary disabled>
            <ArrowLeft size={18} />
            Precedente
          </Button>
          <Button secondary disabled>
            Successiva
            <ArrowRight size={18} />
          </Button>
          <small>Telecomando Slides non ancora collegato</small>
        </div>
      </section>
    );
  return null;
}
function Projector({ s }: { s: State }) {
  const p = presenter(s);
  return (
    <div className="projector">
      <div className="projector-top">
        <span className="mono">SERATA COMPLOTTI / CONGRESSO N. 001</span>
        <button
          className="icon-button"
          aria-label="Schermo intero"
          onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}
        >
          <Maximize size={20} />
        </button>
      </div>
      {s.phase === 'results' ? (
        <>
          <p className="eyebrow">IL MOMENTO DELLA VERITÀ</p>
          <h1>Il verdetto.</h1>
          <Results s={s} />
        </>
      ) : (
        <>
          {s.phase === 'waiting' && <Stamp sub="Non divulgare">Top secret</Stamp>}
          <Mark large />
          <p className="eyebrow">{phaseNames[s.phase].toUpperCase()}</p>
          <div className="codeline">
            <span>FASC. {String(s.rounds.length).padStart(3, '0')}</span>
            <i />
            <span>RISERVATO</span>
          </div>
          <h1>
            {s.phase === 'waiting'
              ? 'Nulla è come sembra.'
              : s.phase === 'questions'
                ? 'Fate le domande giuste.'
                : s.phase === 'voting'
                  ? 'Ai posteri il verdetto.'
                  : p?.role || (p ? displayName(p) : '')}
          </h1>
          <div className="codeline">
            <span>{p ? 'RELATORE' : 'IN ATTESA'}</span>
            <i />
            <span>CONGRESSO N. 001</span>
          </div>
          <p>
            {p ? `${displayName(p)}${p.role ? ', ' + p.role.toLowerCase() : ''}` : 'Il congresso sta per cominciare.'}
          </p>
          {s.phase === 'presenting' && (
            <p className="projector-note">
              {p?.mode === 'paper'
                ? 'Presentazione dal vivo. Guardate il ricercatore, non lo schermo: lo schermo vi guarda già.'
                : 'Le slide si aprono separatamente in questa alpha.'}
            </p>
          )}
          {s.phase === 'voting' && <span className="phase-badge">Vota dal tuo telefono</span>}
        </>
      )}
    </div>
  );
}
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button autoFocus className="modal-close icon-button" aria-label="Chiudi" onClick={onClose}>
          <X size={20} />
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
function Editor({
  participant,
  busy,
  onClose,
  onSave,
}: {
  participant: Participant;
  busy: boolean;
  onClose: () => void;
  onSave: (p: Participant) => void;
}) {
  const [p, setP] = useState(participant);
  return (
    <Modal title="Il fascicolo personale" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(p);
        }}
      >
        <label>
          Nome
          <input required value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </label>
        <label>
          Titolo da ricercatore
          <input value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })} />
        </label>
        <label>
          Come presenta
          <select
            value={p.mode ?? ''}
            onChange={(e) => setP({ ...p, mode: (e.target.value || null) as Participant['mode'] })}
          >
            <option value="">Non ancora deciso</option>
            {modes.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {p.mode === 'slides' && (
          <label>
            Link Google Slides
            <input type="url" value={p.deckUrl} onChange={(e) => setP({ ...p, deckUrl: e.target.value })} />
          </label>
        )}
        <label>
          Collaboratore (+1)
          <select
            value={p.plusOne == null ? '' : p.plusOne ? 'si' : 'no'}
            onChange={(e) => setP({ ...p, plusOne: e.target.value === '' ? null : e.target.value === 'si' })}
          >
            <option value="">Non ancora detto</option>
            <option value="si">Sì, porta un collaboratore</option>
            <option value="no">No, viene da solo</option>
          </select>
        </label>
        <Button type="submit" disabled={busy}>
          Salva fascicolo
          <Check size={17} />
        </Button>
      </form>
    </Modal>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
