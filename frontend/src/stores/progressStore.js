import { create } from 'zustand';
import stagesData from '../data/stages.json';
import parseStageId from '../features/map/parseStageId';
import getNextStageId from '../features/map/getNextStageId';

/**
 * ステージ解放・クリア進行状況を一元管理する Zustand ストア。
 *
 * 戦闘画面で `VictoryClearOverlay` の「マップへ戻る」ボタンが押されたとき
 * に `markStageCleared(stageId)` を呼び、クリア済みステージ ID 集合
 * （`clearedStageIds`）に追加する。同時に同ワールド内で番号が 1 大きい
 * 次ステージが存在し、かつ未だ解放されていなければ `pendingUnlockStageId`
 * にセットする。マップ画面再表示時に `MapScreen` の useEffect が
 * `pendingUnlockStageId` を検出して `startUnlockAnimation()` を呼ぶと、
 * `isUnlockAnimating=true` を立てて `UNLOCK_FADE_DURATION_MS` 後に
 * `finishUnlockAnimation()` を予約する。`Landmark` 側はこの 2 フラグを
 * 購読して、ロック表示のフェードアウトと全マップクリック抑止を行う。
 *
 * 解放状態（`isStageUnlocked`）は `clearedStageIds` からの派生計算で
 * 求める：`*-1` ステージは常に解放、それ以外は直前番号のステージが
 * `clearedStageIds` に含まれていれば解放。これにより「解放済み集合」を
 * 二重管理せずに済み、永続化を導入する際も `clearedStageIds` の保存だけ
 * で十分になる（要件 7-3 への配慮）。
 *
 * 公開アクション：
 *   - `markStageCleared(stageId)` : クリア記録の追加と次ステージ解放判定。
 *                                    重複は no-op（要件 3-2）。最終ステージ
 *                                    クリア時は `pendingUnlockStageId` を
 *                                    変更しない（要件 4-2）。
 *   - `startUnlockAnimation()`    : 解放アニメ開始。`isUnlockAnimating=true`
 *                                    にして `UNLOCK_FADE_DURATION_MS` 後に
 *                                    `finishUnlockAnimation()` を予約する。
 *   - `finishUnlockAnimation()`   : `pendingUnlockStageId=null`、
 *                                    `isUnlockAnimating=false` に戻す。
 *
 * 公開セレクタファクトリ：
 *   - `isStageClearedSelector(stageId)` : クリア済み判定
 *   - `isStageUnlockedSelector(stageId)`: 解放済み判定（派生）
 *   - `shouldShowLockSelector(stageId)` : ロック表示判定（未解放 OR
 *                                          pendingUnlock 対象）
 */

const UNLOCK_FADE_DURATION_MS = 1500;

const useProgressStore = create((set, get) => ({
  clearedStageIds: [],
  pendingUnlockStageId: null,
  isUnlockAnimating: false,
  unlockedWorlds: [],

  /**
   * ステージのクリアを記録し、必要なら次ステージ解放のフラグを立てる。
   *
   * `clearedStageIds` に既に含まれているなら何もしない（要件 3-2）。
   * 新規追加した場合は `getNextStageId` で次ステージを計算し、存在する
   * かつ未だ解放されていなければ `pendingUnlockStageId` にセットする
   * （要件 4-1）。次ステージが存在しないか既に解放済みなら
   * `pendingUnlockStageId` は変更しない（要件 4-2, 4-3）。
   *
   * Args:
   *     stageId (string): クリアしたステージ ID。
   */
  markStageCleared: (stageId) => {
    const state = get();
    if (state.clearedStageIds.includes(stageId)) {
      return;
    }
    const nextStageId = getNextStageId(stagesData, stageId);
    const wasUnlocked = nextStageId
      ? isStageUnlockedFromCleared(state.clearedStageIds, nextStageId)
      : false;
    set({
      clearedStageIds: [...state.clearedStageIds, stageId],
      pendingUnlockStageId:
        nextStageId && !wasUnlocked ? nextStageId : state.pendingUnlockStageId,
    });
  },

  /**
   * 解放アニメーションを開始する。
   *
   * `isUnlockAnimating` を `true` にし、`UNLOCK_FADE_DURATION_MS` 後に
   * `finishUnlockAnimation()` を呼ぶ `setTimeout` を予約する。CSS の
   * `transition-duration` と同じ定数を共有するため、JS とアニメの終了
   * タイミングが揃う。既にアニメ中の場合は no-op。
   */
  startUnlockAnimation: () => {
    if (get().isUnlockAnimating) {
      return;
    }
    set({ isUnlockAnimating: true });
    setTimeout(() => {
      get().finishUnlockAnimation();
    }, UNLOCK_FADE_DURATION_MS);
  },

  /**
   * 解放アニメーションの完了処理。
   *
   * `pendingUnlockStageId` を `null` に、`isUnlockAnimating` を `false` に
   * 戻す。`startUnlockAnimation` の `setTimeout` から呼び出される。
   */
  finishUnlockAnimation: () =>
    set({ pendingUnlockStageId: null, isUnlockAnimating: false }),

  /**
   * テスト用：全ステージと全ワールドを即座に解放する。
   *
   * `stages.json` の全ステージを走査し、各ステージの解放条件を満たす
   * ために必要な「直前ステージ」を `clearedStageIds` に追加する。
   * `*-1` は常に解放扱いのため、各ワールドの最終ステージ自体は
   * `cleared` 扱いにならず「未クリアだが解放済み」状態になる。
   * 同時に、全体マップ（`map_0`）の各領域＝ワールド単位の「ステージN」を
   * すべて解放するため、登場する全ワールド番号を `unlockedWorlds` に入れる。
   * 解放アニメは抑止したいので `pendingUnlockStageId` はリセットし、
   * `isUnlockAnimating` も `false` に戻す。
   */
  /**
   * クリア・解放の進行状況をすべて初期状態に戻す。開発・テスト用。
   *
   * `clearedStageIds` / `unlockedWorlds` を空にし、解放アニメ関連の
   * `pendingUnlockStageId` / `isUnlockAnimating` も `null` / `false` に戻す。
   * `unlockAllStages`（全解放）と対になる「全リセット」。
   */
  resetProgress: () =>
    set({
      clearedStageIds: [],
      unlockedWorlds: [],
      pendingUnlockStageId: null,
      isUnlockAnimating: false,
    }),

  unlockAllStages: () => {
    const predecessors = new Set();
    const worlds = new Set();
    for (const stageId of Object.keys(stagesData.stages)) {
      const parsed = parseStageId(stageId);
      if (!parsed) {
        continue;
      }
      worlds.add(parsed.world);
      if (parsed.number <= 1) {
        continue;
      }
      predecessors.add(`${parsed.world}-${parsed.number - 1}`);
    }
    set({
      clearedStageIds: Array.from(predecessors),
      unlockedWorlds: Array.from(worlds),
      pendingUnlockStageId: null,
      isUnlockAnimating: false,
    });
  },
}));

/**
 * `clearedStageIds` 配列のみから解放状態を派生計算する内部ヘルパー。
 *
 * `*-1` ステージは常に解放（要件 1-1, 4-4）。それ以外は直前番号の
 * ステージが `clearedStageIds` に含まれていれば解放扱い。`stages.json`
 * の存在確認は行わず、純粋に「直前クリア済みか」だけで判定する。
 *
 * Args:
 *     clearedStageIds (string[]): クリア済みステージ ID の配列。
 *     stageId (string): 判定対象ステージ ID。
 *
 * Returns:
 *     boolean: 解放されているなら `true`。
 */
function isStageUnlockedFromCleared(clearedStageIds, stageId) {
  const parsed = parseStageId(stageId);
  if (!parsed) {
    return false;
  }
  if (parsed.number === 1) {
    return true;
  }
  const prevId = `${parsed.world}-${parsed.number - 1}`;
  return clearedStageIds.includes(prevId);
}

/**
 * 指定ステージがクリア済みかを返すセレクタファクトリ。
 *
 * `useProgressStore(isStageClearedSelector("1-2"))` のように使う。
 *
 * Args:
 *     stageId (string): 判定対象ステージ ID。
 *
 * Returns:
 *     (state) => boolean: zustand セレクタ関数。
 */
export const isStageClearedSelector = (stageId) => (state) =>
  state.clearedStageIds.includes(stageId);

/**
 * 指定ステージが解放済みかを返すセレクタファクトリ。
 *
 * `clearedStageIds` から派生計算する。`*-1` は常に `true`、それ以外は
 * 直前番号がクリア済みなら `true`。
 *
 * Args:
 *     stageId (string): 判定対象ステージ ID。
 *
 * Returns:
 *     (state) => boolean: zustand セレクタ関数。
 */
export const isStageUnlockedSelector = (stageId) => (state) =>
  isStageUnlockedFromCleared(state.clearedStageIds, stageId);

/**
 * 指定ステージにロックオーバーレイを表示すべきかを返すセレクタファクトリ。
 *
 * 「未解放」または「解放アニメの対象（pendingUnlockStageId と一致）」
 * のときに `true` を返す。後者は解放アニメ中もフェードアウト中の
 * オーバーレイを表示し続けるため。
 *
 * Args:
 *     stageId (string): 判定対象ステージ ID。
 *
 * Returns:
 *     (state) => boolean: zustand セレクタ関数。
 */
export const shouldShowLockSelector = (stageId) => (state) =>
  !isStageUnlockedFromCleared(state.clearedStageIds, stageId) ||
  state.pendingUnlockStageId === stageId;

/**
 * 全体マップ（`map_0`）のワールド単位「ステージN」が解放済みかを判定する
 * 純関数。
 *
 * ワールド `1` は常に解放（各マップ内の `*-1` を常に解放扱いにするのと
 * 同じ思想）。それ以外は `unlockedWorlds` に番号が含まれていれば解放扱い。
 * 実プレイのクリア連動による解放はまだ実装しておらず、開発用 Space キー
 * （`unlockAllStages`）のみが 2 以降のワールドを解放する。
 *
 * Args:
 *     unlockedWorlds (string[]): 解放済みワールド番号（文字列）の配列。
 *     world (string|number): 判定対象ワールド番号。
 *
 * Returns:
 *     boolean: 解放されているなら `true`。
 */
export function isWorldUnlocked(unlockedWorlds, world) {
  const key = String(world);
  if (key === '1') {
    return true;
  }
  return unlockedWorlds.includes(key);
}

export { UNLOCK_FADE_DURATION_MS };
export default useProgressStore;
