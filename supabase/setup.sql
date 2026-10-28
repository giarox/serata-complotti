-- Complotto1: run once in a new project. Preserves existing objects/data on rerun.
-- This is the app backend. Slides commands are intentionally deferred.
-- Safe to rerun after updates: tables keep their data, functions are replaced.
-- Anonymous sign-ins must be enabled in Supabase Authentication settings.
begin;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.party_store (
 id boolean primary key default true check(id),
 state jsonb not null,
 guest_hash text not null,
 gm_hash text not null
);
create table if not exists public.party_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('gm','guest')),
 person_id text unique
);
-- A GM may also have a name (they present and vote); a guest always has one.
alter table public.party_members drop constraint if exists party_members_check;
alter table public.party_members drop constraint if exists party_members_person_required;
alter table public.party_members add constraint party_members_person_required check(role='gm' or person_id is not null);
create table if not exists public.party_signal(id boolean primary key default true check(id), revision bigint not null default 0);
alter table public.party_store enable row level security;
alter table public.party_members enable row level security;
alter table public.party_signal enable row level security;
revoke all on public.party_store,public.party_members,public.party_signal from anon, authenticated;
grant select on public.party_signal to authenticated;
drop policy if exists "Members receive version notifications" on public.party_signal;
create policy "Members receive version notifications" on public.party_signal for select to authenticated using (true);
insert into public.party_signal(id) values(true) on conflict do nothing;
-- The test evening ("serata di prova") lives in row id=false of the same tables: real guests never see it.
alter table public.party_store drop constraint if exists party_store_id_check;
alter table public.party_signal drop constraint if exists party_signal_id_check;
insert into public.party_signal(id) values(false) on conflict do nothing;
alter table public.party_members add column if not exists sandbox boolean not null default false;
-- Slide commands for the helper on the projector Mac. One row per evening; only that evening's GM can read it.
create table if not exists public.party_slide(
 id boolean primary key,
 seq bigint not null default 0,
 log jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.party_slide enable row level security;
revoke all on public.party_slide from anon, authenticated;
grant select on public.party_slide to authenticated;
drop policy if exists "The evening's GM reads slide commands" on public.party_slide;
create or replace function public.party_is_gm_of(ev boolean) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.party_members m where m.user_id=auth.uid() and m.role='gm' and m.sandbox = not ev);
$$;
revoke all on function public.party_is_gm_of(boolean) from public, anon;
grant execute on function public.party_is_gm_of(boolean) to authenticated;
create policy "The evening's GM reads slide commands" on public.party_slide for select to authenticated
 using (public.party_is_gm_of(id));
insert into public.party_slide(id) values(true),(false) on conflict do nothing;

-- Dossier complete? Same rule as dossierGaps() in the app.
create or replace function public.party_ready(p jsonb) returns boolean language sql immutable as $$
 select coalesce(p->>'mode'='none',false) or (
  length(trim(coalesce(p->>'role','')))>0 and p->>'mode' in ('slides','paper')
  and (p->>'mode'<>'slides' or length(coalesce(p->>'deckUrl',''))>0));
$$;
-- Guests' password ignores case and spaces ("noncielodicono" works); the GM PIN is compared as typed.
create or replace function public.party_norm(t text) returns text language sql immutable as $$
 select upper(regexp_replace(coalesce(t,''),'\s','','g'));
$$;
-- What other guests see of someone who has not presented yet: name and readiness only.
-- "Tactical omissis": ~40% of the letters become a marker (never the first of a word); same arithmetic as censor() in src/domain.ts.
create or replace function public.party_censor(seed text, t text) returns text language sql immutable as $$
 with k as (select coalesce(sum(ascii(substr(seed,j,1))::bigint*j),0) s from generate_series(1,char_length(coalesce(seed,''))) j)
 select coalesce(string_agg(case when substr(t,i,1) ~ '[[:alpha:]]' and i>1 and substr(t,i-1,1) ~ '[[:alpha:]]' and ((k.s*31+i*i*7+i*131)%97)<42 then chr(9608) else substr(t,i,1) end, '' order by i),'')
 from k, generate_series(1,char_length(coalesce(t,''))) i;
$$;
create or replace function public.party_mask(p jsonb) returns jsonb language sql immutable as $$
 select jsonb_build_object('id',p->>'id','name',p->>'name','role',public.party_censor(p->>'id',coalesce(p->>'role','')),'title','','deckUrl','',
  'mode',p->'mode','spectator',coalesce((p->>'spectator')::boolean,false),'plusOne',coalesce(p->'plusOne','null'::jsonb),'partner',coalesce(p->'partner','null'::jsonb),'partnerName',public.party_censor((p->>'id')||'p',coalesce(p->>'partnerName','')),'admission',coalesce(p->'admission','"pending"'::jsonb),'masked',true,'ready',public.party_ready(p));
$$;
-- Which evening the caller belongs to: true = the real one, false = the test one.
create or replace function public.party_event() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select not m.sandbox from public.party_members m where m.user_id=auth.uid()), true);
$$;
-- Creates (or refreshes the GM PIN of) the test evening, starting empty.
create or replace function public.party_ensure_sandbox() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.party_store(id,state,guest_hash,gm_hash)
  select false, state||'{"participants":[],"rounds":[],"votes":[],"phase":"waiting","activeRoundId":null,"revealed":0}'::jsonb, guest_hash, gm_hash
  from public.party_store where id=true
 on conflict (id) do update set gm_hash=excluded.gm_hash;
 insert into public.party_signal(id) values(false) on conflict do nothing;
end; $$;
-- Queue one command for the helper (keeps the last 20 so quick taps are not lost).
create or replace function public.party_slide_push(ev boolean, cmd text, deck text default '') returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.party_slide(id) values(ev) on conflict do nothing;
 update public.party_slide set
  log = coalesce((select jsonb_agg(e order by (e->>'seq')::bigint) from (select e from jsonb_array_elements(log) e order by (e->>'seq')::bigint desc limit 19) x), '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object('seq', seq+1, 'cmd', cmd, 'deck', coalesce(deck,''))),
  seq = seq+1, updated_at = now()
 where id=ev;
end; $$;
create or replace function public.party_actor() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_strip_nulls(jsonb_build_object('role',role,'participantId',person_id)) from public.party_members where user_id=auth.uid();
$$;
drop function if exists public.party_names(text);
create or replace function public.party_names(passcode text, sandbox boolean default false) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare st public.party_store;
begin
 if auth.uid() is null then raise exception 'Accedi prima di entrare.'; end if;
 if sandbox then perform public.party_ensure_sandbox(); end if;
 select * into st from public.party_store where id=not sandbox;
 -- Open registration: guests send no word. A non-empty passcode is the GM PIN and must match.
 if not found or length(coalesce(passcode,''))>200 or (coalesce(trim(passcode),'')<>'' and extensions.crypt(trim(passcode),st.gm_hash) is distinct from st.gm_hash) then
  perform pg_sleep(1.5); raise exception 'Password non corretta.';
 end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','name',p->>'name')), '[]'::jsonb) from jsonb_array_elements(st.state->'participants') p);
end; $$;
drop function if exists public.party_join(text,text,boolean);
create or replace function public.party_join(passcode text, person_id text default null, as_gm boolean default false, sandbox boolean default false) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare st public.party_store; existing public.party_members; expected text;
begin
 if auth.uid() is null then raise exception 'Accedi prima di entrare.'; end if;
 if sandbox then perform public.party_ensure_sandbox(); end if;
 select * into st from public.party_store where id=not sandbox for update;
 if not found then raise exception 'Congresso non configurato.'; end if;
 expected:=case when as_gm then st.gm_hash else st.guest_hash end;
 if as_gm and (passcode is null or length(passcode)>200 or extensions.crypt(trim(passcode),expected) is distinct from expected) then
  perform pg_sleep(1.5); raise exception 'Password non corretta.';
 end if;
 select * into existing from public.party_members where user_id=auth.uid();
 if found then return jsonb_strip_nulls(jsonb_build_object('role',existing.role,'participantId',existing.person_id)); end if;
 if not as_gm and coalesce(person_id,'')='' then raise exception 'Scegli il tuo nome.'; end if;
 if coalesce(person_id,'')<>'' then
  if not exists(select 1 from jsonb_array_elements(st.state->'participants') p where p->>'id'=person_id) then raise exception 'Nome non disponibile.'; end if;
  if exists(select 1 from public.party_members m where m.person_id=party_join.person_id) then raise exception 'Nome già in uso. Chiedi alla regia di liberarlo.'; end if;
 end if;
 insert into public.party_members(user_id,role,person_id,sandbox) values(auth.uid(),case when as_gm then 'gm' else 'guest' end,nullif(person_id,''),party_join.sandbox);
 return public.party_actor();
end; $$;
create or replace function public.party_snapshot() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare s jsonb; actor jsonb; visible_votes jsonb; n integer;
begin
 actor:=public.party_actor();
 if actor is null then raise exception 'Entra nel congresso.'; end if;
 select state into s from public.party_store where id=public.party_event();
 select count(*) into n from jsonb_array_elements(s->'votes') v where v->>'roundId'=s->>'activeRoundId';
 select coalesce(jsonb_agg(v),'[]'::jsonb) into visible_votes from jsonb_array_elements(s->'votes') v
 where s->>'phase'='results' or v->>'voterId'=actor->>'participantId';
 s:=s || jsonb_build_object('votes',visible_votes,'voteCount',n);
 -- Guests: other people's titles and details stay secret until they present (or the reveal starts).
 if actor->>'role'='guest' and s->>'phase'<>'results' then
  s:=jsonb_set(s,'{participants}',(select coalesce(jsonb_agg(
   case when p->>'id'=actor->>'participantId'
     or exists(select 1 from jsonb_array_elements(s->'rounds') r where r->>'presenterId'=p->>'id' and not coalesce((r->>'cancelled')::boolean,false))
   then p else public.party_mask(p) end order by ord),'[]'::jsonb)
   from jsonb_array_elements(s->'participants') with ordinality t(p,ord)));
 end if;
 -- Only the GM learns which names are taken, so a mistaken pick can be released.
 if actor->>'role'='gm' then
  s:=s || jsonb_build_object('claimed',(select coalesce(jsonb_agg(person_id),'[]'::jsonb) from public.party_members where role='guest' and sandbox = not public.party_event()));
 end if;
 return s || jsonb_build_object('sandbox', not public.party_event());
end; $$;
drop function if exists public.party_check_identity(jsonb,text,text,text);
-- Free-form name; duplicates allowed (two Giulia are fine).
create or replace function public.party_check_name(nm text) returns void language plpgsql immutable as $$
begin
 if length(nm)<2 or length(nm)>40 then raise exception 'Scrivi il tuo nome (da 2 a 40 caratteri).'; end if;
end; $$;
create or replace function public.party_action(command jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s jsonb; actor jsonb; kind text; phase text; rid text; r jsonb; p jsonb; ballot jsonb; votes jsonb; rounds jsonb; field text; cfg jsonb; voter jsonb; pid text; nm text; md text; prev jsonb; ev boolean;
begin
 actor:=public.party_actor(); if actor is null then raise exception 'Entra nel congresso.'; end if;
 ev:=public.party_event();
 select state into s from public.party_store where id=ev for update;
 kind:=command->>'type'; phase:=s->>'phase'; rid:=s->>'activeRoundId';
 select v into r from jsonb_array_elements(s->'rounds') v where v->>'id'=rid;
 if kind is null or kind not in ('start','phase','cancel','vote','reveal','nextAward','participant','release','remove','settings','back','reset','addBots','botVotes','slide') then raise exception 'Operazione non riconosciuta.'; end if;
 if kind not in ('vote','participant','slide') and actor->>'role'<>'gm' then raise exception 'Solo la regia può fare questa operazione.'; end if;
 if kind='slide' then
  if phase<>'presenting' or r is null then raise exception 'Le slide si cambiano solo durante la presentazione.'; end if;
  if actor->>'role'<>'gm' and actor->>'participantId' is distinct from r->>'presenterId' then raise exception 'Solo chi presenta può cambiare slide.'; end if;
  if command->>'dir' is null or command->>'dir' not in ('next','prev') then raise exception 'Comando non valido.'; end if;
  perform public.party_slide_push(ev, command->>'dir');
  return;
 end if;
 if kind='start' then
  if phase<>'waiting' then raise exception 'Concludi il turno prima di iniziarne un altro.'; end if;
  select v into p from jsonb_array_elements(s->'participants') v where v->>'id'=command->>'participantId';
  if p is null or (p->>'spectator')::boolean or exists(select 1 from jsonb_array_elements(s->'rounds') v where v->>'presenterId'=p->>'id' and not coalesce((v->>'cancelled')::boolean,false)) then raise exception 'Questo ricercatore non è disponibile.'; end if;
  rid:=gen_random_uuid()::text;
  s:=s||jsonb_build_object('phase','presenting','activeRoundId',rid,'rounds',(s->'rounds')||jsonb_build_array(jsonb_build_object('id',rid,'presenterId',p->>'id','closed',false)));
  if p->>'mode'='slides' and coalesce(p->>'deckUrl','')<>'' then perform public.party_slide_push(ev, 'open', p->>'deckUrl'); end if;
 elsif kind in ('phase','cancel') then
  if r is null or command->>'roundId' is distinct from rid or (r->>'closed')::boolean then raise exception 'Il turno è cambiato.'; end if;
  if phase='presenting' then perform public.party_slide_push(ev, 'close'); end if;
  if kind='cancel' then
   r:=r||'{"closed":true,"cancelled":true}'::jsonb;
   select coalesce(jsonb_agg(v),'[]'::jsonb) into votes from jsonb_array_elements(s->'votes') v where v->>'roundId'<>rid;
   s:=s||jsonb_build_object('phase','waiting','activeRoundId',null,'votes',votes);
  else
   if not ((phase='presenting' and command->>'phase'='questions') or (phase='questions' and command->>'phase'='voting') or (phase='voting' and command->>'phase'='waiting')) then raise exception 'Questo passaggio non è disponibile.'; end if;
   s:=jsonb_set(s,'{phase}',command->'phase');
   if command->>'phase'='waiting' then r:=r||'{"closed":true}'::jsonb; s:=jsonb_set(s,'{activeRoundId}','null'::jsonb); end if;
  end if;
  select jsonb_agg(case when v->>'id'=rid then r else v end order by ord) into rounds from jsonb_array_elements(s->'rounds') with ordinality as t(v,ord);
  s:=jsonb_set(s,'{rounds}',rounds);
 elsif kind='vote' then
  if actor->>'participantId' is null then raise exception 'Scegli il tuo nome per votare.'; end if;
  select v into voter from jsonb_array_elements(s->'participants') v where v->>'id'=actor->>'participantId';
  if voter is null then raise exception 'Scegli il tuo nome per votare.'; end if;
  if phase<>'voting' or r is null or command->>'roundId' is distinct from rid or (r->>'closed')::boolean then raise exception 'Questa votazione è chiusa.'; end if;
  if r->>'presenterId'=actor->>'participantId' then raise exception 'Non puoi votare il tuo intervento.'; end if;
  if (voter->>'spectator')::boolean and coalesce((s->'settings'->>'spectatorsVote')::boolean,true)=false then raise exception 'In questa serata il pubblico non vota.'; end if;
  ballot:=command->'ballot';
  if ballot is null or jsonb_typeof(ballot)<>'object' then raise exception 'Completa tutti i voti.'; end if;
  foreach field in array array['credibility','delivery','research'] loop
   if jsonb_typeof(ballot->field) is distinct from 'number' then raise exception 'Inserisci tre voti interi da 0 a 10.'; end if;
   if (ballot->>field)::numeric<0 or (ballot->>field)::numeric>10 or trunc((ballot->>field)::numeric)<>(ballot->>field)::numeric then raise exception 'Inserisci tre voti interi da 0 a 10.'; end if;
  end loop;
  if jsonb_typeof(ballot->'supercazzola') is distinct from 'boolean' then raise exception 'Scegli sì o no per la Supercazzola.'; end if;
  -- Construct only allowed fields; never accept client-supplied voter or round identities.
  ballot:=jsonb_build_object('credibility',ballot->'credibility','delivery',ballot->'delivery','research',ballot->'research','supercazzola',ballot->'supercazzola','roundId',rid,'voterId',actor->>'participantId');
  select coalesce(jsonb_agg(v),'[]'::jsonb) into votes from jsonb_array_elements(s->'votes') v where not(v->>'roundId'=rid and v->>'voterId'=actor->>'participantId');
  s:=jsonb_set(s,'{votes}',votes||jsonb_build_array(ballot));
 elsif kind='reset' then
  -- GM only: start the evening over. With everyone=true the register is emptied and guest phones unlinked.
  s:=s||jsonb_build_object('rounds','[]'::jsonb,'votes','[]'::jsonb,'activeRoundId',null,'phase','waiting','revealed',0);
  if coalesce((command->>'everyone')::boolean,false) then
   s:=jsonb_set(s,'{participants}','[]'::jsonb);
   delete from public.party_members where role='guest' and sandbox = not ev;
   update public.party_members set person_id=null where role='gm' and sandbox = not ev;
  end if;
 elsif kind in ('addBots','botVotes') and ev then
  raise exception 'I tester finti esistono solo nella serata di prova.';
 elsif kind='addBots' then
  select coalesce(jsonb_agg(jsonb_build_object('id','tester-'||substr(md5(gen_random_uuid()::text),1,8),
    'name',(array['Rettiliano','Terrapiattista','Lunare','Fluorato','Illuminato','Del 5G','Scie chimiche','Cugino NASA'])[1+((g+jsonb_array_length(s->'participants'))%8)]||' (tester)',
    'role','Tester certificato da nessuno','title','','deckUrl',case when g%2=0 then '' else 'https://docs.google.com/presentation/d/1wvHnevCRC5ULS4f80JO2EwpmQth2vts3zyAKK9SNJso/edit?usp=sharing' end,'mode',case when g%2=0 then 'paper' else 'slides' end,'spectator',false,
    'plusOne',false,'partner',null,'partnerName','','admission','admitted','bot',true)),'[]'::jsonb)
   into rounds from generate_series(1,least(greatest(coalesce((command->>'n')::int,4),1),8)) g;
  s:=jsonb_set(s,'{participants}',(s->'participants')||rounds);
 elsif kind='botVotes' then
  if phase<>'voting' or r is null then raise exception 'Apri prima una votazione.'; end if;
  select coalesce(jsonb_agg(v),'[]'::jsonb) into votes from jsonb_array_elements(s->'votes') v
   where not (v->>'roundId'=rid and exists(select 1 from jsonb_array_elements(s->'participants') b where b->>'id'=v->>'voterId' and coalesce((b->>'bot')::boolean,false)));
  select votes||coalesce(jsonb_agg(jsonb_build_object('credibility',floor(random()*11)::int,'delivery',floor(random()*11)::int,'research',floor(random()*11)::int,
    'supercazzola',random()<0.5,'roundId',rid,'voterId',b->>'id')),'[]'::jsonb)
   into votes from jsonb_array_elements(s->'participants') b where coalesce((b->>'bot')::boolean,false) and b->>'id'<>r->>'presenterId';
  s:=jsonb_set(s,'{votes}',votes);
 elsif kind='back' then
  if phase='questions' then
   s:=jsonb_set(s,'{phase}','"presenting"'::jsonb);
   select v into p from jsonb_array_elements(s->'participants') v where v->>'id'=r->>'presenterId';
   if p->>'mode'='slides' and coalesce(p->>'deckUrl','')<>'' then perform public.party_slide_push(ev, 'open', p->>'deckUrl'); end if;
  elsif phase='voting' then s:=jsonb_set(s,'{phase}','"questions"'::jsonb);
  elsif phase='results' then s:=s||'{"phase":"waiting","revealed":0}'::jsonb;
  elsif phase='waiting' then
   select v into r from jsonb_array_elements(s->'rounds') with ordinality t(v,ord) where not coalesce((v->>'cancelled')::boolean,false) order by ord desc limit 1;
   if r is null or not coalesce((r->>'closed')::boolean,false) then raise exception 'Non c''è niente da riaprire.'; end if;
   rid:=r->>'id';
   select jsonb_agg(case when v->>'id'=rid then v||'{"closed":false}'::jsonb else v end order by ord) into rounds from jsonb_array_elements(s->'rounds') with ordinality t(v,ord);
   s:=s||jsonb_build_object('rounds',rounds,'activeRoundId',rid,'phase','voting');
  else raise exception 'Per tornare indietro dalla presentazione, annulla il turno.';
  end if;
 elsif kind='reveal' then
  if phase<>'waiting' or not exists(select 1 from jsonb_array_elements(s->'rounds') v where (v->>'closed')::boolean and not coalesce((v->>'cancelled')::boolean,false)) then raise exception 'Completa almeno un turno e chiudi il voto.'; end if;
  s:=s||'{"phase":"results","revealed":1}'::jsonb;
 elsif kind='nextAward' then
  if phase<>'results' or (s->>'revealed')::int>=4 then raise exception 'Non ci sono altre categorie da svelare.'; end if;
  s:=jsonb_set(s,'{revealed}',to_jsonb((s->>'revealed')::int+1));
 elsif kind='release' then
  if not exists(select 1 from jsonb_array_elements(s->'participants') v where v->>'id'=command->>'participantId') then raise exception 'Nome non trovato.'; end if;
  delete from public.party_members where person_id=command->>'participantId' and role='guest';
 elsif kind='remove' then
  -- GM only (checked above): the person disappears with their turns and votes, and their phone is unlinked.
  pid:=command->>'participantId';
  if not exists(select 1 from jsonb_array_elements(s->'participants') v where v->>'id'=pid) then raise exception 'Nome non trovato.'; end if;
  if r is not null and not (r->>'closed')::boolean and r->>'presenterId'=pid then raise exception 'Sta presentando: chiudi o annulla il turno prima.'; end if;
  select coalesce(jsonb_agg(v order by ord),'[]'::jsonb) into rounds from jsonb_array_elements(s->'participants') with ordinality t(v,ord) where v->>'id'<>pid;
  s:=jsonb_set(s,'{participants}',rounds);
  select coalesce(jsonb_agg(v->'id'),'[]'::jsonb) into prev from jsonb_array_elements(s->'rounds') v where v->>'presenterId'=pid;
  select coalesce(jsonb_agg(v order by ord),'[]'::jsonb) into rounds from jsonb_array_elements(s->'rounds') with ordinality t(v,ord) where v->>'presenterId'<>pid;
  s:=jsonb_set(s,'{rounds}',rounds);
  select coalesce(jsonb_agg(v order by ord),'[]'::jsonb) into votes from jsonb_array_elements(s->'votes') with ordinality t(v,ord) where v->>'voterId'<>pid and not prev ? (v->>'roundId');
  s:=jsonb_set(s,'{votes}',votes);
  if phase='results' and not exists(select 1 from jsonb_array_elements(s->'rounds') v where (v->>'closed')::boolean and not coalesce((v->>'cancelled')::boolean,false)) then
   s:=s||'{"phase":"waiting","revealed":0}'::jsonb;
  end if;
  delete from public.party_members where person_id=pid and role='guest';
  update public.party_members set person_id=null where person_id=pid and role='gm';
 elsif kind='settings' then
  if phase='results' then raise exception 'Le regole non si cambiano durante il reveal.'; end if;
  cfg:=command->'settings';
  if cfg is null or jsonb_typeof(cfg)<>'object'
   or not (jsonb_typeof(cfg->'maxAwards')='null' or (jsonb_typeof(cfg->'maxAwards')='number' and (cfg->>'maxAwards')::numeric in (1,2,3,4)))
   or jsonb_typeof(cfg->'spectatorsVote') is distinct from 'boolean'
   or jsonb_typeof(cfg->'awardOrder') is distinct from 'array' or jsonb_array_length(cfg->'awardOrder')<>4
   or (select count(distinct k) from jsonb_array_elements_text(cfg->'awardOrder') k where k in ('credibility','delivery','research','supercazzola'))<>4
  then raise exception 'Regole dei premi non valide.'; end if;
  s:=s||jsonb_build_object('settings',jsonb_build_object('maxAwards',cfg->'maxAwards','awardOrder',cfg->'awardOrder','spectatorsVote',cfg->'spectatorsVote'));
 elsif kind='participant' then
  -- Guests may edit only their own dossier; the GM may edit or add anyone.
  p:=command->'participant';
  if p is null or jsonb_typeof(p)<>'object' then raise exception 'Fascicolo non valido.'; end if;
  pid:=p->>'id';
  if pid is null or length(pid)=0 or length(pid)>80 then raise exception 'Fascicolo non valido.'; end if;
  select v into prev from jsonb_array_elements(s->'participants') v where v->>'id'=pid;
  if actor->>'role'<>'gm' and (prev is null or pid is distinct from actor->>'participantId') then raise exception 'Questo fascicolo non è tuo.'; end if;
  nm:=regexp_replace(trim(coalesce(p->>'name','')),'\s+',' ','g');
  perform public.party_check_name(nm);
  if length(coalesce(p->>'role',''))>80 or length(coalesce(p->>'title',''))>120 then raise exception 'Troppo lungo: i veri complotti stanno in una riga.'; end if;
  md:=p->>'mode';
  if md is not null and md not in ('slides','paper','none') then raise exception 'Modo di presentare sconosciuto.'; end if;
  if md='slides' and length(trim(coalesce(p->>'deckUrl','')))>0 and trim(p->>'deckUrl') !~ '^https://docs[.]google[.]com/presentation/' then raise exception 'Quello non sembra un link di Google Slides. Deve iniziare con https://docs.google.com/presentation/'; end if;
  if prev is not null then
   if phase='results' then raise exception 'La serata è finita: i fascicoli sono agli atti.'; end if;
   if r is not null and not (r->>'closed')::boolean and r->>'presenterId'=pid then raise exception 'Stai presentando: il fascicolo si modifica dopo.'; end if;
   if actor->>'role'<>'gm' and exists(select 1 from jsonb_array_elements(s->'rounds') v where v->>'presenterId'=pid and not coalesce((v->>'cancelled')::boolean,false)) then raise exception 'Hai già presentato: il fascicolo è agli atti.'; end if;
   if md='none' and exists(select 1 from jsonb_array_elements(s->'rounds') v where v->>'presenterId'=pid and not coalesce((v->>'cancelled')::boolean,false)) then raise exception 'Ha già presentato: non può diventare solo pubblico.'; end if;
  end if;
  p:=jsonb_build_object('id',pid,'name',nm,'role',trim(coalesce(p->>'role','')),'title',trim(coalesce(p->>'title','')),
    'deckUrl',case when md='slides' then trim(coalesce(p->>'deckUrl','')) else '' end,'mode',to_jsonb(md),'spectator',coalesce(md='none',false),
    'plusOne',case when p->>'partner' in ('witness','copresenter') then 'true'::jsonb when jsonb_typeof(p->'plusOne')='boolean' then p->'plusOne' else 'null'::jsonb end,
    'partner',case when p->>'partner' in ('witness','copresenter') then p->'partner' else 'null'::jsonb end,
    'partnerName',case when p->>'partner' in ('witness','copresenter') then to_jsonb(left(regexp_replace(trim(coalesce(p->>'partnerName','')),'\s+',' ','g'),40)) else '""'::jsonb end,
    -- Only the GM decides who is in; guests keep whatever was decided.
    'admission',case when actor->>'role'='gm' and p->>'admission' in ('pending','admitted','reserve') then p->'admission' else coalesce(prev->'admission','"pending"'::jsonb) end,
    'bot',coalesce(prev->'bot','false'::jsonb));
  if prev is not null then
   select jsonb_agg(case when v->>'id'=pid then p else v end order by ord) into rounds from jsonb_array_elements(s->'participants') with ordinality t(v,ord);
  else rounds:=(s->'participants')||jsonb_build_array(p); end if;
  s:=jsonb_set(s,'{participants}',rounds);
 end if;
 s:=jsonb_set(s,'{revision}',to_jsonb((s->>'revision')::int+1));
 update public.party_store set state=s where id=ev;
 update public.party_signal set revision=(s->>'revision')::bigint where id=ev;
end; $$;
-- Self-registration from the invite: event password + name. Nothing else is needed to book a slot.
drop function if exists public.party_register(text,text,text);
drop function if exists public.party_register(text,text);
create or replace function public.party_register(passcode text, full_name text, sandbox boolean default false) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare st public.party_store; existing public.party_members; nm text; pid text; s jsonb;
begin
 if auth.uid() is null then raise exception 'Accedi prima di entrare.'; end if;
 if sandbox then perform public.party_ensure_sandbox(); end if;
 select * into st from public.party_store where id=not sandbox for update;
 if not found then raise exception 'Congresso non configurato.'; end if;
 -- Open registration: whoever has the link can sign up (passcode is ignored).
 select * into existing from public.party_members where user_id=auth.uid();
 if found then return public.party_actor(); end if;
 nm:=regexp_replace(trim(coalesce(full_name,'')),'\s+',' ','g');
 perform public.party_check_name(nm);
 s:=st.state;
 if s->>'phase'='results' then raise exception 'La serata è finita: il registro è chiuso.'; end if;
 pid:=left(trim(both '-' from regexp_replace(translate(lower(nm),'àáâäèéêëìíîïòóôöùúûüç','aaaaeeeeiiiioooouuuuc'),'[^a-z0-9]+','-','g')),30);
 pid:=coalesce(nullif(pid,''),'agente')||'-'||substr(md5(gen_random_uuid()::text),1,4);
 s:=jsonb_set(s,'{participants}',(s->'participants')||jsonb_build_array(jsonb_build_object('id',pid,'name',nm,'role','','title','','deckUrl','','mode',null,'spectator',false,'plusOne',null,'partner',null,'partnerName','','admission','pending')));
 s:=jsonb_set(s,'{revision}',to_jsonb((s->>'revision')::int+1));
 update public.party_store set state=s where id=not sandbox;
 update public.party_signal set revision=(s->>'revision')::bigint where id=not sandbox;
 insert into public.party_members(user_id,role,person_id,sandbox) values(auth.uid(),'guest',pid,party_register.sandbox);
 return public.party_actor();
end; $$;
revoke all on function public.party_actor(),public.party_event(),public.party_ensure_sandbox(),public.party_names(text,boolean),public.party_join(text,text,boolean,boolean),public.party_snapshot(),public.party_action(jsonb),public.party_register(text,text,boolean),public.party_ready(jsonb),public.party_mask(jsonb),public.party_censor(text,text),public.party_check_name(text),public.party_norm(text) from public,anon;
revoke all on function public.party_event(),public.party_ensure_sandbox(),public.party_slide_push(boolean,text,text) from public,anon,authenticated;
grant execute on function public.party_actor(),public.party_names(text,boolean),public.party_join(text,text,boolean,boolean),public.party_snapshot(),public.party_action(jsonb),public.party_register(text,text,boolean) to authenticated;
-- Only a harmless revision number is broadcast; no scores, names or passwords.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='party_signal') then
  alter publication supabase_realtime add table public.party_signal;
 end if;
end $$;
commit;

-- Next: run the private script made by `npm run make-init` (see supabase/README.md).
-- It inserts the starting roster and the hashed guest and GM passwords.
-- Never use the Supabase project/database password as an event access code.
