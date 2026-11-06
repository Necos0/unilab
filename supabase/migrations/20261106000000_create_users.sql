-- クリア集計スクリーン用のプレイヤーテーブル。
--
-- ゲーム側はテーブルへ直接書き込まず、下の RPC（register_player / mark_cleared）
-- だけを呼ぶ。スクリーン側はクリア済みの行だけを SELECT / Realtime で読む。

create table public.users (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 16),
  started_at timestamptz not null default now(),
  cleared_at timestamptz
);

comment on table public.users is 'ニックネーム入力時に登録し、4-4 クリア時に cleared_at を記録するプレイヤー';

create index users_cleared_at_idx on public.users (cleared_at)
  where cleared_at is not null;

alter table public.users enable row level security;

-- 直接の書き込みは禁止し、読み取りだけ許可する（行は RLS で絞る）。
revoke all on public.users from anon, authenticated;
grant select on public.users to anon, authenticated;

-- スクリーンに出すのはクリア済みのプレイヤーだけ。
create policy "cleared users are readable"
  on public.users for select
  to anon, authenticated
  using (cleared_at is not null);

-- ニックネーム入力時：プレイヤーを登録し、その id を返す。
create function public.register_player(p_nickname text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.users (nickname)
  values (trim(p_nickname))
  returning id;
$$;

-- 4-4 クリア時：未クリアなら cleared_at を記録する（2 回目以降は何もしない）。
create function public.mark_cleared(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users
     set cleared_at = now()
   where id = p_user_id
     and cleared_at is null;
$$;

revoke execute on function public.register_player(text) from public;
revoke execute on function public.mark_cleared(uuid) from public;
grant execute on function public.register_player(text) to anon, authenticated;
grant execute on function public.mark_cleared(uuid) to anon, authenticated;

-- スクリーンがクリアを即時に受け取れるよう Realtime の配信対象に加える。
alter publication supabase_realtime add table public.users;
