-- Run only in scripts/test-database.mjs's isolated, temporary PostgreSQL container.
insert into isomass_players(id,name,name_key,password_salt,password_hash) values
('00000000-0000-4000-8000-000000000001','Player A','player a','fixture','fixture'),
('00000000-0000-4000-8000-000000000002','Player B','player b','fixture','fixture');
do $$
declare p uuid; attempt uuid; item text; result jsonb; n integer;
begin
  foreach p in array array['00000000-0000-4000-8000-000000000001'::uuid,'00000000-0000-4000-8000-000000000002'::uuid] loop
    foreach item in array array['equal','focus','restore'] loop
      attempt:=gen_random_uuid();
      n:=case item when 'equal' then 3 when 'focus' then 0 else 2 end;
      result:=isomass_submit_score(attempt,p,item,n,'fixture-'||item);
      if (result->>'score')::integer<>100 then raise exception 'Perfect score failed'; end if;
      perform isomass_submit_score(attempt,p,item,n,'fixture-'||item);
    end loop;
  end loop;
  if (select count(*) from isomass_attempts)<>6 then raise exception 'Deduplication failed'; end if;
  if (select count(*) from isomass_rankings where total=300 and rank=1)<>2 then raise exception 'Total or ties failed'; end if;
  result:=isomass_submit_score(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','equal',100,'low-score');
  if (result->>'score')::integer<>70 then raise exception 'Score floor failed'; end if;
  if (select total from isomass_rankings where name='Player A')<>300 then raise exception 'Best score regressed'; end if;
  begin
    perform isomass_submit_score(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','equal',2,'invalid');
    raise exception 'Invalid moves accepted';
  exception when sqlstate '22023' then null;
  end;
  if not isomass_take_rate_limit('test',1,60) or isomass_take_rate_limit('test',1,60) then raise exception 'Rate limit failed'; end if;
  if has_table_privilege('anon','isomass_players','SELECT') or has_table_privilege('authenticated','isomass_rankings','SELECT') then raise exception 'Private tables exposed'; end if;
  if has_function_privilege('anon','isomass_submit_score(uuid,uuid,text,integer,text)','EXECUTE') then raise exception 'Public RPC exposed'; end if;
  if (select count(*) from pg_class where relname in ('isomass_players','isomass_sessions','isomass_attempts','isomass_bests','isomass_rate_limits') and relrowsecurity)<>5 then raise exception 'RLS missing'; end if;
end $$;
