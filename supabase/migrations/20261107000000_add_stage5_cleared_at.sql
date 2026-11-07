-- ステージ5（5-4）のクリアを記録する列と RPC。
--
-- 本編クリア（cleared_at）とは別に、おまけのステージ5を最後まで遊んだ
-- 人数を数えるために使う。スクリーンには出さず、SQL で集計する。
--
--   select count(*) from public.users where stage5_cleared_at is not null;

alter table public.users add column stage5_cleared_at timestamptz;

comment on column public.users.stage5_cleared_at is '5-4 を初めてクリアした時刻';

-- 5-4 クリア時：未記録なら stage5_cleared_at を記録する（2 回目以降は何もしない）。
create function public.mark_stage5_cleared(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users
     set stage5_cleared_at = now()
   where id = p_user_id
     and stage5_cleared_at is null;
$$;

revoke execute on function public.mark_stage5_cleared(uuid) from public;
grant execute on function public.mark_stage5_cleared(uuid) to anon, authenticated;
