import { create } from 'zustand';

/**
 * バトル状態を一元管理する Zustand ストア。
 *
 * 手札（`handCards`）・スロット割当（`slotAssignments`）・ドラッグ中の
 * カード（`activeInstanceId`）・フローチャートの拡大状態（`isExpanded`）・
 * 切替アニメーション中フラグ（`isTransitioning`）をグローバルに保持し、
 * 手札 UI・フローチャート・拡大トグルボタンなど複数のコンポーネントから
 * 購読・更新できるようにする。
 * カードは `stages.json` で定義された `id` / `power` に加えて、本バトル内で
 * 一意な `instanceId` を付与した `CardInstance` として扱う。同一 `id` の
 * カードが複数あっても `instanceId` で区別することで dnd-kit のドラッグ
 * アイテム識別子と衝突しない。
 *
 * 公開アクション：
 *   - `initializeBattle(stage)` : ステージ定義から配置状態を初期化する
 *                                 （`isExpanded` は触らない：拡大／縮小の
 *                                 ユーザー選好は引き継ぐ）
 *   - `beginDrag(instanceId)`   : ドラッグ開始時に呼び出す
 *   - `endDrag(result)`         : ドラッグ終了時に呼び出し、配置・差し替え・
 *                                 撤回を 1 箇所で処理する
 *   - `toggleExpand()`          : 拡大／縮小を切り替える。`isTransitioning`
 *                                 中は no-op（連打・切替中の二重発火ガード）。
 *                                 切替後は 250ms 後に `isTransitioning` を戻す
 *
 * `endDrag` は `source`（`'hand'` またはスロット ID）と `destination`
 * （スロット ID または `null`）の組み合わせで状態遷移する純粋関数的実装。
 */

const HAND = 'hand';
const TRANSITION_DURATION_MS = 250;

/**
 * ステージ定義の `cards` 配列を `CardInstance` 配列に展開する。
 *
 * `instanceId` はバトル内で一意な識別子として `c-<index>` を付与する。
 * 同一 `id`（例：`attack` が複数枚）であっても別個体として扱える。
 *
 * Args:
 *     cards (Array<{id: string, power: number}>): ステージ定義の手札配列。
 *
 * Returns:
 *     Array<{instanceId: string, id: string, power: number}>:
 *         インスタンス化されたカード配列。
 */
function expandHandCards(cards) {
  return cards.map((card, index) => ({
    instanceId: `c-${index}`,
    id: card.id,
    power: card.power,
  }));
}

/**
 * スロット配列から全て `null` 埋めの割当マップを生成する。
 *
 * Args:
 *     slots (Array<{id: string}>): ステージ定義のスロット配列。
 *
 * Returns:
 *     Object<string, null>: スロット ID をキーに、値が全て `null` のマップ。
 */
function emptySlotAssignments(slots) {
  const assignments = {};
  for (const slot of slots) {
    assignments[slot.id] = null;
  }
  return assignments;
}

/**
 * ドラッグ終了時の状態遷移を計算する純粋関数。
 *
 * `source` と `destination` の組み合わせで 7 パターンに分岐する。
 * Zustand の `set` の引数として渡せる部分更新オブジェクトを返す。
 *
 * Args:
 *     state (object): 現在のストア状態。
 *     result (object): ドラッグ結果。以下のキーを持つ。
 *         instanceId (string): ドラッグされたカードの `instanceId`。
 *         source (string): ドラッグ元。`'hand'` またはスロット ID。
 *         destination (string | null): ドロップ先。スロット ID か、
 *             スロット外なら `null`。
 *
 * Returns:
 *     object: `handCards` と `slotAssignments` の更新内容を含む部分オブジェクト。
 *         変化がない場合は空オブジェクトを返す。
 */
function computeDropTransition(state, { instanceId, source, destination }) {
  if (source === HAND && destination === null) {
    return {};
  }

  if (source === destination) {
    return {};
  }

  let handCards = state.handCards;
  let slotAssignments = state.slotAssignments;

  let movedCard = null;
  if (source === HAND) {
    const index = handCards.findIndex((c) => c.instanceId === instanceId);
    if (index === -1) {
      return {};
    }
    movedCard = handCards[index];
    handCards = [...handCards.slice(0, index), ...handCards.slice(index + 1)];
  } else {
    movedCard = slotAssignments[source];
    if (!movedCard || movedCard.instanceId !== instanceId) {
      return {};
    }
    slotAssignments = { ...slotAssignments, [source]: null };
  }

  if (destination === null) {
    handCards = [...handCards, movedCard];
    return { handCards, slotAssignments };
  }

  const displaced = slotAssignments[destination];
  if (displaced) {
    if (source === HAND) {
      // 手札発の場合：既存カードは手札末尾に戻す（要件 3-1, 3-2）
      handCards = [...handCards, displaced];
    } else {
      // スロット発の場合：2 枚を入れ替える。ドラッグ元スロットは直前に
      // null にクリアしているので、そこへ既存カードを押し込む（要件 3-3）
      slotAssignments = { ...slotAssignments, [source]: displaced };
    }
  }
  slotAssignments = { ...slotAssignments, [destination]: movedCard };

  return { handCards, slotAssignments };
}

const useBattleStore = create((set, get) => ({
  handCards: [],
  slotAssignments: {},
  activeInstanceId: null,
  isExpanded: false,
  isTransitioning: false,

  /**
   * ステージ定義から配置状態を初期化する。
   *
   * 手札・スロット割当・ドラッグ中フラグのみ初期化し、`isExpanded` には
   * 触れない。これにより「拡大状態でリセットを押しても拡大は保たれる」
   * という挙動が成立する（`flowchart-zoom` 要件 6-1）。
   *
   * Args:
   *     stage (object): `stages.json` の 1 ステージ分。`cards` と `slots` を持つ。
   */
  initializeBattle: (stage) =>
    set(() => ({
      handCards: expandHandCards(stage.cards ?? []),
      slotAssignments: emptySlotAssignments(stage.slots ?? []),
      activeInstanceId: null,
    })),

  /**
   * ドラッグ開始時に呼び出し、`activeInstanceId` をセットする。
   *
   * Args:
   *     instanceId (string): ドラッグ開始したカードの `instanceId`。
   */
  beginDrag: (instanceId) => set(() => ({ activeInstanceId: instanceId })),

  /**
   * ドラッグ終了時に呼び出し、状態遷移を適用する。
   *
   * `source` と `destination` の組み合わせで配置・差し替え・撤回を処理する。
   * 詳細なパターンは `computeDropTransition` を参照。最後に
   * `activeInstanceId` を必ず `null` に戻す。
   *
   * Args:
   *     result (object): ドラッグ結果。
   *         instanceId (string): ドラッグされたカードの `instanceId`。
   *         source (string): ドラッグ元（`'hand'` またはスロット ID）。
   *         destination (string | null): ドロップ先（スロット ID か `null`）。
   */
  endDrag: (result) =>
    set((state) => ({
      ...computeDropTransition(state, result),
      activeInstanceId: null,
    })),

  /**
   * フローチャートの拡大／縮小を切り替える。
   *
   * 切替アニメーション中（`isTransitioning === true`）は no-op として
   * 早期リターンし、連打や切替中の再押下による状態不整合を防ぐ。切替を
   * 受け付けた場合は `isExpanded` を反転し、同時に `isTransitioning` を
   * `true` にしてから `setTimeout` で 250ms 後に `false` に戻す。
   * CSS トランジション時間（`flex-grow 0.25s`）と一致させることで、
   * レイアウトアニメ終了とフラグ解除のタイミングを揃える。
   */
  toggleExpand: () => {
    if (get().isTransitioning) {
      return;
    }
    set((state) => ({
      isExpanded: !state.isExpanded,
      isTransitioning: true,
    }));
    setTimeout(() => {
      set(() => ({ isTransitioning: false }));
    }, TRANSITION_DURATION_MS);
  },
}));

export default useBattleStore;
export { HAND };
