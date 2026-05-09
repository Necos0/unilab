import { create } from 'zustand';
import enemiesData from '../data/enemies.json';
import playerData from '../data/player.json';

/**
 * バトル状態を一元管理する Zustand ストア。
 *
 * 手札（`handCards`）・スロット割当（`slotAssignments`）・ドラッグ中の
 * カード（`activeInstanceId`）・フローチャートの拡大状態（`isExpanded`）・
 * 切替アニメーション中フラグ（`isTransitioning`）・敵 HP（`currentEnemyHp`
 * / `maxEnemyHp`）・敵向けダメージ演出キュー（`enemyDamageEvents`）・プレイヤー
 * HP（`currentPlayerHp` / `maxPlayerHp`）・プレイヤー向けダメージ演出キュー
 * （`playerDamageEvents`）・プレイヤー向けヒール演出キュー
 * （`playerHealEvents`）・勝利演出フェーズ（`victoryPhase`）をグローバル
 * に保持し、手札 UI・フローチャート・拡大トグルボタン・敵 HP バー・
 * スプライト演出・CLEAR! オーバーレイ・プレイヤー HP バーなど複数の
 * コンポーネントから購読・更新できるようにする。
 * カードは `stages.json` で定義された `id` / `power` に加えて、本バトル内で
 * 一意な `instanceId` を付与した `CardInstance` として扱う。同一 `id` の
 * カードが複数あっても `instanceId` で区別することで dnd-kit のドラッグ
 * アイテム識別子と衝突しない。ステージ定義側でスロットに固定配置される
 * ロックカード（モンスターカード等）は `locked: true` フラグを持ち、
 * `DraggableCard` の `disabled` 判定と `computeDropTransition` のガードで
 * ユーザー操作からの drag-out / drop-onto を抑止する。
 *
 * `victoryPhase` は `null | 'dead' | 'fading' | 'cleared'` の 4 状態を取る
 * 線形 enum で、勝利演出（敵 dead アニメ → スプライトのフェードアウト →
 * CLEAR! テキスト表示）の進行を 1 フィールドで表現する。
 *
 * 公開アクション：
 *   - `initializeBattle(stage)` : ステージ定義から配置状態を初期化する
 *                                 （`isExpanded` は触らない：拡大／縮小の
 *                                 ユーザー選好は引き継ぐ）。敵 HP は
 *                                 `enemies.json` の `maxHp`、プレイヤー HP は
 *                                 `player.json` の `maxHp` で初期化し、
 *                                 `victoryPhase` も `null` に戻す。スロット
 *                                 割当は `lockedCard` を持つステージ定義
 *                                 から復元される
 *   - `beginDrag(instanceId)`   : ドラッグ開始時に呼び出す
 *   - `endDrag(result)`         : ドラッグ終了時に呼び出し、配置・差し替え・
 *                                 撤回を 1 箇所で処理する
 *   - `toggleExpand()`          : 拡大／縮小を切り替える。`isTransitioning`
 *                                 中は no-op（連打・切替中の二重発火ガード）。
 *                                 切替後は 250ms 後に `isTransitioning` を戻す
 *   - 'startExecution(stage)'   : 実行（ビジュアル進行のみ）を開始する。拡大中は
 *                                 自動縮小→実行の順。'isExecuting'中・全スロット
 *                                 未埋まりは no-op。実行開始時に敵／プレイヤー HP を
 *                                 各 `maxHp` に戻し、各カードのフェーズで種別ごとに
 *                                 `applyEnemyDamage` / `applyPlayerDamage` /
 *                                 `applyPlayerHeal` を発火する（独立 `if` 並列）。
 *                                 シーケンス完了時点で敵 HP が 0 なら、
 *                                 `startVictorySequence(stage.enemyId)` を呼んで
 *                                 勝利演出を起動する
 *   - `applyEnemyDamage(amount)`
 *                               : 敵 HP を amount だけ減らし（0 クランプ）、
 *                                 敵向けダメージ演出イベントを
 *                                 `enemyDamageEvents` に push する
 *   - `dismissEnemyDamageEvent(id)`
 *                               : 指定 id の敵向けダメージイベントを
 *                                 `enemyDamageEvents` から取り除く
 *                                 （`DamageFloater` 等の演出側からの自走削除）
 *   - `applyPlayerDamage(amount)`
 *                               : プレイヤー HP を amount だけ減らし（0 クランプ）、
 *                                 プレイヤー向けダメージ演出イベントを
 *                                 `playerDamageEvents` に push する。モンスター
 *                                 カードのスロット通過時に `startExecution` から
 *                                 呼び出される
 *   - `dismissPlayerDamageEvent(id)`
 *                               : 指定 id のプレイヤー向けダメージイベントを
 *                                 `playerDamageEvents` から取り除く
 *                                 （`PlayerDamageFloater` 等の演出側からの自走削除）
 *   - `applyPlayerHeal(amount)`
 *                               : プレイヤー HP を amount だけ回復し
 *                                 （`maxPlayerHp` でクランプ）、プレイヤー向け
 *                                 ヒール演出イベントを `playerHealEvents` に
 *                                 push する。HP が満タンでも push は必ず行い、
 *                                 演出だけは再生される（heal カードを通った
 *                                 ことの視覚フィードバック）。heal カードの
 *                                 スロット通過時に `startExecution` から
 *                                 呼び出される
 *   - `dismissPlayerHealEvent(id)`
 *                               : 指定 id のプレイヤー向けヒールイベントを
 *                                 `playerHealEvents` から取り除く
 *                                 （`PlayerHealFloater` 等の演出側からの自走削除）
 *   - `startVictorySequence(enemyId)`
 *                               : 勝利演出シーケンスを開始する。`enemies.json` で
 *                                 dead アニメが定義されていれば `'dead' →
 *                                 'fading' → 'cleared'` の 3 段、未定義なら
 *                                 `'fading' → 'cleared'` の 2 段で `victoryPhase`
 *                                 を遷移させる
 *
 * `endDrag` は `source`（`'hand'` またはスロット ID）と `destination`
 * （スロット ID または `null`）の組み合わせで状態遷移する純粋関数的実装。
 */

const HAND = 'hand';
const TRANSITION_DURATION_MS = 250;
const EXECUTION_PER_CARD_MS = 2000;
const VICTORY_FADE_DURATION_MS = 500;

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
 * ステージ定義から初期スロット割当マップを生成する。
 *
 * 各スロットに `lockedCard` が定義されていれば、そのスロットは
 * `{ instanceId: 'locked-<slotId>', id, power, locked: true }` の
 * ロック付き `CardInstance` で埋める。`lockedCard` を持たないスロットは
 * 従来どおり `null`（空き）にする。`locked: true` フラグは `DraggableCard`
 * の `disabled` 判定および `computeDropTransition` のガードで参照され、
 * ユーザー操作からの drag-out / drop-onto を抑止する役割を持つ
 * （monster-attack 要件 2-2, 2-3）。
 *
 * `instanceId` は `locked-<slotId>` 規約で生成し、`expandHandCards` が
 * 使う `c-${index}` 体系と衝突しない安定 ID として機能する。リセット
 * ボタン経由で `initializeBattle` が再実行されてもスロット ID が同じで
 * あれば同じ `instanceId` が復元されるため、React の差分更新も自然に
 * 働く。
 *
 * Args:
 *     stage (object): `stages.json` の 1 ステージ分。`slots` 配列を持ち、
 *         各スロットは `{id, position, lockedCard?}` の形。`lockedCard`
 *         は `{id: string, power: number}` の形で、未定義なら空きスロット。
 *
 * Returns:
 *     Object<string, CardInstance | null>: スロット ID をキーに、ロック
 *         カードか `null` を値とするマップ。
 */
function buildSlotAssignmentsFromStage(stage) {
  const assignments = {};
  for (const slot of stage.slots ?? []) {
    if(slot.lockedCard){
      assignments[slot.id] = {
        instanceId: `locked-${slot.id}`,
        id: slot.lockedCard.id,
        power: slot.lockedCard.power,
        locked: true,
      };
    } else {
      assignments[slot.id] = null;
    }
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
 * 関数冒頭で 4 つの早期リターンガードを通過する：
 *   1. 手札 → スロット外（`source === HAND && destination === null`）：
 *      何もしない（手札からの撤回扱い）
 *   2. 同一位置への drop（`source === destination`）：何もしない
 *   3. ドラッグ元スロットがロックカードを持つ（`sourceCard.locked`）：
 *      何もしない（モンスターカードを動かせない／monster-attack 要件 2-3）
 *   4. ドロップ先スロットがロックカードを持つ（`destCard.locked`）：
 *      何もしない（ロックスロットへ別カードを置けない／monster-attack 要件 2-2）
 * いずれにも該当しない場合のみ、本来の状態遷移ロジックに進む。
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

  if (source !== HAND) {
    const sourceCard = state.slotAssignments[source];
    if (sourceCard?.locked) {
      return {};
    }
  }

  if (destination !== null) {
    const destCard = state.slotAssignments[destination];
    if (destCard?.locked) {
      return {};
    }
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
  enemyDamageEvents: [],
  victoryPhase: null,
  _enemyDamageCounter: 0,
  currentPlayerHp: 0,
  maxPlayerHp: 0,
  playerDamageEvents: [],
  _playerDamageCounter: 0,
  playerHealEvents: [],
  _playerHealCounter: 0,

  /**
   * ステージ定義から配置状態を初期化する。
   *
   * 手札・スロット割当・ドラッグ中フラグ・敵 HP・敵向けダメージ演出キュー・
   * プレイヤー HP・プレイヤー向けダメージ演出キュー・プレイヤー向けヒール
   * 演出キュー・勝利演出フェーズ（`victoryPhase`）を初期化する。`isExpanded` には触れない
   * （「拡大状態でリセットを押しても拡大は保たれる」挙動が成立する：
   * `flowchart-zoom` 要件 6-1）。`victoryPhase` を `null` に戻すことで、
   * CLEAR! 演出の名残（透過したスプライト・CLEAR! テキスト）を残さず
   * 通常状態へ復帰する（`victory-clear` 要件 7-1, 7-4）。
   *
   * 敵 HP は `enemies.json` から `stage.enemyId` に対応する `maxHp` を
   * 取得して `maxEnemyHp` / `currentEnemyHp` の双方に設定する。プレイヤー
   * HP は `player.json` の `maxHp` から同様に `maxPlayerHp` /
   * `currentPlayerHp` を初期化する（monster-attack 要件 3-1）。データが
   * 欠損している場合は `?? 0` で 0 にフォールバックし、`HpBar` 側で
   * `null` を返すことでレイアウトを崩さない。
   *
   * スロット割当の構築は `buildSlotAssignmentsFromStage(stage)` に委譲
   * する。これにより、`stages.json` でスロットに `lockedCard` を定義
   * した場合（モンスターカードの固定配置など）、初期化時にそのスロット
   * へロック付きカードが復元される（monster-attack 要件 2-1, 2-4）。
   * リセットボタン経由で再実行されても同様にロックカードは復元される
   * ため、ユーザー配置のカードのみが手札に戻る挙動になる。
   *
   * Args:
   *     stage (object): `stages.json` の 1 ステージ分。`cards` と `slots` を持つ。
   */
  initializeBattle: (stage) => {
    const enemy = enemiesData.enemies.find((e) => e.id === stage.enemyId);
    const maxEnemyHp = enemy?.maxHp ?? 0;
    const maxPlayerHp = playerData.maxHp ?? 0;
    set(() => ({
      handCards: expandHandCards(stage.cards ?? []),
      slotAssignments: buildSlotAssignmentsFromStage(stage),
      activeInstanceId: null,
      maxEnemyHp,
      currentEnemyHp: maxEnemyHp,
      enemyDamageEvents: [],
      maxPlayerHp,
      currentPlayerHp: maxPlayerHp,
      playerDamageEvents: [],
      playerHealEvents: [],
      victoryPhase: null,
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
   * `executionStep` と `currentPhaseMs` を `null` に戻す。シーケンス完了
   * 時点で `currentEnemyHp === 0` なら、続けて `startVictorySequence(
   * stage.enemyId)` を呼び出して CLEAR! 演出を起動する（`victory-clear`
   * 要件 1-1, 1-3：実行終了の合図に同期して勝利演出を始める）。
   *
   * シーケンス開始時には `currentEnemyHp` を `maxEnemyHp` に、
   * `currentPlayerHp` を `maxPlayerHp` に戻し、両側のダメージ演出キュー
   * （`enemyDamageEvents` / `playerDamageEvents`）およびヒール演出キュー
   * （`playerHealEvents`）も空配列にクリアする。これにより各実行は
   * 「フレッシュな状態からの再生」として独立する
   * （attack-processing 要件 3-1、monster-attack 要件 5-1、heal-card 要件 6-6）。
   *
   * 各ノードフェーズではスロット上のカード `id` を見て独立した `if` 分岐で
   * 効果を発火する：
   *   - `attack` カード → `applyEnemyDamage(card.power)`（敵 HP を減らす）
   *   - `monster` カード → `applyPlayerDamage(card.power)`（プレイヤー HP
   *     を減らす。モンスターカードは `lockedCard` でステージ定義から固定
   *     配置されているため、ユーザー操作では現れない）
   *   - `heal` カード → `applyPlayerHeal(card.power)`（プレイヤー HP を回復し、
   *     `maxPlayerHp` でクランプする。HP が満タンでも演出キューには push
   *     されるため、緑フラッシュと「+N」フロートは通常通り再生される
   *     ／heal-card 要件 2-3, 4-4）
   * いずれも `card.power > 0` でガードしており、power 欠損や 0 の場合は
   * 適用しない（要件 4-4）。`else if` ではなく独立 `if` の並列構造にする
   * ことで、将来カード種別が追加されたときに順序依存無く拡張できる。
   *
   * プレイヤー HP=0 に到達してもシーケンスは中断せず、敗北判定や敗北演出
   * は行わない（monster-attack 要件 3-4：敗北処理は別スペック）。完了タイマー
   * では `currentEnemyHp === 0` のときのみ勝利演出を起動する。
   *
   * Args:
   *     stage (object): `stages.json` の 1 ステージ分。`slots` と `edges`
   *         と `enemyId` を持つ。
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
        enemyDamageEvents: [],
        currentPlayerHp: s.maxPlayerHp,
        playerDamageEvents: [],
        playerHealEvents: [],
      }));
      phases.forEach((phase, i) => {
        setTimeout(() => {
          set({ executionStep: phase });
          if (phase.type === 'node') {
            const card = get().slotAssignments[phase.id];
            if (card && card.id === 'attack' && card.power > 0) {
              get().applyEnemyDamage(card.power);
            }
            if (card && card.id === 'monster' && card.power > 0) {
              get().applyPlayerDamage(card.power);
            }
            if (card && card.id === 'heal' && card.power > 0) {
              get().applyPlayerHeal(card.power);
            }
          }
        }, i * phaseMs);
      });
      setTimeout(() => {
        set({ isExecuting: false, executionStep: null, currentPhaseMs: null });
        if (get().currentEnemyHp === 0) {
          get().startVictorySequence(stage.enemyId);
        }
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
   * `currentEnemyHp` を減算（0 でクランプ）し、`enemyDamageEvents`に新規イベントを                                                              
    * 追加する。`enemyDamageEvents` の各要素は `EnemySprite` のフラッシュ演出と
    * `DamageFloater` の浮き数字描画のトリガーとして購読される。`id` は        
    * `_enemyDamageCounter` ベースの単調増加文字列で、React の key として使う。     
    *                                                                          
    * Args:                                                                    
    *     amount (number): 与えるダメージ量。負の値や 0 は呼び出し側で         
    *         弾く前提だが、内部的には `Math.max(0, ...)` で 0 クランプする。  
    */
   applyEnemyDamage: (amount) => set((state) => {
    const nextHp = Math.max(0, state.currentEnemyHp - amount);
    const id = `d-${state._enemyDamageCounter}`;
    return {
      currentEnemyHp: nextHp,
      enemyDamageEvents: [...state.enemyDamageEvents, { id, amount }],
      _enemyDamageCounter: state._enemyDamageCounter + 1,
    };
   }),

   /**
    * プレイヤーに対してダメージを 1 回適用する。
    *
    * `currentPlayerHp` を減算（0 でクランプ）し、`playerDamageEvents` に
    * 新規イベントを追加する。`playerDamageEvents` の各要素は
    * `PlayerDamageFloater` の浮き数字描画と、プレイヤー HP バーラッパーの
    * shake + flash 演出のトリガーとして購読される。`id` は
    * `_playerDamageCounter` ベースの単調増加文字列で、敵側 (`d-`) と
    * 区別するため `pd-` プレフィックスを付ける（React の key として使う）。
    *
    * プレイヤー HP=0 に到達しても本アクションは何もせず、敗北判定や
    * 実行中断は行わない（monster-attack 要件 3-4：敗北処理は別スペック）。
    *
    * Args:
    *     amount (number): 与えるダメージ量。負の値や 0 は呼び出し側で
    *         弾く前提だが、内部的には `Math.max(0, ...)` で 0 クランプする。
    */
   applyPlayerDamage: (amount) => set((state) => {
    const nextHp = Math.max(0, state.currentPlayerHp - amount);
    const id = `pd-${state._playerDamageCounter}`;
    return {
      currentPlayerHp: nextHp,
      playerDamageEvents: [...state.playerDamageEvents, { id, amount }],
      _playerDamageCounter: state._playerDamageCounter + 1,
    };
   }),

   /**
   * 指定 id のダメージイベントを `enemyDamageEvents` から削除する。               
   *                                                                          
   * `DamageFloater` の各浮き数字要素が `onAnimationEnd` で呼び出し、自身を
   * 配列から取り除いて自走 unmount する。これにより `enemyDamageEvents` が        
   * 累積し続けるのを防ぐ。                                                   
   *                                                                          
   * Args:                                                                    
   *     id (string): 削除対象のダメージイベント id。`enemyDamageEvents` 内に      
   *         該当が無ければ no-op。                                           
   */
   dismissEnemyDamageEvent: (id) => set((state) => ({
    enemyDamageEvents: state.enemyDamageEvents.filter((e) => e.id !== id),
   })),

   /**
   * 指定 id のプレイヤー向けダメージイベントを `playerDamageEvents` から削除する。
   *
   * `PlayerDamageFloater` の各浮き数字要素が `onAnimationEnd` で呼び出し、
   * 自身を配列から取り除いて自走 unmount する。これにより
   * `playerDamageEvents` が累積し続けるのを防ぐ。敵側 `dismissEnemyDamageEvent`
   * と完全対称の責務を持つ。
   *
   * Args:
   *     id (string): 削除対象のダメージイベント id。`playerDamageEvents`
   *         内に該当が無ければ no-op。
   */
   dismissPlayerDamageEvent: (id) => set((state) => ({
    playerDamageEvents: state.playerDamageEvents.filter((e) => e.id !== id),
   })),

   /**
    * プレイヤーに対して HP 回復を 1 回適用する。
    *
    * `currentPlayerHp` を加算（`maxPlayerHp` でクランプ）し、`playerHealEvents`
    * に新規イベントを追加する。`playerHealEvents` の各要素は
    * `PlayerHealFloater` の浮き数字描画と、プレイヤー HP バーラッパーの
    * 緑系フラッシュ演出のトリガーとして購読される。`id` は
    * `_playerHealCounter` ベースの単調増加文字列で、敵被弾 (`d-`) ／プレイヤー
    * 被弾 (`pd-`) と区別するため `ph-` プレフィックスを付ける（React の key
    * として使う）。
    *
    * `currentPlayerHp` が既に `maxPlayerHp` のとき（満タン状態）でも
    * `playerHealEvents` への push は必ず行う。これにより「heal カードを
    * 通ったが満タンだったから増えなかった」という結果を視覚的に追える
    * （heal-card 要件 2-3, 4-4）。`amount` には実際の HP 増加量ではなく
    * カードの `power` 値そのままを保存し、フロート表示で `+<power>` として
    * 出すようにする。
    *
    * Args:
    *     amount (number): 回復量。負の値や 0 は呼び出し側で弾く前提だが、
    *         内部的には `Math.min(maxPlayerHp, ...)` で上限クランプする。
    */
   applyPlayerHeal: (amount) => set((state) => {
    const nextHp = Math.min(state.maxPlayerHp, state.currentPlayerHp + amount);
    const id = `ph-${state._playerHealCounter}`;
    return {
      currentPlayerHp: nextHp,
      playerHealEvents: [...state.playerHealEvents, { id, amount }],
      _playerHealCounter: state._playerHealCounter + 1,
    };
   }),

   /**
    * 指定 id のプレイヤー向けヒールイベントを `playerHealEvents` から削除する。
    *
    * `PlayerHealFloater` の各浮き数字要素が `onAnimationEnd` で呼び出し、
    * 自身を配列から取り除いて自走 unmount する。これにより
    * `playerHealEvents` が累積し続けるのを防ぐ。被弾側
    * `dismissPlayerDamageEvent` と完全対称の責務を持つ。
    *
    * Args:
    *     id (string): 削除対象のヒールイベント id。`playerHealEvents`
    *         内に該当が無ければ no-op。
    */
   dismissPlayerHealEvent: (id) => set((state) => ({
    playerHealEvents: state.playerHealEvents.filter((e) => e.id !== id),
   })),

   /**
    * 勝利演出シーケンスを開始する。
    *
    * `enemies.json` から `enemyId` の `animations.dead` を引き、定義が
    * 存在すれば `'dead' → 'fading' → 'cleared'` の 3 段、未定義なら
    * `'fading' → 'cleared'` の 2 段で `victoryPhase` を `setTimeout`
    * チェーンで遷移させる。`'dead'` 段の長さは
    * `frameCount × frameDurationMs`、`'fading'` 段の長さは
    * `VICTORY_FADE_DURATION_MS` に固定。dead 未実装の敵（slime 等）に
    * 対する暫定スキップ分岐は、将来全敵に dead アニメが用意された時点で
    * 撤去できる（`victory-clear` 要件 2 備考）。
    *
    * Args:
    *     enemyId (string): 倒した敵 ID。`enemies.json` のキーに対応する。
    */
   startVictorySequence: (enemyId) => {
    const enemy = enemiesData.enemies.find((e) => e.id === enemyId);
    const deadAnim = enemy?.animations?.dead;
    const deadDurationMs = deadAnim ? deadAnim.frameCount * deadAnim.frameDurationMs : 0;
    if (deadAnim) {
      set({ victoryPhase: 'dead' });
      setTimeout(() => set({ victoryPhase: 'fading' }), deadDurationMs);
    } else {
      set({ victoryPhase: 'fading' });
    }
    setTimeout(() => set({ victoryPhase: 'cleared' }), deadDurationMs + VICTORY_FADE_DURATION_MS, );
   },
}));

export default useBattleStore;
export { HAND, selectAllSlotsFilled };
