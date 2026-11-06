-- 集計スクリーン（/screen）の表示確認用テストデータ。
--
-- SQL Editor で「1. 追加」を実行するとテスト用のプレイヤーが入り、
-- 確認が終わったら「2. 削除」を実行して消す。テスト行はニックネームが
-- 「てすと」で始まるもので見分ける（本番のプレイヤーに同じ名前の人が
-- いないことを確認してから削除すること）。

-- ============================================================
-- 1. 追加
-- ============================================================

-- 今日クリアした 30 人（スクロールが動く人数）。
-- 1 分おきにクリアし、クリアタイムは 8 分〜40 分程度でばらつかせる。
insert into public.users (nickname, started_at, cleared_at)
select
  'てすと' || lpad(i::text, 2, '0'),
  now() - (i * interval '1 minute') - ((8 + (i * 7) % 33) * interval '1 minute') - ((i * 13) % 60) * interval '1 second',
  now() - (i * interval '1 minute')
from generate_series(1, 30) as i;

-- プレイ中（未クリア）の 3 人。スクリーンには出ない。
insert into public.users (nickname, started_at)
select 'てすとぷれい' || i, now() - (i * interval '5 minute')
from generate_series(1, 3) as i;

-- 昨日クリアした 2 人。今日の集計には入らない。
insert into public.users (nickname, started_at, cleared_at)
select
  'てすときのう' || i,
  now() - interval '1 day' - interval '30 minute',
  now() - interval '1 day'
from generate_series(1, 2) as i;

-- ============================================================
-- 2. 削除（確認が終わったらこちらだけ実行する）
-- ============================================================

-- delete from public.users where nickname like 'てすと%';

-- ============================================================
-- 3. 1 人だけクリアさせる（「クリア おめでとう！」演出の確認）
-- ============================================================

-- /screen を開いた状態でこれだけ実行すると、Realtime で届いて演出が出る。
-- 実行するたびに 1 人増える。消すときは「2. 削除」でまとめて消える。
-- （「1. 追加」を画面を開いたまま実行すると 30 人ぶん順番に演出が出るので、
--   先に追加してから /screen を開くとよい）

-- insert into public.users (nickname, started_at, cleared_at)
-- values ('てすとおめでとう', now() - interval '12 minute 34 second', now());
