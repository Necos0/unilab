import supabase from './supabaseClient.js';

/*
 * `register_player` が返したプレイヤー ID を保存する localStorage のキー。
 * エピローグ「つづく…」を見終えたときに `mark_cleared` へ渡す。
 */
const USER_ID_STORAGE_KEY = 'unilab.player.remoteId';

/* 「今日」の区切りに使うタイムゾーン（日本時間の 0 時で日付が変わる）。 */
const DAY_TIME_ZONE = 'Asia/Tokyo';

/* 日本時間の UTC オフセット（ISO 8601 表記）。 */
const DAY_UTC_OFFSET = '+09:00';

/**
 * 保存済みのプレイヤー ID を読む。
 *
 * Returns:
 *     string | null: 登録済みならプレイヤー ID、無ければ null。
 */
function loadUserId() {
  try {
    return localStorage.getItem(USER_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * プレイヤー ID を保存する（null なら削除する）。
 *
 * Args:
 *     userId (string | null): 保存するプレイヤー ID。
 */
function saveUserId(userId) {
  try {
    if (userId) localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    else localStorage.removeItem(USER_ID_STORAGE_KEY);
  } catch {
    /* 永続化できなくてもゲームは続けられるので無視する */
  }
}

/**
 * ニックネームを登録し、開始時間つきでプレイヤーを作る。
 *
 * 名前入力の確定時に呼ぶ。以前の ID は先に消しておき、登録に失敗した
 * 場合に前のプレイヤーのクリアとして記録されないようにする。通信の
 * 失敗はゲーム進行に影響させず、コンソールに出すだけにする。
 *
 * Args:
 *     nickname (string): 入力されたニックネーム。
 *
 * Returns:
 *     Promise<void>: 登録処理の完了。
 */
export async function registerPlayer(nickname) {
  saveUserId(null);
  if (!supabase) return;
  const { data, error } = await supabase.rpc('register_player', {
    p_nickname: nickname,
  });
  if (error) {
    console.error('[clearRecord] register_player failed', error);
    return;
  }
  saveUserId(data);
}

/**
 * 登録済みのプレイヤーをクリア済みにする（エピローグ「つづく…」を見終えたときに呼ぶ）。
 *
 * ニックネーム未登録（ID なし）や接続未設定なら何もしない。同じ
 * プレイヤーが 2 回クリアしてもサーバー側で最初の 1 回だけが記録される。
 *
 * Returns:
 *     Promise<void>: 送信処理の完了。
 */
export async function markCleared() {
  const userId = loadUserId();
  if (!supabase || !userId) return;
  const { error } = await supabase.rpc('mark_cleared', { p_user_id: userId });
  if (error) console.error('[clearRecord] mark_cleared failed', error);
}

/**
 * 保存済みのプレイヤー ID を消す（開発用の全リセットから呼ぶ）。
 */
export function forgetPlayer() {
  saveUserId(null);
}

/**
 * 日本時間で「今日」が始まった瞬間を返す。
 *
 * Args:
 *     now (Date): 基準の時刻。
 *
 * Returns:
 *     Date: 日本時間の今日 0 時。
 */
export function getTodayStart(now = new Date()) {
  /* sv-SE ロケールは YYYY-MM-DD 形式で日付を返す。 */
  const day = now.toLocaleDateString('sv-SE', { timeZone: DAY_TIME_ZONE });
  return new Date(`${day}T00:00:00${DAY_UTC_OFFSET}`);
}

/**
 * 今日クリアしたプレイヤーをクリアの早い順に取得する。
 *
 * Returns:
 *     Promise<Array<{id: string, nickname: string, started_at: string,
 *         cleared_at: string}>>:
 *         今日クリアしたプレイヤーの一覧。
 *
 * Raises:
 *     Error: 接続未設定、または取得に失敗したとき。
 */
export async function fetchTodayClears() {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('users')
    .select('id, nickname, started_at, cleared_at')
    .gte('cleared_at', getTodayStart().toISOString())
    .order('cleared_at', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * クリアした全プレイヤーを取得する（タイトルの「クリア者一覧」用）．
 *
 * `fetchTodayClears` と同型だが，今日フィルタをかけず `cleared_at` が入って
 * いる行をすべて（上限 limit）返す．並びはクリア時刻の昇順（順位付けは
 * 呼び出し側がクリアタイムの速い順で行う）．
 *
 * Args:
 *     limit (number): 取得する最大件数（既定 1000）．
 *
 * Returns:
 *     Promise<Array<{id: string, nickname: string, started_at: string,
 *         cleared_at: string}>>: クリアした全プレイヤー．
 *
 * Raises:
 *     Error: 接続未設定、または取得に失敗したとき。
 */
export async function fetchAllClears(limit = 1000) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('users')
    .select('id, nickname, started_at, cleared_at')
    .not('cleared_at', 'is', null)
    .order('cleared_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * プレイヤーがクリアしたときに通知を受け取る。
 *
 * Args:
 *     onClear (function(Object): void): クリアした行（id・nickname・
 *         started_at・cleared_at を含む）を受け取るコールバック。
 *     onStatus (function(string): void): 購読状態（`SUBSCRIBED` など）を
 *         受け取るコールバック。切断からの復帰時の再取得に使う。
 *
 * Returns:
 *     function(): void: 購読を解除する関数。
 */
export function subscribeClears(onClear, onStatus) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('clear-screen')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'users' },
      (payload) => {
        if (payload.new?.cleared_at) onClear(payload.new);
      },
    )
    .subscribe((status) => onStatus(status));
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Supabase の接続情報が設定されているか。
 *
 * Returns:
 *     boolean: 設定済みなら true。
 */
export function isClearRecordEnabled() {
  return supabase !== null;
}
