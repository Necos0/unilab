import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import stagesData from '../data/stagesLoader.js';
import mapsData from '../data/maps.json';
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

/**
 * 指定ワールドの次ワールドが全体マップ（`map_0`）上に領域を持つかを判定する。
 *
 * 全体マップの各領域は `map_1`〜`map_4`（ワールド 1〜4）に対応する。ワールド
 * `W` の最終ステージをクリアしたとき、次ワールド `W+1` に対応する `map_{W+1}`
 * が `maps.json` に存在すれば「全体マップで解放できる次ワールドがある」と
 * みなす。最終ワールド（領域を持たないワールド、例: 5）の最終ステージでは
 * `false` になり、解放シネマを発火させない。
 *
 * Args:
 *     world (string|number): 現在のワールド番号。
 *
 * Returns:
 *     string | null: 次ワールド番号（文字列）。領域が無ければ `null`。
 */
function getNextUnlockableWorld(world) {
  const nextWorld = String(Number(world) + 1);
  if (Number.isNaN(Number(world))) {
    return null;
  }
  return mapsData.maps?.[`map_${nextWorld}`] ? nextWorld : null;
}

const useProgressStore = create(
  persist(
    (set, get) => ({
  clearedStageIds: [],
  pendingUnlockStageId: null,
  isUnlockAnimating: false,
  unlockedWorlds: [],
  pendingWorldUnlock: null,
  unlockingWorld: null,
  seenCardIds: [],
  seenSlotTypeIds: [],
  hasSeenOpeningStory: false,
  lastPosition: null,

  /**
   * マップ上の最後の位置を記録する（「続きから」再開用）。
   *
   * `mapStore` が位置の変わる瞬間（マップ初期化・マップ切替・移動 1 区間の
   * 確定）に呼ぶ。localStorage に永続化され、タイトル画面の「スタート」で
   * `App.handleStartGame` が読み出して、前回終了時にいたマップ・地点から
   * 再開させる。`locationId` は通常ランドマーク ID だが、移動途中で終了した
   * 場合は分岐点（junction）の ID になることもある。全体マップ（`map_0`、
   * `startId: null`）にいた場合は `locationId: null`。
   *
   * Args:
   *     mapId (string): 現在のマップ ID（例: `"map_1"`）。
   *     locationId (string|null): 現在立っているノード ID。
   */
  setLastPosition: (mapId, locationId) =>
    set({ lastPosition: { mapId, locationId: locationId ?? null } }),

  /**
   * オープニング紙芝居（`StoryScreen`）を最後まで見たことを記録する。
   *
   * カットシーンの `seenIds` と同様の視聴履歴で、`App` が紙芝居の完了時
   * （`handleStoryFinish`）に呼ぶ。以降タイトル画面で「スタート」を押しても
   * 紙芝居はスキップされ、マップへ直行する。localStorage に永続化される
   * ため、リロード後も再表示されない（R キーの全リセット＝`resetProgress`
   * で初期化され、再び最初から見られる）。
   */
  markOpeningStorySeen: () => set({ hasSeenOpeningStory: true }),

  /**
   * プレイヤーが戦闘で「初めて出てきた」カードを既出として記録する。
   *
   * カード説明ヘルプ（`HelpWindow`）は、まだ出会っていないカードの
   * 説明を伏せて「？？？カード」と表示する。そのための既出フラグを
   * `seenCardIds` 集合（配列で保持）として一元管理する。`BattleScreen`
   * のマウント時に、そのステージの手札カード ID を渡して呼ぶ想定。
   *
   * 既に記録済みの ID は無視し、新規 ID が 1 つも無ければ参照を変えずに
   * no-op する（不要な再レンダーを避けるため `set` 自体を呼ばない）。
   *
   * Args:
   *     cardIds (string[]): このステージで手札に出るカードの ID 配列。
   */
  markCardsSeen: (cardIds) => {
    const state = get();
    const fresh = cardIds.filter((id) => !state.seenCardIds.includes(id));
    if (fresh.length === 0) {
      return;
    }
    set({ seenCardIds: [...state.seenCardIds, ...new Set(fresh)] });
  },

  /**
   * プレイヤーが戦闘で「初めて出てきた」特殊マスの種別を既出として記録する。
   *
   * マス説明ヘルプ（`HelpWindow` のマスカテゴリ）は、まだ出会っていない
   * 種別のマスの説明を伏せて「？？？マス」と表示する。そのための既出フラグを
   * `seenSlotTypeIds` 集合（配列で保持）として管理する。`BattleScreen` の
   * マウント時に、展開済みステージの `slotTypeIds`（`stagesLoader` が収集）を
   * 渡して呼ぶ想定。挙動は `markCardsSeen` と同型（記録済み ID は無視、
   * 新規が無ければ no-op）。
   *
   * Args:
   *     slotTypeIds (string[]): このステージに登場する特殊マス種別 ID の配列。
   */
  markSlotTypesSeen: (slotTypeIds) => {
    const state = get();
    const fresh = slotTypeIds.filter(
      (id) => !state.seenSlotTypeIds.includes(id),
    );
    if (fresh.length === 0) {
      return;
    }
    set({ seenSlotTypeIds: [...state.seenSlotTypeIds, ...new Set(fresh)] });
  },

  /**
   * ステージのクリアを記録し、必要なら次ステージ解放のフラグを立てる。
   *
   * `clearedStageIds` に既に含まれているなら何もしない（要件 3-2）。
   * 新規追加した場合は `getNextStageId` で次ステージを計算し、存在する
   * かつ未だ解放されていなければ `pendingUnlockStageId` にセットする
   * （要件 4-1）。次ステージが存在しないか既に解放済みなら
   * `pendingUnlockStageId` は変更しない（要件 4-2, 4-3）。
   *
   * さらに、クリアしたのが「ワールドの最終ステージ」（同ワールド内に次が
   * 無い、すなわち `getNextStageId` が `null`）で、かつ次ワールドが全体マップ
   * 上に領域を持ち（`getNextUnlockableWorld`）まだ未解放なら、ワールド解放
   * シネマの起点となる `pendingWorldUnlock`（次ワールド番号）をセットする。
   * 1-4 / 2-4 / 3-4 クリア時のワールド 2 / 3 / 4 解放がこれに当たる。重複
   * クリアは冒頭の早期 return で弾かれるため、シネマは初回クリア時のみ走る。
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

    const parsed = parseStageId(stageId);
    const nextWorld =
      !nextStageId && parsed ? getNextUnlockableWorld(parsed.world) : null;
    const shouldUnlockWorld =
      nextWorld !== null && !state.unlockedWorlds.includes(nextWorld);

    set({
      clearedStageIds: [...state.clearedStageIds, stageId],
      pendingUnlockStageId:
        nextStageId && !wasUnlocked ? nextStageId : state.pendingUnlockStageId,
      pendingWorldUnlock: shouldUnlockWorld
        ? nextWorld
        : state.pendingWorldUnlock,
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
   * ワールド解放シネマの「開放アニメ」フェーズを開始する。
   *
   * `pendingWorldUnlock`（解放対象ワールド番号）を `unlockingWorld` に写し、
   * 全体マップ（`MapRegionScrolls`）の該当領域に南京錠破壊アニメ（`isFading`）
   * を発火させる。`unlockedWorlds` への反映はアニメ完了後の `commitWorldUnlock`
   * で行うため、この時点では領域は「未解放のまま破壊演出中」になる。
   */
  startWorldUnlockAnimation: () =>
    set({ unlockingWorld: get().pendingWorldUnlock }),

  /**
   * ワールド解放を確定する。
   *
   * `unlockingWorld` のワールドを `unlockedWorlds` に追加（重複は無視）し、
   * `unlockingWorld` を `null` に戻す。南京錠破壊アニメが終わって演出上は
   * 既に解放済みに見えているので、ここでの状態確定による表示の飛びは
   * 起きない。
   */
  commitWorldUnlock: () => {
    const { unlockingWorld, unlockedWorlds } = get();
    if (unlockingWorld === null) {
      return;
    }
    set({
      unlockedWorlds: unlockedWorlds.includes(unlockingWorld)
        ? unlockedWorlds
        : [...unlockedWorlds, unlockingWorld],
      unlockingWorld: null,
    });
  },

  /**
   * ワールド解放シネマの終了処理。`pendingWorldUnlock` を `null` に戻す。
   *
   * シネマ（`WorldUnlockCutscene`）の最終フェーズで親から呼ばれ、これにより
   * `MapScreen` 側のシネマがアンマウントされる。
   */
  finishWorldUnlockCutscene: () => set({ pendingWorldUnlock: null }),

  /**
   * テスト用：全ステージと全ワールドを即座に解放する。
   *
   * `stages.json` の全ステージを走査し、各ステージの解放条件を満たす
   * ために必要な「直前ステージ」を `clearedStageIds` に追加する。
   * `*-1` は常に解放扱いのため、各ワールドの最終ステージ自体は
   * `cleared` 扱いにならず「未クリアだが解放済み」状態になる。
   * 同時に、全体マップ（`map_0`）の各領域＝ワールド単位の「ステージN」を
   * すべて解放するため、登場する全ワールド番号を `unlockedWorlds` に入れる
   * （常に解放扱いのワールド 1 は除く。`setProgressUpToStage` と同じ理由で、
   * 入れるとマップ移動ボタンの表示条件が崩れる）。
   * 解放アニメは抑止したいので `pendingUnlockStageId` はリセットし、
   * `isUnlockAnimating` も `false` に戻す。
   */
  /**
   * クリア・解放の進行状況をすべて初期状態に戻す。開発・テスト用。
   *
   * `clearedStageIds` / `unlockedWorlds` / `seenCardIds` / `seenSlotTypeIds`
   * を空にし、解放アニメ関連の `pendingUnlockStageId` / `isUnlockAnimating` も
   * `null` / `false` に戻す。既出カード・既出マス（`seenCardIds` /
   * `seenSlotTypeIds`）を残すと、リセット後に説明ヘルプでまだ出会っていない
   * はずのカードやマスの説明が見えてしまうため、一緒に消す。オープニング
   * 紙芝居の視聴記録（`hasSeenOpeningStory`）も戻し、リセット後は紙芝居から
   * 通しで見直せるようにする。`unlockAllStages`（全解放）と対になる「全リセット」。
   */
  resetProgress: () =>
    set({
      clearedStageIds: [],
      unlockedWorlds: [],
      seenCardIds: [],
      seenSlotTypeIds: [],
      pendingUnlockStageId: null,
      isUnlockAnimating: false,
      pendingWorldUnlock: null,
      unlockingWorld: null,
      hasSeenOpeningStory: false,
      /* 「続きから」の保存位置も消し、次回スタートは最初のマップの入口から */
      lastPosition: null,
    }),

  /**
   * 指定ステージに「到達済み」の進行状態へ一括設定する。開発・テスト用。
   *
   * `targetStageId` より前のステージ（前ワールド、または同ワールドで番号が
   * 小さい）をすべて `clearedStageIds` に入れ、到達したワールドまで（全体マップ
   * に領域 `map_N` を持つもの）を `unlockedWorlds` に入れる。ワールド 1 は
   * `isWorldUnlocked` が常に解放扱いにするため配列には入れない。通常プレイの
   * `markStageCleared` もワールド 2 以降しか追加しないので、これを崩すと
   * 「マップ移動ボタンはワールド解放後に出す」という `MapScreen` の表示条件
   * （`unlockedWorlds.length > 0`）がワールド 1 への巻き戻しでも真になって
   * しまい、ボタンが消えなくなる。`targetStageId`
   * 自身は「これから初めて挑む」状態＝未クリアのまま残すので、選んだステージ
   * から再生されるカットシーンや初回挑戦の挙動をテストできる。既出カード
   * （`seenCardIds`）は「クリア済みステージ＋対象ステージ」に登場するカード
   * （手札＋スロットのロックカード）に、既出マス（`seenSlotTypeIds`）は同じ
   * 範囲に登場する特殊マス種別に巻き戻す。対象ステージ自身を含めるのは
   * 開発用途への配慮：「解放レベル」で解放した地点の説明ヘルプを、戦闘に
   * 入らなくてもすぐ確認できるようにするため（初見プレイの解放タイミング
   * 自体は、通常プレイの戦闘入場時記録で再現される）。
   * 解放アニメ系のフラグ（`pendingUnlockStageId` / `isUnlockAnimating` /
   * `pendingWorldUnlock` / `unlockingWorld`）はすべてリセットし、選択直後に
   * 演出が走らないようにする。
   * `cutsceneStore.markSeenBeforeStage` と対で「到達ステージ選択」を構成する。
   *
   * Args:
   *     targetStageId (string): 「ここに到達した」基準ステージ ID。
   */
  setProgressUpToStage: (targetStageId) => {
    const target = parseStageId(targetStageId);
    if (!target) {
      return;
    }
    const targetWorld = Number(target.world);
    const clearedStageIds = Object.keys(stagesData.stages).filter((id) => {
      const parsed = parseStageId(id);
      if (!parsed) {
        return false;
      }
      const world = Number(parsed.world);
      return (
        world < targetWorld ||
        (world === targetWorld && parsed.number < target.number)
      );
    });
    const unlockedWorlds = [];
    for (let world = 2; world <= targetWorld; world += 1) {
      if (mapsData.maps?.[`map_${world}`]) {
        unlockedWorlds.push(String(world));
      }
    }
    const seenSourceStageIds = [...clearedStageIds, targetStageId].filter(
      (id) => stagesData.stages[id],
    );
    const seenCardIds = Array.from(
      new Set(
        seenSourceStageIds.flatMap((id) => {
          const stage = stagesData.stages[id];
          return [
            ...(stage.cards ?? []).map((card) => card.id),
            ...(stage.slots ?? [])
              .map((slot) => slot.lockedCard?.id)
              .filter(Boolean),
          ];
        }),
      ),
    );
    const seenSlotTypeIds = Array.from(
      new Set(
        seenSourceStageIds.flatMap(
          (id) => stagesData.stages[id].slotTypeIds ?? [],
        ),
      ),
    );
    set({
      clearedStageIds,
      unlockedWorlds,
      seenCardIds,
      seenSlotTypeIds,
      pendingUnlockStageId: null,
      isUnlockAnimating: false,
      pendingWorldUnlock: null,
      unlockingWorld: null,
    });
  },

  unlockAllStages: () => {
    const predecessors = new Set();
    const worlds = new Set();
    for (const stageId of Object.keys(stagesData.stages)) {
      const parsed = parseStageId(stageId);
      if (!parsed) {
        continue;
      }
      if (parsed.world !== '1') {
        worlds.add(parsed.world);
      }
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
      pendingWorldUnlock: null,
      unlockingWorld: null,
    });
  },
    }),
    {
      /*
       * 進行状況の永続化（localStorage）。リロードしても「クリア済みステージ・
       * 解放ワールド・既出カード」が残るようにする。
       *
       * `partialize` で永続データだけを保存し、解放アニメ進行中の一時状態
       * （`pendingUnlockStageId` / `isUnlockAnimating` / `pendingWorldUnlock`
       * / `unlockingWorld`）は保存しない。これらを保存すると、復元直後に
       * 解放シネマが中途半端に再生されたり、ロック表示が固まったりするため、
       * リロード時は必ず「アニメ無し」の静止状態から始める。
       */
      name: 'unilab-progress',
      partialize: (state) => ({
        clearedStageIds: state.clearedStageIds,
        unlockedWorlds: state.unlockedWorlds,
        seenCardIds: state.seenCardIds,
        seenSlotTypeIds: state.seenSlotTypeIds,
        hasSeenOpeningStory: state.hasSeenOpeningStory,
        lastPosition: state.lastPosition,
      }),
    },
  ),
);

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
 * 指定カードが既出（プレイヤーが戦闘で出会った）かを返すセレクタファクトリ。
 *
 * `useProgressStore(isCardSeenSelector("attack"))` のように使う。カード
 * 説明ヘルプで、未出のカードを「？？？カード」と伏せ表示するための判定。
 *
 * Args:
 *     cardId (string): 判定対象カードの ID。
 *
 * Returns:
 *     (state) => boolean: zustand セレクタ関数。
 */
export const isCardSeenSelector = (cardId) => (state) =>
  state.seenCardIds.includes(cardId);

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
 * 実プレイでは各ワールド最終ステージのクリア連動で解放シネマ
 * （`WorldUnlockCutscene`）が走って `unlockedWorlds` に追加される。開発用
 * には「到達ステージ選択」（`setProgressUpToStage`）や `unlockAllStages` でも
 * まとめて解放できる。
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
