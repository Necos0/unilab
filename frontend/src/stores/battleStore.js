import { create } from 'zustand';
import enemiesData from '../data/enemies.json';

/**
 * バトル状態を一元管理する Zustand ストア。
 *
 * 手札（`handCards`）・スロット割当（`slotAssignments`）・ドラッグ中の
 * カード（`activeInstanceId`）・フローチャートの拡大状態（`isExpanded`）・
 * 切替アニメーション中フラグ（`isTransitioning`）・敵 HP（`currentEnemyHp`
 * / `maxEnemyHp`）・ダメージ演出キュー（`damageEvents`）をグローバルに
 * 保持し、手札 UI・フローチャート・拡大トグルボタン・敵 HP バー・
 * スプライト演出など複数のコンポーネントから購読・更新できるようにする。
 * カードは `stages.json` で定義された `id` / `power` に加えて、本バトル内で
 * 一意な `instanceId` を付与した `CardInstance` として扱う。同一 `id` の
 * カードが複数あっても `instanceId` で区別することで dnd-kit のドラッグ
 * アイテム識別子と衝突しない。
 *
 * 公開アクション：
 *   - `initializeBattle(stage)` : ステージ定義から配置状態を初期化する
 *                                 （`isExpanded` は触らない：拡大／縮小の
 *                                 ユーザー選好は引き継ぐ）。敵 HP は
 *                                 `enemies.json` の `maxHp` で初期化
 *   - `beginDrag(instanceId)`   : ドラッグ開始時に呼び出す
 *   - `endDrag(result)`         : ドラッグ終了時に呼び出し、配置・差し替え・
 *                                 撤回を 1 箇所で処理する
 *   - `toggleExpand()`          : 拡大／縮小を切り替える。`isTransitioning`
 *                                 中は no-op（連打・切替中の二重発火ガード）。
 *                                 切替後は 250ms 後に `isTransitioning` を戻す
 *   - 'startExecution(stage)'   : 実行（ビジュアル進行のみ）を開始する。拡大中は
 *                                 自動縮小→実行の順。'isExecuting'中・全スロット
 *                                 未埋まりは no-op。実行開始時に敵 HP を
 *                                 `maxEnemyHp` に戻し、各 attack カードのフェーズ
 *                                 で `applyDamage(card.power)` を発火する
 *   - `applyDamage(amount)`     : 敵 HP を amount だけ減らし（0 クランプ）、
 *                                 ダメージ演出イベントを `damageEvents` に
 *                                 push する
 *   - `dismissDamageEvent(id)`  : 指定 id のダメージイベントを配列から取り除く
 *                                 （`DamageFloater` 等の演出側からの自走削除）
 *
 * `endDrag` は `source`（`'hand'` またはスロット ID）と `destination`
 * （スロット ID または `null`）の組み合わせで状態遷移する純粋関数的実装。
 */

const HAND = 'hand';
const TRANSITION_DURATION_MS = 250;
const EXECUTION_PER_CARD_MS = 2000;

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
 * ステージ定義のエッジを辿って、実行時のフェーズ列を構築する。               
 *                                                          
 * `'start'` ノードから始め、各ノードの outgoing エッジを 1 本ずつ辿って      
 * `'goal'` までの経路を `[{type:'node', id:'start'}, {type:'edge',           
id:'e-start-1'},                                                              
  * {type:'node', id:'slot-1'}, ..., {type:'node', id:'goal'}]`                
の配列に展開する。                                                            
  * 経路が途中で途切れている場合（参照不正など）は、辿れた範囲までで打ち切る。
  *                                                          
  * Args:                                                                      
  *     stage (object): `stages.json` の 1 ステージ分。`edges` と `slots` 
を持つ。                                                                      
  *                                                                            
  * Returns:                                                                   
  *     Array<{type: 'node' | 'edge', id: string}>: フェーズ列。実行中の       
  *         `executionStep` に時系列でセットされる。
  */
 function buildExecutionPath(stage) {
  const next = {};
  for (const edge of stage.edges ?? []) {
    next[edge.source] = { target: edge.target, edgeId: edge.id };
  }
  const phases = [];
  let currentNode = 'start';
  while (true) {
    phases.push({ type: 'node', id: currentNode });
    if (currentNode === 'goal') break;
    const trans = next[currentNode];
    if (!trans) break;
    phases.push({ type: 'edge', id: trans.edgeId });
    currentNode = trans.target;
  }
  return phases;
 }

 /**                                                         
 * 全スロットがカードで埋まっているかを返すセレクタ関数。                     
 *                                     
 * `Object.values(slotAssignments).every(...)` を呼ぶだけだが、複数の         
 * コンポーネントが同じ判定を行うため共通関数として export する。スロット
 * が 1 つも無いステージでは `every` の規約上 `true` が返るが、その場合は     
 * 「埋まっていると見なす」で問題ない（実行しても 0 ステップで終わる）。
 *                                                          
 * Args:                                                    
 *     state (object): `battleStore` の状態。               
 *                                                                            
 * Returns:                                                 
 *     boolean: 全スロットが埋まっているなら `true`。                         
 */
function selectAllSlotsFilled(state) {
  return Object.values(state.slotAssignments).every((card) => card !== null);
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
  isExecuting: false,
  executionStep: null,
  currentPhaseMs: null,
  currentEnemyHp: 0,
  maxEnemyHp: 0,
  damageEvents: [],
  _damageCounter: 0,

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
  initializeBattle: (stage) => {
    const enemy = enemiesData.enemies.find((e) => e.id === stage.enemyId);
    const maxHp = enemy?.maxHp ?? 0;
    set(() => ({
      handCards: expandHandCards(stage.cards ?? []),
      slotAssignments: emptySlotAssignments(stage.slots ?? []),
      activeInstanceId: null,
      maxEnemyHp: maxHp,
      currentEnemyHp: maxHp,
      damageEvents: [],
    }));
  },

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

  /**                                                                         
   * フローチャートの実行（ビジュアル進行のみ）を開始する。 
   *                                                                          
   * 以下のいずれかのときは no-op として早期リターン：      
   *   - 既に実行中（`isExecuting`）                                          
   *   - 拡大／縮小切替アニメーション中（`isTransitioning`）
   *   - 全スロットが埋まっていない（`selectAllSlotsFilled` が false）        
   *                                                        
   * 拡大状態のときは、`isExpanded` を false にしてレイアウトを縮小しながら   
   * `setTimeout(TRANSITION_DURATION_MS)` 後に実行シーケンスを開始する。
   * 縮小状態なら即実行する。                                                 
   *                                                        
   * 実行シーケンスは `buildExecutionPath(stage)` で組み立てたフェーズ列を、  
   * `phases.length × phaseMs` の合計時間に等分配して `setTimeout` で順次
   * `executionStep` にセットしていく。最後に `isExecuting` を `false`、      
   * `executionStep` と `currentPhaseMs` を `null` に戻す。                   
   *                                                                          
   * Args:                                                                    
   *     stage (object): `stages.json` の 1 ステージ分。`slots` と `edges`    
  を持つ。                                                                      
    */
   startExecution: (stage) => {
    const state = get();
    if (state.isExecuting || state.isTransitioning) {
      return;
    }
    if (!selectAllSlotsFilled(state)){
      return;
    }

    const beginSequence = () => {
      const phases = buildExecutionPath(stage);
      const totalMs = stage.slots.length * EXECUTION_PER_CARD_MS;
      const phaseMs = totalMs / phases.length;

      set((s) => ({
        isExecuting: true,
        currentPhaseMs: phaseMs,
        currentEnemyHp: s.maxEnemyHp,
        damageEvents: [],
      }));
      phases.forEach((phase, i) => {
        setTimeout(() => {
          set({ executionStep: phase });
          if (phase.type === 'node') {
            const card = get().slotAssignments[phase.id];
            if (card && card.id === 'attack' && card.power > 0) {
              get().applyDamage(card.power);
            }
          }
        }, i * phaseMs);
      });
      setTimeout(() => {
        set({ isExecuting: false, executionStep: null, currentPhaseMs: null });
      }, phases.length * phaseMs);
    };

    if (state.isExpanded) {
      set({ isExpanded: false, isTransitioning: true });
      setTimeout(() => {
        set({ isTransitioning: false });
        beginSequence();
      }, TRANSITION_DURATION_MS);
    } else {
      beginSequence();
    }
   },

  /**
   * 敵に対してダメージを 1 回適用する。
   *                                                                          
   * `currentEnemyHp` を減算（0 でクランプ）し、`damageEvents`に新規イベントを                                                              
    * 追加する。`damageEvents` の各要素は `EnemySprite` のフラッシュ演出と
    * `DamageFloater` の浮き数字描画のトリガーとして購読される。`id` は        
    * `_damageCounter` ベースの単調増加文字列で、React の key として使う。     
    *                                                                          
    * Args:                                                                    
    *     amount (number): 与えるダメージ量。負の値や 0 は呼び出し側で         
    *         弾く前提だが、内部的には `Math.max(0, ...)` で 0 クランプする。  
    */
   applyDamage: (amount) => set((state) => {
    const nextHp = Math.max(0, state.currentEnemyHp - amount);
    const id = `d-${state._damageCounter}`;
    return {
      currentEnemyHp: nextHp,
      damageEvents: [...state.damageEvents, { id, amount }],
      _damageCounter: state._damageCounter + 1,
    };
   }),

   /**
   * 指定 id のダメージイベントを `damageEvents` から削除する。               
   *                                                                          
   * `DamageFloater` の各浮き数字要素が `onAnimationEnd` で呼び出し、自身を
   * 配列から取り除いて自走 unmount する。これにより `damageEvents` が        
   * 累積し続けるのを防ぐ。                                                   
   *                                                                          
   * Args:                                                                    
   *     id (string): 削除対象のダメージイベント id。`damageEvents` 内に      
   *         該当が無ければ no-op。                                           
   */
   dismissDamageEvent: (id) => set((state) => ({
    damageEvents: state.damageEvents.filter((e) => e.id !== id),
   })),
}));

export default useBattleStore;
export { HAND, selectAllSlotsFilled };
