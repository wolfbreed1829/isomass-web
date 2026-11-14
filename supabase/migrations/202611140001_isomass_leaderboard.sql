create table if not exists public.isomass_players (
  id uuid primary key, name text not null check (char_length(name) between 3 and 24),
  name_key text not null unique, password_salt text not null, password_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.isomass_sessions (
  token_hash text primary key, player_id uuid not null references public.isomass_players(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists isomass_sessions_expiry on public.isomass_sessions(expires_at);
create table if not exists public.isomass_attempts (
  id uuid primary key, player_id uuid not null references public.isomass_players(id) on delete cascade,
  challenge_id text not null check(challenge_id in ('equal','focus','restore')),
  rule_version integer not null default 1 check(rule_version=1),
  moves integer not null check(moves between 0 and 1000), score integer not null check(score between 70 and 100),
  trace_hash text not null, created_at timestamptz not null default now()
);
create table if not exists public.isomass_bests (
  player_id uuid not null references public.isomass_players(id) on delete cascade,
  challenge_id text not null, attempt_id uuid not null references public.isomass_attempts(id) on delete cascade,
  score integer not null, moves integer not null, updated_at timestamptz not null default now(),
  primary key(player_id, challenge_id)
);
create table if not exists public.isomass_rate_limits (
  key text not null, bucket bigint not null, hits integer not null, expires_at timestamptz not null,
  primary key(key,bucket)
);
alter table public.isomass_players enable row level security;
alter table public.isomass_sessions enable row level security;
alter table public.isomass_attempts enable row level security;
alter table public.isomass_bests enable row level security;
alter table public.isomass_rate_limits enable row level security;
revoke all on public.isomass_players,public.isomass_sessions,public.isomass_attempts,public.isomass_bests,public.isomass_rate_limits from anon,authenticated;
grant all on public.isomass_players,public.isomass_sessions,public.isomass_attempts,public.isomass_bests,public.isomass_rate_limits to service_role;

create or replace function public.isomass_take_rate_limit(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare current_bucket bigint; current_hits integer;
begin
  if p_limit<1 or p_seconds<1 then return false; end if;
  current_bucket:=floor(extract(epoch from now())/p_seconds);
  delete from isomass_rate_limits where expires_at<now();
  insert into isomass_rate_limits(key,bucket,hits,expires_at)
  values(p_key,current_bucket,1,to_timestamp((current_bucket+1)*p_seconds))
  on conflict(key,bucket) do update set hits=isomass_rate_limits.hits+1
  returning hits into current_hits;
  return current_hits<=p_limit;
end $$;

create or replace function public.isomass_submit_score(p_id uuid,p_player_id uuid,p_challenge text,p_moves integer,p_trace_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare minimum_moves integer; points integer; existing isomass_attempts%rowtype;
begin
  minimum_moves:=case p_challenge when 'equal' then 3 when 'focus' then 0 when 'restore' then 2 else null end;
  if minimum_moves is null or p_moves<minimum_moves or p_moves>1000 then raise exception 'Invalid run' using errcode='22023'; end if;
  points:=70+greatest(0,30-5*(p_moves-minimum_moves));
  insert into isomass_attempts(id,player_id,challenge_id,moves,score,trace_hash)
    values(p_id,p_player_id,p_challenge,p_moves,points,p_trace_hash) on conflict(id) do nothing;
  select * into existing from isomass_attempts where id=p_id;
  if existing.player_id<>p_player_id or existing.challenge_id<>p_challenge or existing.trace_hash<>p_trace_hash then
    raise exception 'Attempt identifier already used' using errcode='23505';
  end if;
  insert into isomass_bests(player_id,challenge_id,attempt_id,score,moves)
    values(p_player_id,p_challenge,p_id,points,p_moves)
    on conflict(player_id,challenge_id) do update set attempt_id=excluded.attempt_id,score=excluded.score,moves=excluded.moves,updated_at=now()
    where excluded.score>isomass_bests.score or (excluded.score=isomass_bests.score and excluded.moves<isomass_bests.moves);
  return jsonb_build_object('id',existing.id,'score',existing.score,'moves',existing.moves,'completedAt',existing.created_at);
end $$;

create or replace view public.isomass_rankings as
with totals as (
  select p.id as player_id,p.name,p.name_key,sum(b.score)::integer as total,count(*)::integer as completed,
    max(b.score) filter(where b.challenge_id='equal') as equal,
    max(b.score) filter(where b.challenge_id='focus') as focus,
    max(b.score) filter(where b.challenge_id='restore') as restore
  from public.isomass_players p join public.isomass_bests b on b.player_id=p.id
  group by p.id,p.name,p.name_key
) select rank() over(order by total desc)::integer as rank,totals.* from totals;
revoke all on public.isomass_rankings from anon,authenticated;
grant select on public.isomass_rankings to service_role;
revoke all on function public.isomass_take_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.isomass_submit_score(uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.isomass_take_rate_limit(text,integer,integer) to service_role;
grant execute on function public.isomass_submit_score(uuid,uuid,text,integer,text) to service_role;
