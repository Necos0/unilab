import { create } from 'zustand';

/*
 * プレイヤー名を保存する localStorage のキー。
 */
const STORAGE_KEY = 'unilab.player.name';

/**
 * localStorage からプレイヤー名を読み込む。
 *
 * 値が無い・localStorage が使えない（プライベートモード等）場合は空文字を
 * 返し、例外で初期化が止まらないようにする。空文字は「まだ名前を決めて
 * いない」状態を表し、表示側（`RoboBubble` など）が既定名へフォールバック
 * する。
 *
 * Returns:
 *     string: 保存済みのプレイヤー名。無ければ空文字。
 */
function loadPlayerName() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * プレイヤー名を localStorage へ保存する。
 *
 * localStorage が使えない環境では黙って無視する（永続化できなくても
 * セッション中は state で機能するため）。
 *
 * Args:
 *     name (string): 保存するプレイヤー名。
 */
function savePlayerName(name) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    /* 永続化不可でも致命的ではないので無視する */
  }
}

/**
 * プレイヤー名を管理する Zustand ストア。
 *
 * オープニングのフロチャロボとの会話（`opening-wake` カットシーンの
 * `nameInput` step）で入力した名前を保持し、localStorage に永続化する。
 * 吹き出し文言の `{playerName}` 置換（`RoboBubble`）はこのストアの値を
 * 最優先で使い、未入力（空文字）なら `player.json` の既定名へフォール
 * バックする。
 *
 * 状態:
 *   - `playerName` (string): 入力済みのプレイヤー名。未入力なら空文字。
 *
 * 公開アクション:
 *   - `setPlayerName(name)`: 名前を保存し localStorage へ永続化する。
 */
const usePlayerStore = create((set) => ({
  playerName: loadPlayerName(),

  /**
   * プレイヤー名を更新し、localStorage へ永続化する。
   *
   * Args:
   *     name (string): 新しいプレイヤー名（呼び出し側で trim 済みを想定）。
   */
  setPlayerName: (name) => {
    savePlayerName(name);
    set({ playerName: name });
  },
}));

export default usePlayerStore;
