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
 * （`playerHealEvents`）・勝利演出フェーズ（`victoryPhase`）・失敗演出フェーズ
 * （`failPhase`）・通過済みエッジ ID 配列（`traversedEdgeIds`）・通過済みノード
 * ID 配列（`traversedNodeIds`）・防御シールド残量（`guardShield`）・リフレクト状態
 * フラグ（`reflectActive`）・反射ダメージ演出キュー（`enemyReflectEvents`）を
 * グローバルに保持し、手札 UI・フローチャート・拡大トグルボタン・敵 HP バー・
 * スプライト演出・CLEAR! オーバーレイ・Fail オーバーレイ・プレイヤー HP バー・
 * ReflectDamageFloater など複数のコンポーネントから購読・更新できるようにする。
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
 * `failPhase` は `null | 'shown'` の 2 状態を取る enum で、実行シーケンス完了時に
 * 「敵 HP === 0 かつ プレイヤー HP > 0」が成立しない（敗北または相打ち）場合に
 * `'shown'` になり、Fail オーバーレイ表示・敵スプライト半透過・画面ロックの
 * トリガーになる（`battle-fail-retry` 要件 2, 3）。`victoryPhase` とは相互排他で、
 * 両方が同時に非 null になることはない。
 *
 * `traversedEdgeIds` / `traversedNodeIds` は実行シーケンス中に通過したエッジ／
 * ノードの ID を時系列で蓄積する配列。各エッジ・ノード描画コンポーネントが
 * 自身の id の含有を購読することで、「通過済み」の固定ハイライト（白いネオン光）
 * を表現する（`battle-fail-retry` 要件 1）。実行終了後も `initializeBattle` または
 * `retryFromFail` が呼ばれるまでクリアされず、失敗時にプレイヤーが「どの経路を
 * 通ったか」を振り返れるよう経路の痕跡を残す。
 *
 * `guardShield` は防御カード通過時に付与される一時シールド残量（0 以上の数値）。
 * 防御カードノードで `power` 値がセットされ、その直後 1 ノード分のみ有効。次の
 * ノードがモンスターカードなら `consumeShieldOnDamage` で吸収量を差し引いてから
 * 残ダメージを `applyPlayerDamage` に流し、シールド以外のカードでは何もせず通過。
 * 通過後の次のエッジフェーズで「直前ノードが guard でなければ」`clearGuard` が
 * 呼ばれて 0 に戻る（`guard-card-effect` 要件 1〜3）。プレイヤー HP バーは
 * `guardShield > 0` の間だけ右側に青い拡張領域を持ち、数値表示も
 * `currentPlayerHp + guardShield` の合算形式で「分子のみ青色」で描画される
 * （要件 6）。
 *
 * `reflectActive` はカウンターカード通過時に有効化される反射状態のフラグ
 * （boolean）。`true` の間、次のモンスターカードの攻撃を完全に無効化し、
 * `applyReflectDamage` で攻撃値分のダメージを敵 HP から減算し、敵エリアに
 * オレンジ色のフロート（`enemyReflectEvents` 経由で `ReflectDamageFloater` が
 * 描画）を発火する（`reflect-card-effect` 要件 1, 2）。次のエッジフェーズで
 * 「直前ノードが reflect でなければ」`clearReflect` が呼ばれて `false` に戻る
 * （要件 4）。`reflectActive` の間はプレイヤー HP バーの `.fill` がオレンジ色
 * （緑から変化）、ラッパーにオレンジグロー、数値の分子もオレンジ色で表示される
 * （要件 1-2〜1-4）。`guardShield` と `reflectActive` は `applyGuard` /
 * `applyReflect` のアクション内で互いを排他クリアするため、同時に有効になる
 * ことはない（要件 6-1, 6-2）。
 *
 * `playerShakeEvents` は反射成立時にプレイヤー HP バーを縦に揺らすトリガーの
 * キュー。`applyReflectDamage` が呼ばれたタイミングで `enemyReflectEvents` と
 * 同時にイベントが push される。プレイヤー HP は減らないが「攻撃が来たが
 * 跳ね返した」という反射感を視覚的に表現するための専用キューで、`PlayerDamage
 * Floater` を発火させないよう `playerDamageEvents` とは別系統で管理する。
 * `BattleScreen` 側で末尾 id を購読する `isPlayerShaken` 派生計算により、
 * `playerHpBox` に `.shakenVert` クラスが付与されて 1 ショットの縦揺れ
 * （`@keyframes hpBoxShakeVert`）が再生される。敵側の HP バーも同じ
 * `.shakenVert` クラスで連動して縦揺れし、「両者のバーが反射の衝撃で揺れる」
 * 演出になる。
 *
 * 公開アクション：
 *   - `initializeBattle(stage)` : ステージ定義から配置状態を初期化する
 *                                 （`isExpanded` は触らない：拡大／縮小の
 *                                 ユーザー選好は引き継ぐ）。敵 HP は
 *                                 `enemies.json` の `maxHp`、プレイヤー HP は
 *                                 `player.json` の `maxHp` で初期化し、
 *                                 `victoryPhase` / `failPhase` も `null` に戻す。
 *                                 `traversedEdgeIds` / `traversedNodeIds` も
 *                                 空配列に戻して通過軌跡の白い光をクリアする。
 *                                 スロット割当は `lockedCard` を持つステージ
 *                                 定義から復元される
 *   - `beginDrag(instanceId)`   : ドラッグ開始時に呼び出す
 *   - `endDrag(result)`         : ドラッグ終了時に呼び出し、配置・差し替え・
 *                                 撤回を 1 箇所で処理する
 *   - `toggleExpand()`          : 拡大／縮小を切り替える。`isTransitioning`
 *                                 中は no-op（連打・切替中の二重発火ガード）。
 *                                 切替後は 250ms 後に `isTransitioning` を戻す
 *   - 'startExecution(stage)'   : 実行（ビジュアル進行のみ）を開始する。拡大中は
 *                                 自動縮小→実行の順。'isExecuting'中・全スロット
 *                                 未埋まりは no-op。実行開始時に敵／プレイヤー HP を
 *                                 各 `maxHp` に戻し、`guardShield` / `reflectActive` /
 *                                 `enemyReflectEvents` もクリアする。各カードのフェーズで
 *                                 種別ごとに `applyEnemyDamage` / `consumeShieldOnDamage`
 *                                 または `applyReflectDamage`（monster は `reflectActive`
 *                                 で分岐） / `applyPlayerHeal` / `applyGuard` /
 *                                 `applyReflect` を発火する（独立 `if` 並列）。
 *                                 各エッジフェーズでは「直前ノードが guard でなく
 *                                 シールドが残っている」場合のみ `clearGuard` を、
 *                                 「直前ノードが reflect でなくリフレクトが有効」の
 *                                 場合のみ `clearReflect` を呼ぶ。各フェーズで通過した
 *                                 エッジ／ノード id を `traversedEdgeIds` /
 *                                 `traversedNodeIds` に蓄積する。シーケンス完了
 *                                 時点で「敵 HP === 0 かつ プレイヤー HP > 0」なら
 *                                 `startVictorySequence` を起動し、それ以外
 *                                 （敵残存／相打ち）は `failPhase: 'shown'` で Fail
 *                                 フェーズに遷移する
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
 *                                 カードのスロット通過時には `consumeShieldOnDamage`
 *                                 を経由して、シールド吸収後の残ダメージのみが
 *                                 引数として渡される（リフレクト状態では
 *                                 `applyReflectDamage` 経由で敵 HP が減り、本関数は
 *                                 呼ばれない）。実行中に HP=0 に達したときは
 *                                 同じ set 内で `failPhase: 'shown'` などを立てて
 *                                 即座に Fail フェーズへ遷移し、同時に `guardShield`
 *                                 と `reflectActive` も 0 / false にクリアする
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
 *   - `applyGuard(amount)`      : `guardShield` に `amount` をセットする（累積でなく
 *                                 上書き）。`startExecution` の防御カードフェーズで
 *                                 呼ばれる。上書き式にすることで連続防御カードに
 *                                 対応する（`guard-card-effect` 要件 5）
 *   - `consumeShieldOnDamage(amount)`
 *                               : シールドがある場合は `Math.min(shield, amount)` を
 *                                 吸収量として `guardShield` から減算し、残ダメージ
 *                                 （`amount - absorbed`）を `applyPlayerDamage` に
 *                                 渡す。シールドが 0 のときは `applyPlayerDamage(amount)`
 *                                 を直接呼ぶ。`startExecution` のモンスターカード
 *                                 フェーズで呼ばれる（`guard-card-effect` 要件 2）
 *   - `clearGuard()`            : `guardShield` を 0 に戻す。`startExecution` の
 *                                 エッジフェーズで「直前ノードが guard でない」
 *                                 場合に呼ばれ、防御効果が次の 1 ノードのみに
 *                                 限定されることを保証する（`guard-card-effect` 要件 3）
 *   - `applyReflect()`          : `reflectActive` を `true` にセットし、同時に
 *                                 `guardShield` を 0 にクリアする（バフ排他制御）。
 *                                 `startExecution` のカウンターカードフェーズで
 *                                 呼ばれる（`reflect-card-effect` 要件 1, 6-1）
 *   - `applyReflectDamage(amount)`
 *                               : 反射成立時に敵 HP を amount 減らし（0 クランプ）、
 *                                 `enemyReflectEvents` に新規イベントを push する。
 *                                 `applyEnemyDamage` とは別キューを使うことで、
 *                                 通常攻撃ダメージ（赤系 `DamageFloater`）と
 *                                 反射ダメージ（オレンジ系 `ReflectDamageFloater`）
 *                                 を視覚的に区別する。`applyPlayerDamage` は呼ばない
 *                                 ため、プレイヤー HP は変動せず被弾演出も発火しない
 *                                 （`reflect-card-effect` 要件 2, 7）
 *   - `clearReflect()`          : `reflectActive` を `false` に戻す。`startExecution`
 *                                 のエッジフェーズで「直前ノードが reflect でない」
 *                                 場合に呼ばれ、反射効果が次の 1 ノードのみに
 *                                 限定されることを保証する（要件 4）
 *   - `dismissEnemyReflectEvent(id)`
 *                               : 指定 id を `enemyReflectEvents` から取り除く。
 *                                 `ReflectDamageFloater` の各浮き数字要素が
 *                                 `onAnimationEnd` で呼び出して自走 unmount する
 *                                 （既存 `dismissEnemyDamageEvent` と対称の責務）
 *   - `startVictorySequence(enemyId)`
 *                               : 勝利演出シーケンスを開始する。`enemies.json` で
 *                                 dead アニメが定義されていれば `'dead' →
 *                                 'fading' → 'cleared'` の 3 段、未定義なら
 *                                 `'fading' → 'cleared'` の 2 段で `victoryPhase`
 *                                 を遷移させる
 *   - `retryFromFail()`         : Fail オーバーレイの「やり直す」から呼ばれる。
 *                                 `failPhase` を `null` に戻し、HP・演出キュー・
 *                                 通過軌跡・`guardShield` をすべてクリアして
 *                                 A 状態に戻す。`slotAssignments` / `handCards` は
 *                                 意図的に触らないため、プレイヤーは前回のカード
 *                                 配置を残したままピンポイントで直して再挑戦できる
 *
 * `endDrag` は `source`（`'hand'` またはスロット ID）と `destination`
 * （スロット ID または `null`）の組み合わせで状態遷移する純粋関数的実装。
 */

const HAND = 'hand';
const TRANSITION_DURATION_MS = 250;
const NODE_PHASE_MS = 800;
const EDGE_PHASE_MS = 400;
const VICTORY_FADE_DURATION_MS = 500;
let executionTimers = [];

function cancelExecutionTimers() {
  executionTimers.forEach((id) => clearTimeout(id));
  executionTimers = [];
}

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
  traversedEdgeIds: [],
  traversedNodeIds: [],
  currentEnemyHp: 0,
  maxEnemyHp: 0,
  enemyDamageEvents: [],
  victoryPhase: null,
  failPhase: null,
  _enemyDamageCounter: 0,
  currentPlayerHp: 0,
  maxPlayerHp: 0,
  playerDamageEvents: [],
  _playerDamageCounter: 0,
  playerHealEvents: [],
  _playerHealCounter: 0,
  playerShakeEvents: [],
  _playerShakeCounter: 0,
  guardShield: 0,
  reflectActive: false,
  enemyReflectEvents: [],
  _enemyReflectCounter: 0,

  /**
   * ステージ定義から配置状態を初期化する。
   *
   * 手札・スロット割当・ドラッグ中フラグ・敵 HP・敵向けダメージ演出キュー・
   * プレイヤー HP・プレイヤー向けダメージ演出キュー・プレイヤー向けヒール
   * 演出キュー・勝利演出フェーズ（`victoryPhase`）・失敗演出フェーズ
   * （`failPhase`）・通過済みエッジ／ノード配列（`traversedEdgeIds` /
   * `traversedNodeIds`）・防御シールド残量（`guardShield`）・リフレクト
   * 状態（`reflectActive`）・反射ダメージ演出キュー（`enemyReflectEvents`）を
   * 初期化する。`isExpanded` には触れない
   * （「拡大状態でリセットを押しても拡大は保たれる」挙動が成立する：
   * `flowchart-zoom` 要件 6-1）。`victoryPhase` / `failPhase` を `null` に戻し、
   * `traversedEdgeIds` / `traversedNodeIds` を空配列に戻すことで、CLEAR!
   * 演出の名残（透過したスプライト・CLEAR! テキスト）も Fail 演出の名残
   * （半透過した敵スプライト・Fail オーバーレイ・通過軌跡の白い光）も
   * 残さず通常状態へ復帰する（`victory-clear` 要件 7-1, 7-4 ／
   * `battle-fail-retry` 要件 6-1, 6-2）。
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
   * 関数冒頭で `cancelExecutionTimers()` を呼び、`startExecution` で
   * スケジュールされていた全 `setTimeout` を破棄する。ステージ切替時や
   * リセットボタン押下時に過去の実行のタイマーが残ったまま新しい状態を
   * セットすると、後から発火したタイマーが新しい実行を妨害する可能性が
   * あるため、防御的に破棄しておく。
   *
   * Args:
   *     stage (object): `stages.json` の 1 ステージ分。`cards` と `slots` を持つ。
   */
  initializeBattle: (stage) => {
    cancelExecutionTimers();
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
      playerShakeEvents: [],
      victoryPhase: null,
      failPhase: null,
      traversedEdgeIds: [],
      traversedNodeIds: [],
      guardShield: 0,
      reflectActive: false,
      enemyReflectEvents: [],
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
   * フェーズ種別ごとに異なる時間（ノードフェーズ = `NODE_PHASE_MS` = 1000ms、
   * エッジフェーズ = `EDGE_PHASE_MS` = 500ms）で順次 `setTimeout` 発火する。
   * 各フェーズの開始時刻は事前に累積で計算（`phaseStartMs` 配列）し、各フェーズ
   * の持続時間は `phaseDurations` 配列に格納する。これによりステージのスロット
   * 数によらず「エッジ移動は常に 500ms、ノードでの効果発火は常に 1000ms」と
   * いう一定のテンポが保たれる（以前は `EXECUTION_PER_CARD_MS / phases.length`
   * の等分配で、スロット数によってフェーズ単価が変動していた）。`currentPhaseMs`
   * は各フェーズ進入時にそのフェーズの持続時間で更新され、`AnimatedProgressEdge`
   * の進行アニメーション速度（エッジ通過時 0.5 秒）と連動する。最後に
   * `isExecuting` を `false`、`executionStep` と `currentPhaseMs` を `null` に
   * 戻す。シーケンス完了時点で `currentEnemyHp === 0` なら、続けて
   * `startVictorySequence(stage.enemyId)` を呼び出して CLEAR! 演出を起動する
   * （`victory-clear` 要件 1-1, 1-3：実行終了の合図に同期して勝利演出を始める）。
   *
   * シーケンス開始時には `currentEnemyHp` を `maxEnemyHp` に、
   * `currentPlayerHp` を `maxPlayerHp` に戻し、両側のダメージ演出キュー
   * （`enemyDamageEvents` / `playerDamageEvents`）およびヒール演出キュー
   * （`playerHealEvents`）も空配列にクリアし、`guardShield` も 0、`reflectActive`
   * も `false`、`enemyReflectEvents` も空配列に戻す。これにより各実行は
   * 「フレッシュな状態からの再生」として独立する（attack-processing 要件 3-1、
   * monster-attack 要件 5-1、heal-card 要件 6-6、guard-card-effect 要件 4-2、
   * reflect-card-effect 要件 5-2）。
   *
   * 各ノードフェーズではスロット上のカード `id` を見て独立した `if` 分岐で
   * 効果を発火する：
   *   - `attack` カード → `applyEnemyDamage(card.power)`（敵 HP を減らす）
   *   - `monster` カード → `reflectActive` で分岐：true なら
   *     `applyReflectDamage(card.power)`（敵 HP を power 減らし、オレンジフロート
   *     を発火、プレイヤー HP は不変）、false なら `consumeShieldOnDamage(card.power)`
   *     （シールド残量があれば吸収量を差し引いた残ダメージを `applyPlayerDamage`
   *     に渡し、シールドが 0 なら `applyPlayerDamage(card.power)` を直接呼ぶ）。
   *     モンスターカードは `lockedCard` でステージ定義から固定配置されている
   *     ためユーザー操作では現れない
   *   - `heal` カード → `applyPlayerHeal(card.power)`（プレイヤー HP を回復し、
   *     `maxPlayerHp` でクランプする。HP が満タンでも演出キューには push
   *     されるため、緑フラッシュと「+N」フロートは通常通り再生される
   *     ／heal-card 要件 2-3, 4-4）
   *   - `guard` カード → `applyGuard(card.power)`（`guardShield` に `power` を
   *     上書きセットし、同時に `reflectActive` を `false` にクリアする）。
   *     直後 1 ノード分のみ有効な一時シールドとして機能する
   *     （guard-card-effect 要件 1, 5、reflect-card-effect 要件 6-2）
   *   - `reflect` カード → `applyReflect()`（`reflectActive` を `true` にセットし、
   *     同時に `guardShield` を 0 にクリアする）。直後 1 ノード分のみ有効な
   *     反射状態として機能する。`reflect` カードは設計上 `power` を持たないため、
   *     `card.power > 0` のガードを使わず `card.id === 'reflect'` の存在チェック
   *     だけで分岐する（reflect-card-effect 要件 1, 6-1）
   * いずれも `card.power > 0` でガードしている（reflect は例外）。`else if` では
   * なく独立 `if` の並列構造にすることで、将来カード種別が追加されたときに
   * 順序依存無く拡張できる。
   *
   * 各エッジフェーズでは「直前ノードが guard でなく、かつ `guardShield > 0`」
   * のとき `clearGuard()` を呼んでシールドを 0 に戻し、「直前ノードが reflect で
   * なく、かつ `reflectActive === true`」のとき `clearReflect()` を呼んで反射状態
   * を解除する。これにより、バフカード直後のエッジでは状態が維持され、次のノード
   * （モンスター／空き／別カード）を通過した後のエッジで初めて消える、という
   * 「効果は次の 1 ノードのみに適用」の挙動が両方のバフで成立する
   * （guard-card-effect 要件 3、reflect-card-effect 要件 4-1）。
   *
   * 各フェーズの `setTimeout` 内では、`executionStep` の更新と同時に通過軌跡
   * （`traversedEdgeIds` / `traversedNodeIds`）にもエッジ／ノードの id を
   * 蓄積する（`battle-fail-retry` 要件 1-1〜1-4）。`set` の関数形式で
   * `[...s.traversedEdgeIds, phase.id]` のように不変更新し、3 項演算子で
   * `phase.type` による振り分けを 1 つの状態更新オブジェクト内にまとめる
   * ことで React の再レンダリング回数を抑える。
   *
   * 完了タイマーでは「敵 HP === 0 かつ プレイヤー HP > 0」のときのみ勝利演出
   * （`startVictorySequence`）を起動し、それ以外（敵が残っている／相打ち）は
   * `failPhase: 'shown'` をセットして Fail フェーズに遷移する
   * （`battle-fail-retry` 要件 2-1, 2-2, 2-3、README 「勝利条件」記述に既存
   * 実装を合わせる訂正）。
   *
   * 各フェーズ `setTimeout` および完了タイマーの先頭で `if (get().failPhase
   * !== null) return;` の中断ガードを設ける。実行中にプレイヤー HP=0 で
   * `applyPlayerDamage` が `failPhase: 'shown'` を立てた場合、後続フェーズの
   * 副作用（軌跡 push・カード効果発火）と完了タイマーの勝敗判定をすべて
   * 打ち切る（`battle-fail-retry` 要件 2-4, 2-5）。
   *
   * さらに、`setTimeout` の戻り値（タイマー ID）をモジュールスコープの
   * `executionTimers` 配列に push しておき、`startExecution` 開始時・
   * `retryFromFail` 開始時・`initializeBattle` 開始時に `cancelExecutionTimers()`
   * で全タイマーを `clearTimeout` する。これは「Fail 中断後にユーザーが『やり
   * 直す』を押した瞬間 `failPhase` が `null` に戻ると、まだ scheduled だった
   * setTimeout の中断ガードが解除されて勝手に実行が再開する」というバグ
   * （`battle-fail-retry` の追加保護）を防ぐための明示破棄。early-return ガード
   * とタイマー破棄の二重防御により、どちらか一方が漏れても安全側に倒れる。
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
      cancelExecutionTimers();
      const phases = buildExecutionPath(stage);
      const phaseStartMs = [];
      const phaseDurations = [];
      let acc = 0;
      for (const phase of phases) {
        phaseStartMs.push(acc);
        const duration = phase.type === 'node' ? NODE_PHASE_MS : EDGE_PHASE_MS;
        phaseDurations.push(duration);
        acc += duration;
      }
      const totalMs = acc;

      set((s) => ({
        isExecuting: true,
        currentPhaseMs: phaseDurations[0],
        currentEnemyHp: s.maxEnemyHp,
        enemyDamageEvents: [],
        currentPlayerHp: s.maxPlayerHp,
        playerDamageEvents: [],
        playerHealEvents: [],
        playerShakeEvents: [],
        traversedEdgeIds: [],
        traversedNodeIds: [],
        failPhase: null,
        guardShield: 0,
        reflectActive: false,
        enemyReflectEvents: [],
      }));
      phases.forEach((phase, i) => {
        const timerId = setTimeout(() => {
          if (get().failPhase !== null) return;
          set((s) => ({
            executionStep: phase,
            currentPhaseMs: phaseDurations[i],
            ...(phase.type === 'edge'
              ? { traversedEdgeIds: [...s.traversedEdgeIds, phase.id] }
              : { traversedNodeIds: [...s.traversedNodeIds, phase.id] }
            ),
          }));
          if (phase.type === 'node') {
            const card = get().slotAssignments[phase.id];
            if (card && card.id === 'attack' && card.power > 0) {
              get().applyEnemyDamage(card.power);
            }
            if (card && card.id === 'monster' && card.power > 0) {
              if (get().reflectActive) {
                get().applyReflectDamage(card.power);
              } else {
                get().consumeShieldOnDamage(card.power);
              }
            }
            if (card && card.id === 'heal' && card.power > 0) {
              get().applyPlayerHeal(card.power);
            }
            if (card && card.id === 'guard' && card.power > 0) {
              get().applyGuard(card.power);
            }
            if (card && card.id === 'reflect') {
              get().applyReflect();
            }
          }
          if (phase.type === 'edge') {
            const prevPhase = phases[i - 1];
            if (prevPhase && prevPhase.type === 'node') {
              const prevCard = get().slotAssignments[prevPhase.id];
              const isPrevGuard = prevCard && prevCard.id === 'guard';
              const isPrevReflect = prevCard && prevCard.id === 'reflect';
              if (!isPrevGuard && get().guardShield > 0) {
                get().clearGuard();
              }
              if (!isPrevReflect && get().reflectActive) {
                get().clearReflect();
              }
            }
          }
        }, phaseStartMs[i]);
        executionTimers.push(timerId);
      });
      const completeTimerId = setTimeout(() => {
        if (get().failPhase !== null)return;
        set({ isExecuting: false, executionStep: null, currentPhaseMs: null });
        const { currentEnemyHp, currentPlayerHp } = get();
        if (currentEnemyHp === 0 && currentPlayerHp > 0) {
          get().startVictorySequence(stage.enemyId);
        } else {
          set({ failPhase: 'shown' });
        }
      }, totalMs);
      executionTimers.push(completeTimerId);
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
    * 実行中（`state.isExecuting === true`）にプレイヤー HP が 0 に達した場合は、
    * 同じ `set` トランザクション内で `failPhase: 'shown'` ／ `isExecuting: false`
    * ／ `executionStep: null` ／ `currentPhaseMs: null` ／ `guardShield: 0` ／
    * `reflectActive: false` を一括で更新し、残りのフェーズ実行を即座に中断する
    * （`battle-fail-retry` 要件 2-4、guard-card-effect 要件 4-4、reflect-card-effect
    * 要件 5-4）。1 つの `set` 呼び出しで全フィールドを変更することで
    * 「`currentPlayerHp === 0` だけど `failPhase === null`」のような途中状態を
    * 観測されないようにする。これにより「HP=0 でモンスター被弾を受けたあと
    * heal カードで復活すれば勝利できる」という抜け道を防ぐ。実行中以外
    * （`isExecuting === false`）の経路で HP=0 に到達しても中断状態にはしない
    * （防御的なガード）。
    *
    * 中断後にスケジュール済みの `setTimeout` が発火しても、`startExecution`
    * 内の各 `setTimeout` コールバック先頭で `failPhase !== null` をガードして
    * いるため、軌跡 push やカード効果発火は実行されない（要件 2-5）。
    *
    * Args:
    *     amount (number): 与えるダメージ量。負の値や 0 は呼び出し側で
    *         弾く前提だが、内部的には `Math.max(0, ...)` で 0 クランプする。
    */
   applyPlayerDamage: (amount) => set((state) => {
    const nextHp = Math.max(0, state.currentPlayerHp - amount);
    const id = `pd-${state._playerDamageCounter}`;
    const result = {
      currentPlayerHp: nextHp,
      playerDamageEvents: [...state.playerDamageEvents, { id, amount }],
      _playerDamageCounter: state._playerDamageCounter + 1,
    };
    if (nextHp === 0 && state.isExecuting) {
      result.failPhase = 'shown';
      result.isExecuting = false;
      result.executionStep = null;
      result.currentPhaseMs = null;
      result.guardShield = 0;
      result.reflectActive = false;
      result.playerShakeEvents = [];
    }
    return result;
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
    * 指定 id のプレイヤー縦シェイクイベントを `playerShakeEvents` から削除する。
    *
    * `BattleScreen` のプレイヤー HP ボックスが `onAnimationEnd` 時に
    * 「最新の id」を `consumedPlayerShakeId` に進めることで `isPlayerShaken`
    * 派生計算が `false` に戻り、`.shakenVert` クラスが除去されてアニメが
    * 完了する流れになる。本アクションはキュー自体の累積を防ぐためのもので、
    * 既存の `dismissPlayer*Event` シリーズと完全対称の責務を持つ。
    *
    * Args:
    *     id (string): 削除対象のシェイクイベント id。`playerShakeEvents`
    *         内に該当が無ければ no-op。
    */
   dismissPlayerShakeEvent: (id) => set((state) => ({
    playerShakeEvents: state.playerShakeEvents.filter((e) => e.id !== id),
   })),

   /**
    * 防御シールドを付与する。
    *
    * `guardShield` フィールドに `amount` をそのままセットする（既存値との累積は
    * せず上書き式）。同時に `reflectActive` を `false` にクリアする：guard と
    * reflect は互いに排他のバフ系として扱い、後発のバフが先発を上書きする
    * （`reflect-card-effect` 要件 6-2）。`startExecution` の防御カード
    * （`id === 'guard'`）ノードフェーズから呼ばれる。上書き式にすることで、
    * 同一実行内に複数の防御カードが配置されている場合でも「最後に通った防御
    * カードの power」が有効になる（`guard-card-effect` 要件 5-1）。直後 1
    * ノード分のみ有効で、次のエッジフェーズで `clearGuard` が呼ばれて 0 に
    * 戻る運用を `startExecution` 側で担保する。
    *
    * Args:
    *     amount (number): シールドとしてセットする値。`card.power` がそのまま
    *         渡される前提で、呼び出し側で `card.power > 0` をガードしている。
    */
   applyGuard: (amount) => set({ guardShield: amount, reflectActive: false }),

   /**
    * シールド吸収を考慮してプレイヤーにダメージを適用する。
    *
    * `guardShield` が正の値の場合は `Math.min(guardShield, amount)` を吸収量
    * として算出し、`guardShield` から減算する。残ダメージ（`amount - absorbed`）
    * が正なら `applyPlayerDamage(remaining)` を呼んで通常の被弾処理（HP 減算・
    * 被弾フロート・HP バー shake・実行中の HP=0 中断ガード）に流す。完全吸収
    * された場合（`remaining === 0`）は `applyPlayerDamage` を呼ばないため、
    * 被弾演出は発火しない（`guard-card-effect` 要件 2-3）。
    *
    * `guardShield` が 0 の場合は `applyPlayerDamage(amount)` を直接呼ぶだけで、
    * 従来挙動と完全互換。これにより `startExecution` のモンスターカード分岐は
    * シールド有無を意識せず `consumeShieldOnDamage` を呼ぶだけでよい。
    *
    * `set` を 2 回（シールド減算と HP 減算が別アクション）に分けることで、
    * `applyPlayerDamage` 内の死亡検知・中断ロジックを変更せずに再利用できる。
    * 視覚的にもシールド減算 → HP 減算の 2 段階アニメーションになり、「シールドが
    * まず削れて、その後 HP が削れる」流れがプレイヤーに伝わる。
    *
    * Args:
    *     amount (number): モンスターカードの `power` 値。シールド吸収前の生
    *         ダメージ。
    */
   consumeShieldOnDamage: (amount) => {
    const shield = get().guardShield;
    if (shield > 0) {
      const absorbed = Math.min(shield, amount);
      const remaining = amount - absorbed;
      set({ guardShield: shield - absorbed });
      if (remaining > 0) {
        get().applyPlayerDamage(remaining);
      }
    } else {
      get().applyPlayerDamage(amount);
    }
   },

   /**
    * 防御シールドを 0 にクリアする。
    *
    * `startExecution` のエッジフェーズで「直前のノードが防御カードでなく、
    * かつ `guardShield > 0`」のときに呼ばれる。これにより防御カードの効果が
    * 「直後の 1 ノードのみに適用」される挙動が成立し、その次のノードを通過
    * した時点で残量があれば（モンスター以外で消費されなかった場合）まとめて
    * 消滅する（`guard-card-effect` 要件 3-1, 3-2）。余剰防御値の持ち越しは
    * しない設計のため、本アクションは値をチェックせず常に 0 にセットする。
    */
   clearGuard: () => set({ guardShield: 0 }),

   /**
    * リフレクト状態を有効化する。
    *
    * `reflectActive` フィールドを `true` にセットし、同時に `guardShield` を 0 に
    * クリアする。guard と reflect は互いに排他のバフ系として扱い、後発のバフが
    * 先発を上書きする（`reflect-card-effect` 要件 6-1）。`startExecution` の
    * カウンターカード（`id === 'reflect'`）ノードフェーズから呼ばれる。直後 1
    * ノード分のみ有効で、次のエッジフェーズで `clearReflect` が呼ばれて `false`
    * に戻る運用を `startExecution` 側で担保する。
    *
    * `reflect` カードは設計上 `power` を持たない（`stages.json` で
    * `{ "id": "reflect" }` のみ）ため、`applyReflect` は引数を取らない。
    * 反射時のダメージは「敵モンスターの攻撃値そのもの」を `applyReflectDamage`
    * 経由で敵 HP に反映する。
    */
   applyReflect: () => set({ reflectActive: true, guardShield: 0 }),

   /**
    * 反射成立時に敵にダメージを与える。
    *
    * `currentEnemyHp` を `amount` 減算（0 クランプ）し、`enemyReflectEvents`
    * に新規イベント `{ id: 'er-${counter}', amount }` を push する。
    * `_enemyReflectCounter` を `+1` してユニーク ID の単調増加を保つ。`id` の
    * `er-` プレフィックスは敵被弾（`d-`）／プレイヤー被弾（`pd-`）／ヒール
    * （`ph-`）と区別する識別子で、React の key として使う。
    *
    * `applyEnemyDamage` とは **別キュー**（`enemyReflectEvents`）に push する
    * ことで、通常攻撃ダメージ（赤系 `DamageFloater`）と反射ダメージ
    * （オレンジ系 `ReflectDamageFloater`）を視覚的に区別する設計
    * （`reflect-card-effect` 要件 2-3, 2-4, 7-4）。`applyPlayerDamage` は呼ばない
    * ため、反射成立時はプレイヤー HP が変動せず被弾フロート・HP バー赤フラッシュ
    * は発火しない（要件 2-2）。
    *
    * 同じ `set` トランザクション内で `playerShakeEvents` にも `{ id: 'ps-${
    * counter}' }` を push する。これにより `BattleScreen` 側で `isPlayerShaken`
    * 派生計算が `true` になり、プレイヤー HP バーラッパー（`playerHpBox`）に
    * `.shakenVert` クラスが付与され、縦揺れアニメ（`@keyframes hpBoxShakeVert`）
    * が 1 ショット再生される。敵側にも `isEnemyReflected` の派生計算経由で
    * 同じ `.shakenVert` クラスが付与され、両者の HP バーが同時に縦に揺れる
    * 演出となる。プレイヤー HP を変動させずに「攻撃が来たが跳ね返した」反射感
    * を視覚化するための専用キュー設計で、`playerDamageEvents` を共有すると
    * `PlayerDamageFloater` が `-0` のフロートを発火してしまうため別系統にする。
    *
    * 反射ダメージで敵 HP=0 に達した場合、`startExecution` の完了タイマーが
    * 「敵 HP === 0 かつ プレイヤー HP > 0」を判定して通常通り勝利演出を起動
    * する（要件 2-5）。
    *
    * Args:
    *     amount (number): モンスターカードの `power` 値。反射ダメージ量として
    *         そのまま敵 HP に適用する。
    */
   applyReflectDamage: (amount) => set((state) => {
    const nextHp = Math.max(0, state.currentEnemyHp - amount);
    const id = `er-${state._enemyReflectCounter}`;
    const shakeId = `ps-${state._playerShakeCounter}`;
    return {
      currentEnemyHp: nextHp,
      enemyReflectEvents: [...state.enemyReflectEvents, { id, amount }],
      _enemyReflectCounter: state._enemyReflectCounter + 1,
      playerShakeEvents: [...state.playerShakeEvents, { id: shakeId }],
      _playerShakeCounter: state._playerShakeCounter + 1,
    };
   }),

   /**
    * リフレクト状態を解除する。
    *
    * `reflectActive` を `false` に戻す。`startExecution` のエッジフェーズで
    * 「直前のノードがカウンターカードでなく、かつ `reflectActive === true`」の
    * とき呼ばれる。これにより反射効果が「直後の 1 ノードのみに適用」される
    * 挙動が成立し、その次のノードを通過した時点で（モンスターで使用されても、
    * モンスター以外で素通りしても）まとめて解除される（`reflect-card-effect`
    * 要件 4）。本アクションは値をチェックせず常に `false` にセットする。
    */
   clearReflect: () => set({ reflectActive: false }),

   /**
    * 指定 id の反射ダメージイベントを `enemyReflectEvents` から削除する。
    *
    * `ReflectDamageFloater` の各浮き数字要素が `onAnimationEnd` で呼び出し、
    * 自身を配列から取り除いて自走 unmount する。これにより
    * `enemyReflectEvents` が累積し続けるのを防ぐ。既存の
    * `dismissEnemyDamageEvent` と完全対称の責務を持つ（`reflect-card-effect`
    * 要件 7-3）。
    *
    * Args:
    *     id (string): 削除対象のリフレクトダメージイベント id。
    *         `enemyReflectEvents` 内に該当が無ければ no-op。
    */
   dismissEnemyReflectEvent: (id) => set((state) => ({
    enemyReflectEvents: state.enemyReflectEvents.filter((e) => e.id !== id),
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

   /**
    * Fail フェーズからの「やり直す」アクション。
    *
    * Fail オーバーレイの「やり直す」ボタンから呼び出される。`failPhase` を
    * `null` に戻し、敵 HP・プレイヤー HP を各 `maxHp` に復元、敵向け／プレイヤー
    * 向けのダメージ演出キューおよびヒール演出キューをすべて空にし、通過軌跡
    * （`traversedEdgeIds` / `traversedNodeIds`）と防御シールド（`guardShield`）、
    * リフレクト状態（`reflectActive`）、反射ダメージ演出キュー
    * （`enemyReflectEvents`）もクリアする。これにより画面は「実行前の操作可能
    * 状態（A 状態）」に戻る（`battle-fail-retry` 要件 5-1, 5-3, 5-4, 5-5、
    * `guard-card-effect` 要件 4-3、`reflect-card-effect` 要件 5-3）。
    *
    * `initializeBattle` との最大の違いは、**`slotAssignments` と `handCards`
    * を意図的に触らないこと**（`battle-fail-retry` 要件 5-2）。これにより
    * プレイヤーは前回のフローチャートの構成をそのまま残した状態で、直したい
    * カードだけをピンポイントで差し替えて再挑戦できる。`initializeBattle` は
    * スロット配置をステージ定義から再構築する（ロックカード復元含む）責務な
    * ので、引数オプションで分岐させずに別アクションとして分離する設計を採用
    * している。
    *
    * 演出キュー 3 種を空にする理由：これらを残したまま再実行すると、前回の
    * 被弾・回復フロート演出が画面に残ったまま新しい実行が始まり、「いつの
    * 演出か」がわからなくなる。`startExecution` 開始時にも同様のクリアが走る
    * が、本アクションでクリアすることで「やり直すボタンを押した瞬間に画面が
    * 綺麗な状態に戻る」体験を担保する。
    *
    * `set` を呼ぶ前に `cancelExecutionTimers()` で `startExecution` 中に
    * スケジュールされていた全 `setTimeout` を破棄するのが重要。これを呼ばずに
    * `failPhase` を `null` に戻すと、Fail 中断時点で残っていた scheduled な
    * タイマーが発火して `failPhase !== null` の早期 return ガードを通過して
    * しまい、勝手に実行が再開してしまうバグが起きる。タイマー破棄を最初に
    * 行うことで、後続の `set` で `failPhase` を解除しても安全な状態が保たれる。
    *
    * 敵スプライトの半透過（`.dimmed`）と敵 HP バーの半透過は `failPhase ===
    * 'shown'` に連動するクラス制御で実装されているため、`failPhase` を
    * `null` に戻すだけで自動的に解除される（明示的な状態フィールドは持たない）。
    *
    * `set` の関数形式 `(state) => (...)` を使うのは、`state.maxEnemyHp` /
    * `state.maxPlayerHp` を読みたいため。オブジェクト形式 `set({...})` だと
    * 現在の状態を参照できない。
    */
   retryFromFail: () => {
    cancelExecutionTimers();
    set((state) => ({
      failPhase: null,
      currentEnemyHp: state.maxEnemyHp,
      currentPlayerHp: state.maxPlayerHp,
      enemyDamageEvents: [],
      playerDamageEvents: [],
      playerHealEvents: [],
      playerShakeEvents: [],
      traversedEdgeIds: [],
      traversedNodeIds: [],
      guardShield: 0,
      reflectActive: false,
      enemyReflectEvents: [],
   }));
  },
}));

export default useBattleStore;
export { HAND, selectAllSlotsFilled };
