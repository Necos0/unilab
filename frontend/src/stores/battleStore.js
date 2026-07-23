import { create } from 'zustand';
import enemiesData from '../data/enemies.json';
import playerData from '../data/player.json';
import evaluateCondition from '../engine/evaluateCondition';
import { simulateBattle } from '../engine/simulateBattle';

/**
 * バトル状態を一元管理する Zustand ストア。
 *
 * 手札（`handCards`）・スロット割当（`slotAssignments`）・ドラッグ中の
 * カード（`activeInstanceId`）・フローチャートの拡大状態（`isExpanded`）・
 * 切替アニメーション中フラグ（`isTransitioning`）・敵 HP（`currentEnemyHp`
 * / `maxEnemyHp`）・敵向けダメージ演出キュー（`enemyDamageEvents`）・プレイヤー
 * HP（`currentPlayerHp` / `maxPlayerHp`）・プレイヤー向けダメージ演出キュー
 * （`playerDamageEvents`）・プレイヤー向けヒール演出キュー
 * （`playerHealEvents`）・プレイヤー向けガード演出キュー
 * （`playerGuardEvents`）・勝利演出フェーズ（`victoryPhase`）・失敗演出フェーズ
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
 *   - `collapseFlowchart()`     : 拡大状態を即座に縮小へ戻す（`isExpanded` /
 *                                 `isTransitioning` を false に）。バトル離脱
 *                                 （`BattleScreen` unmount）時に呼び、拡大状態が
 *                                 次バトルへ持ち越されるのを防ぐ
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
 *                                 上書き）。同時にプレイヤー向けガード演出イベントを
 *                                 `playerGuardEvents` に push し、`reflectActive` を
 *                                 false にクリアする。`startExecution` の防御カード
 *                                 フェーズで呼ばれる。上書き式にすることで連続防御
 *                                 カードに対応する（`guard-card-effect` 要件 5）
 *   - `dismissPlayerGuardEvent(id)`
 *                               : 指定 id のプレイヤー向けガードイベントを
 *                                 `playerGuardEvents` から取り除く
 *                                 （`PlayerGuardFloater` 等の演出側からの自走削除）
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
const GUARD_TO_HP_DELAY_MS = 250;
const VICTORY_FADE_DURATION_MS = 500;
const LOOP_MAX_VISITS = 100;
/*
 * 加速実行（最終ボス第二形態）の定数。実行中のフェーズ消化数から進行度
 * t（0〜1、ACCEL_RAMP_PHASES で 1 に到達）を取り、easeInQuad（t²）で速度
 * 倍率を 1 倍 → ACCEL_MAX_SPEED 倍へ引き上げる。序盤はほぼ等速で、周回を
 * 重ねるほど加速の伸びが大きくなり、終盤に一気に最高速へ達する。
 * フェーズ時間は「基準時間 ÷ 速度倍率」で、下限（ACCEL_MIN_*_MS）で止める。
 * ACCEL_RAMP_PHASES = 120 はループ約 20 周ぶん（1 周 ≒ ノード 3 + エッジ 3
 * = 6 フェーズ）。HP9999 ÷ ひっさつカード 300 = 34 周なので、後半 14 周は
 * 最高速で押し切る配分になる（全体で 20 秒前後）。
 */
const ACCEL_RAMP_PHASES = 120;
const ACCEL_MAX_SPEED = 24;
const ACCEL_MIN_NODE_MS = 30;
const ACCEL_MIN_EDGE_MS = 18;
/*
 * ボス復活（第二形態突入）演出の時間割。dead アニメ完了から
 * REVIVE_DEAD_HOLD_MS 置いて白フラッシュ開始 → REVIVE_FLASH_IN_MS で
 * 真っ白になった瞬間に第二形態へ差し替え → REVIVE_FADE_OUT_MS かけて
 * 白が明けて新しい盤面が現れる。CSS 側（BossReviveOverlay.module.css）の
 * アニメーション時間と同期させること。
 */
const REVIVE_DEAD_HOLD_MS = 600;
const REVIVE_FLASH_IN_MS = 500;
const REVIVE_FADE_OUT_MS = 900;
const SPEED_MULTIPLIERS = [1, 2];
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
 * `{ instanceId: 'locked-<slotId>', id, power, counterId, locked: true }`
 * のロック付き `CardInstance` で埋める。`lockedCard` を持たないスロットは
 * 従来どおり `null`（空き）にする。`locked: true` フラグは `DraggableCard`
 * の `disabled` 判定および `computeDropTransition` のガードで参照され、
 * ユーザー操作からの drag-out / drop-onto を抑止する役割を持つ
 * （monster-attack 要件 2-2, 2-3）。
 *
 * `counterId` フィールド（`loop-counter` 仕様）：`lockedCard.id === 'counter'`
 * のスロット（カウンタノード）では `slot.lockedCard.counterId` の値がそのまま
 * `card.counterId` として伝播し、`scheduleNodePhase` が counter ノード到達時に
 * `incrementCounter(card.counterId)` を呼ぶときの引数になる（要件 3-2 / 9-1）。
 * counter 以外の lockedCard（`monster` 等）では `slot.lockedCard.counterId === undefined`
 * となり `card.counterId = undefined` がそのまま運ばれるが、ランタイム側の
 * `if (card.id === 'counter' && card.counterId)` ガードで自然に無視される
 * （後方互換、要件 10-3）。
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
 *         は `{id: string, power?: number, counterId?: string}` の形で、
 *         未定義なら空きスロット。counter スロットでは `id === 'counter'`
 *         かつ `counterId` が非空文字列。
 *
 * Returns:
 *     Object<string, CardInstance | null>: スロット ID をキーに、ロック
 *         カードか `null` を値とするマップ。ロックカード側は
 *         `{instanceId, id, power, counterId, locked}` の形で、`power` /
 *         `counterId` はカード種別に応じて未定義のことがある。
 */
function buildSlotAssignmentsFromStage(stage) {
  const assignments = {};
  for (const slot of stage.slots ?? []) {
    if(slot.lockedCard){
      assignments[slot.id] = {
        instanceId: `locked-${slot.id}`,
        id: slot.lockedCard.id,
        power: slot.lockedCard.power,
        counterId: slot.lockedCard.counterId,
        locked: true,
      };
    } else {
      assignments[slot.id] = null;
    }
  }
  return assignments;
}

/**
 * ステージ定義からスロット静的メタ情報マップを生成する
 * （`restricted-slot` / `multiplier-slot` / `loop-counter` 仕様）。
 *
 * `acceptOnly`（種別制限）または `multiplier`（効果倍率：数値リテラルまたは
 * カウンタ参照）が指定されているスロットを
 * `{ [slotId]: { acceptOnly?, multiplier?, counterRef? } }` の形のマップに
 * まとめる。両方持つスロットは 1 エントリに両キーが入る。`slotAssignments`
 * （実行中に動的に変化）と分けて管理することで、カード配置の状態更新時に
 * 毎回静的情報を運び直す必要がなくなる。`buildSlotAssignmentsFromStage` と
 * 並列の責務（ステージ初期化時の派生計算）。
 *
 * **multiplier の振り分け**（`loop-counter` 仕様）：`slot.multiplier` の型で
 * 二分岐し、entry に積むキーを排他的に決める：
 *   - `typeof slot.multiplier === 'number'` → `entry.multiplier = slot.multiplier`
 *     （既存の数値リテラル経路、完全後方互換）
 *   - `typeof slot.multiplier === 'object' && slot.multiplier !== null`
 *     → `entry.counterRef = slot.multiplier.counterRef`（新規のカウンタ参照経路）
 *   - undefined → 何もしない（entry に追加しない）
 *
 * `slot.multiplier !== null` の明示ガードは `typeof null === 'object'` という
 * JavaScript の仕様の罠を避けるための防御策。ローダー（`stagesLoader.isValidMultiplier`
 * → `validateCounterPairs`）で不正値は既にフィルタされているが、ランタイム側
 * も型ベースで素直に判別できるよう明示する。
 *
 * **entry.multiplier と entry.counterRef は排他**：1 つの multiplier スロットは
 * 「固定倍率」か「カウンタ連動」のどちらか一方のみ。これにより `scheduleNodePhase`
 * 側の倍率解決が `typeof meta?.multiplier === 'number'` と
 * `typeof meta?.counterRef === 'string'` の単純な分岐で済む。
 *
 * どちらのフィールドも持たないスロットはマップに登録しない（`entry` が空なら
 * skip）。参照側は `state.slotMetadata[slotId]?.acceptOnly` /
 * `state.slotMetadata[slotId]?.multiplier ?? 1` の optional chaining + フォール
 * バックで判定する。これにより「未指定スロットは従来通りの挙動（全カード受け
 * 入れ・倍率 1）」が分岐コストなしで成立する（restricted-slot 要件 6-1、
 * multiplier-slot 要件 2-7 / 5-1、loop-counter 要件 10-1 / 10-2）。
 *
 * `acceptOnly` と `multiplier` / `counterRef` は独立フィールドで、ローダー
 * （`stagesLoader`）でも排他チェックを行わないため、ここでも各キーを個別に拾う。
 * 将来さらにスロット制限フィールドが増えても、同じ entry オブジェクトにキーを
 * 足すだけで拡張できる構造。
 *
 * Args:
 *     stage (object): `stages.json` の 1 ステージ分。`slots` 配列を持ち、
 *         各スロットは `{id, position, lockedCard?, acceptOnly?, multiplier?}` の形。
 *         `multiplier` は数値リテラル（2 以上の整数）または `{counterRef: 非空文字列}`
 *         オブジェクトを取り得る。
 *
 * Returns:
 *     Object<string, {acceptOnly?: string, multiplier?: number, counterRef?: string}>:
 *         スロット ID をキーに、メタ情報オブジェクトを値とするマップ。
 *         `multiplier` と `counterRef` は排他（同一エントリに両方は入らない）。
 *         該当スロットがなければ空オブジェクト。
 */
function buildSlotMetadataFromStage(stage) {
  const metadata = {};
  for (const slot of stage.slots ?? []) {
    const entry = {};
    if (slot.acceptOnly) entry.acceptOnly = slot.acceptOnly;
    if (typeof slot.multiplier === 'number') {
      entry.multiplier = slot.multiplier;
    } else if (typeof slot.multiplier === 'object' && slot.multiplier !== null) {
      entry.counterRef = slot.multiplier.counterRef;
    }
    if (Object.keys(entry).length > 0) {
      metadata[slot.id] = entry;
    }
  }
  return metadata;
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
 * `instanceId` をキーに、手札・スロット割当の両方から `CardInstance` を探す。
 *
 * `BattleScreen.selectActiveCard` と同じロジックの純関数版（あちらは Zustand
 * セレクタとして `state` を内部で取るスタイル、こちらは `state` を引数で受け取る）。
 * `computeDropTransition` の `acceptOnly` ガード（`restricted-slot` 仕様）で
 * 「いまドラッグされているカードの種別 id」を即座に取り出すために使う。
 *
 * 手札を先に検索する理由は単純に最も一般的なケース（手札からスロットへドラッグ）
 * を高速に判定するため。スロット間移動の場合は `slotAssignments` 走査にフォール
 * バックする。両方に見つからなければ `null` を返し、呼び出し側のガードが
 * 「異常系として既存挙動に流す」フォールバックを担う。
 *
 * Args:
 *     state (object): 現在のストア状態。`handCards` と `slotAssignments` を持つ。
 *     instanceId (string): 検索する `CardInstance` の `instanceId`。
 *
 * Returns:
 *     object | null: 見つかった `CardInstance`、または `null`。
 */
function findCardByInstanceId(state, instanceId) {
  const fromHand = state.handCards.find((c) => c.instanceId === instanceId);
  if (fromHand) return fromHand;
  for (const card of Object.values(state.slotAssignments)) {
    if (card && card.instanceId === instanceId) return card;
  }
  return null;
}

/**
 * ドラッグ終了時の状態遷移を計算する純粋関数。
 *
 * `source` と `destination` の組み合わせで 7 パターンに分岐する。
 * Zustand の `set` の引数として渡せる部分更新オブジェクトを返す。
 *
 * 関数冒頭で 5 つの早期リターンガードを通過する：
 *   1. 手札 → スロット外（`source === HAND && destination === null`）：
 *      何もしない（手札からの撤回扱い）
 *   2. 同一位置への drop（`source === destination`）：何もしない
 *   3. ドラッグ元スロットがロックカードを持つ（`sourceCard.locked`）：
 *      何もしない（モンスターカードを動かせない／monster-attack 要件 2-3）
 *   4. ドロップ先スロットがロックカードを持つ（`destCard.locked`）：
 *      何もしない（ロックスロットへ別カードを置けない／monster-attack 要件 2-2）
 *   5. ドロップ先スロットの `acceptOnly` 制限とカード id が不一致（`restricted-slot`
 *      仕様）：何もしない（カードは元の位置に戻る）。`state.slotMetadata[destination]`
 *      に `acceptOnly` がセットされていて、`findCardByInstanceId` で取り出した
 *      ドラッグ中カードの `id` が `acceptOnly` の値と一致しないときに発火する。
 *      ガード 4（lockedCard）は acceptOnly と排他なので順序の前後で挙動は変わらない
 *      が、「より特殊なケース（lockedCard 完全固定）を先」「次に新仕様（タイプ制限）」
 *      の順で並べて可読性を保つ。
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
    const meta = state.slotMetadata[destination];
    if (meta?.acceptOnly) {
      const draggedCard = findCardByInstanceId(state, instanceId);
      if (draggedCard && draggedCard.id !== meta.acceptOnly) {
        return {};
      }
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
  slotMetadata: {},
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
  revivePhase: null,
  isSecondPhase: false,
  overrideEnemyId: null,
  accelIntensity: 0,
  _enemyDamageCounter: 0,
  currentPlayerHp: 0,
  maxPlayerHp: 0,
  playerDamageEvents: [],
  _playerDamageCounter: 0,
  playerHealEvents: [],
  _playerHealCounter: 0,
  playerGuardEvents: [],
  _playerGuardCounter: 0,
  playerShakeEvents: [],
  _playerShakeCounter: 0,
  guardShield: 0,
  reflectActive: false,
  enemyReflectEvents: [],
  _enemyReflectCounter: 0,
  counterValues: {},
  activeCounterId: null,
  speedMultiplier: 1,

  /**
   * ステージ定義から配置状態を初期化する。
   *
   * 手札・スロット割当・ドラッグ中フラグ・敵 HP・敵向けダメージ演出キュー・
   * プレイヤー HP・プレイヤー向けダメージ演出キュー・プレイヤー向けヒール
   * 演出キュー・勝利演出フェーズ（`victoryPhase`）・失敗演出フェーズ
   * （`failPhase`）・通過済みエッジ／ノード配列（`traversedEdgeIds` /
   * `traversedNodeIds`）・防御シールド残量（`guardShield`）・リフレクト
   * 状態（`reflectActive`）・反射ダメージ演出キュー（`enemyReflectEvents`）・
   * カウンタ値マップ（`counterValues`）・現在発光中のカウンタ ID
   * （`activeCounterId`）を初期化する。`isExpanded` には触れない
   * （「拡大状態でリセットを押しても拡大は保たれる」挙動が成立する：
   * `flowchart-zoom` 要件 6-1）。`victoryPhase` / `failPhase` を `null` に戻し、
   * `traversedEdgeIds` / `traversedNodeIds` を空配列に戻すことで、CLEAR!
   * 演出の名残（透過したスプライト・CLEAR! テキスト）も Fail 演出の名残
   * （半透過した敵スプライト・Fail オーバーレイ・通過軌跡の白い光）も
   * 残さず通常状態へ復帰する（`victory-clear` 要件 7-1, 7-4 ／
   * `battle-fail-retry` 要件 6-1, 6-2）。
   *
   * 敵 HP は `stage.maxEnemyHp`（ステージ側の上書き、`flowchart-loop` 仕様）が
   * あればそれを最優先し、無ければ `enemies.json` から `stage.enemyId` に対応する
   * `maxHp` を取得して `maxEnemyHp` / `currentEnemyHp` の双方に設定する。これにより
   * パズル上必要な任意 HP（4-1=60 等）を共有 `enemies.json` を変更せずステージ
   * ごとに指定できる。プレイヤー
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
   * カウンタ初期化（`loop-counter` 仕様）：`stage.slots` を走査して
   * `lockedCard.id === 'counter'` かつ `counterId` が非空文字列のスロットを
   * 抽出し、それぞれの `counterId` を 0 で埋めた `counterValues` マップを構築する
   * （要件 3-1）。型ガードによりローダー（`validateCounterPairs`）で縮退済みの
   * counter（counterId を剥がされたもの）はキー集合に入らないため、ランタイム
   * で「無効な counter」が誤ってカウントされることもない。counter スロットを
   * 持たないステージでは `counterValues = {}` で初期化され、以降のカウンタ処理
   * は完全にスキップされる（後方互換性、要件 10-2）。`activeCounterId` は
   * 「いま発光中のカウンタ」を示す UI 連動用フィールドで、初期化時は常に
   * `null`（要件 7）。
   *
   * Args:
   *     stage (object): `stages.json` の 1 ステージ分。`cards` と `slots` を持つ。
   *         任意で `maxEnemyHp`（敵 HP のステージ上書き）を持つ。`slots[]` の
   *         一部に counter スロット（`lockedCard.id === 'counter'`）があれば、
   *         それらの `counterId` を 0 で埋めた `counterValues` が構築される。
   */
  initializeBattle: (stage) => {
    cancelExecutionTimers();
    const enemy = enemiesData.enemies.find((e) => e.id === stage.enemyId);
    const maxEnemyHp = stage.maxEnemyHp ?? enemy?.maxHp ?? 0;
    const maxPlayerHp = playerData.maxHp ?? 0;
    const counterIds = (stage.slots ?? [])
      .filter((s) => s.lockedCard?.id === 'counter' && typeof s.lockedCard.counterId === 'string')
      .map((s) => s.lockedCard.counterId);
    const counterValues = Object.fromEntries(counterIds.map((id) => [id, 0]));
    set(() => ({
      handCards: expandHandCards(stage.cards ?? []),
      slotAssignments: buildSlotAssignmentsFromStage(stage),
      slotMetadata: buildSlotMetadataFromStage(stage),
      activeInstanceId: null,
      maxEnemyHp,
      currentEnemyHp: maxEnemyHp,
      enemyDamageEvents: [],
      maxPlayerHp,
      currentPlayerHp: maxPlayerHp,
      playerDamageEvents: [],
      playerHealEvents: [],
      playerGuardEvents: [],
      playerShakeEvents: [],
      victoryPhase: null,
      failPhase: null,
      revivePhase: null,
      isSecondPhase: Boolean(stage.isSecondPhase),
      overrideEnemyId: null,
      accelIntensity: 0,
      traversedEdgeIds: [],
      traversedNodeIds: [],
      guardShield: 0,
      reflectActive: false,
      enemyReflectEvents: [],
      counterValues,
      activeCounterId: null,
      speedMultiplier: 1,
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

  toggleSpeedMultiplier: () => {
    set((s) => {
      const idx = SPEED_MULTIPLIERS.indexOf(s.speedMultiplier);
      const next = SPEED_MULTIPLIERS[(idx + 1) % SPEED_MULTIPLIERS.length];
      return { speedMultiplier: next };
    });
  },

  /**
   * 拡大状態のフローチャートを即座に縮小状態へ戻す。
   *
   * `isExpanded` と `isTransitioning` をともに false にする。`toggleExpand`
   * と違いトグルではなく縮小方向専用で、アニメーション猶予を取らずに即時
   * リセットする。`BattleScreen` の unmount（マップへ戻る全経路：`BackToMapButton`
   * / `BattleFailOverlay` / `VictoryClearOverlay`）時に呼び、拡大状態が次バトルへ
   * 持ち越されて「別ステージに入ったら拡大表示のまま」になるのを防ぐ。
   *
   * リセットボタン（`initializeBattle`）では `isExpanded` を保持する要件
   * （flowchart-zoom 6-1）があるため、リセットでなく離脱時に戻すことでその要件と
   * 両立させる。`isTransitioning` も戻すのは、切替アニメ中に離脱してフラグが
   * 立ったまま次バトルへ持ち越されるのを防ぐため。
   */
  collapseFlowchart: () => set({ isExpanded: false, isTransitioning: false }),

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
   * 実行シーケンスは `'start'` ノードから始まる **動的なエッジ追跡** で進む。各
   * ノードフェーズ（`scheduleNodePhase`）はカード効果を適用したのち `selectNextEdge`
   * で次の 1 本を選び、エッジフェーズ（`scheduleEdgePhase`）→ 次のノードフェーズ、と
   * `setTimeout` を連鎖させる。`'goal'` 到達、または outgoing エッジの無いノードに
   * 達したら `scheduleComplete` で締める。経路を事前に固定配列へ展開せず、ノード
   * 到達のつど `edgesBySource` を引いて進むため、条件分岐（条件ノードでは
   * `evaluateCondition` を **その時点の最新状態で再評価**）やループ（閉路）も
   * そのまま辿れる。フェーズ時間はノード = `NODE_PHASE_MS`（800ms）、エッジ =
   * `EDGE_PHASE_MS`（400ms）の固定値で、定数を変えるだけで全ステージのテンポを
   * 一括変更できる。`currentPhaseMs` は各フェーズ進入時にそのフェーズの持続時間で
   * 更新され、`AnimatedProgressEdge` の進行アニメーション速度と連動する。
   * `scheduleComplete` では `currentEnemyHp === 0 && currentPlayerHp > 0` なら
   * `startVictorySequence(stage.enemyId)` で CLEAR! 演出を起動し、そうでなければ
   * `failPhase: 'shown'` を立てる（`victory-clear` 要件 1-1, 1-3）。
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
   * 効果を発火する。発火前に `multiplier` を **三分岐** で 1 回取得する
   * （`multiplier-slot` / `loop-counter` 仕様）：
   *   1. `typeof meta?.multiplier === 'number'` → リテラル数値倍率（既存パス、
   *      `multiplier-slot` 仕様）
   *   2. `typeof meta?.counterRef === 'string'` → カウンタ連動倍率
   *      （`get().counterValues[meta.counterRef] ?? 0`、`loop-counter` 仕様）。
   *      参照先カウンタが未到達なら 0 倍（要件 4-2）。
   *   3. それ以外 → 1 倍（= 効果そのまま、後方互換）
   * リテラルとカウンタ参照は `slotMetadata` の段階で `multiplier` / `counterRef`
   * の排他キーに振り分けられているため、ランタイム側は型ベースで素直に判別できる。
   *   - `counter` カード（`loop-counter` 仕様）→ `incrementCounter(card.counterId)`
   *     で対応カウンタ値を +1 し、`set({ activeCounterId: card.counterId })` で
   *     「いま光っているカウンタ」を示す state を立てる（要件 3-2 / 7-2）。
   *     `card.counterId` が undefined の場合（ローダーで縮退済みの counter）は
   *     分岐ごとスキップして無害化する。**multiplier は適用しない**（power なし、
   *     カウンタ自体に倍率の概念が無い）
   *   - `attack` カード → `applyEnemyDamage(card.power * multiplier)`（敵 HP を減らす）
   *   - `monster` カード → `reflectActive` で分岐：true なら
   *     `applyReflectDamage(card.power)`（敵 HP を power 減らし、オレンジフロート
   *     を発火、プレイヤー HP は不変）、false なら `consumeShieldOnDamage(card.power)`
   *     （シールド残量があれば吸収量を差し引いた残ダメージを `applyPlayerDamage`
   *     に渡し、シールドが 0 なら `applyPlayerDamage(card.power)` を直接呼ぶ）。
   *     モンスターカードは `lockedCard` でステージ定義から固定配置されている
   *     ためユーザー操作では現れない。**multiplier は適用しない**（敵攻撃なので
   *     プレイヤー側カード強化の対象外、multiplier-slot 要件 2-5）
   *   - `heal` カード → `applyPlayerHeal(card.power * multiplier)`（プレイヤー HP を
   *     回復し、`maxPlayerHp` でクランプする。HP が満タンでも演出キューには push
   *     されるため、緑フラッシュと「+N」フロートは通常通り再生される
   *     ／heal-card 要件 2-3, 4-4）
   *   - `guard` カード → `applyGuard(card.power * multiplier)`（`guardShield` に
   *     上書きセットし、同時に `reflectActive` を `false` にクリアする）。
   *     直後 1 ノード分のみ有効な一時シールドとして機能する
   *     （guard-card-effect 要件 1, 5、reflect-card-effect 要件 6-2）
   *   - `reflect` カード → `applyReflect()`（`reflectActive` を `true` にセットし、
   *     同時に `guardShield` を 0 にクリアする）。直後 1 ノード分のみ有効な
   *     反射状態として機能する。`reflect` カードは設計上 `power` を持たないため、
   *     `card.power > 0` のガードを使わず `card.id === 'reflect'` の存在チェック
   *     だけで分岐する。**multiplier は適用しない**（power なし、multiplier-slot
   *     要件 2-6）
   * いずれも `card.power > 0` でガードしている（reflect / counter は例外）。
   * `else if` ではなく独立 `if` の並列構造にすることで、将来カード種別が追加された
   * ときに順序依存無く拡張できる。`multiplier` は `card.id` のみで分岐するため、locked
   * カード（attack/heal/guard）にも自動適用される（locked attack 20 × 2 = 40、
   * multiplier-slot 要件 2-4）。
   *
   * 各エッジフェーズでは「直前ノードが guard でなく、かつ `guardShield > 0`」
   * のとき `clearGuard()` を呼んでシールドを 0 に戻し、「直前ノードが reflect で
   * なく、かつ `reflectActive === true`」のとき `clearReflect()` を呼んで反射状態
   * を解除する。これにより、バフカード直後のエッジでは状態が維持され、次のノード
   * （モンスター／空き／別カード）を通過した後のエッジで初めて消える、という
   * 「効果は次の 1 ノードのみに適用」の挙動が両方のバフで成立する
   * （guard-card-effect 要件 3、reflect-card-effect 要件 4-1）。
   *
   * さらにエッジフェーズ冒頭では `activeCounterId !== null` のとき `null` に戻す
   * （`loop-counter` 仕様、要件 7-3）。これにより counter ノードの発光（`SlotNode` が
   * `activeCounterId === myCounterId` で点灯）はノードフェーズ期間中
   * （`NODE_PHASE_MS`）だけ続き、次のエッジに移った瞬間に消える同期挙動が得られる。
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
 * ループ構文（`flowchart-loop` 仕様）の無限ループ対策は 2 段構え。**主検出は実行前
 * シミュレーション**：`beginSequence` で `simulateBattle`（`engine/simulateBattle.js`、
 * 数値だけの純関数）を 1 回走らせ、`'runaway'`（あるノードの訪問が `LOOP_MAX_VISITS`
 * =100 超）ならアニメせずに即 `failPhase: 'shown'` で負けにする（プレイヤー待ち時間
 * ゼロ）。**保険は live の周回ガード**：`scheduleNodePhase` の冒頭でクロージャ
 * `nodeVisitCounts` を加算し、100 超で `cancelExecutionTimers()` ＋ `failPhase` で
 * 打ち切る（sim が万一見逃しても停止）。線形・分岐ステージは各ノード 1 回しか通らない
 * のでどちらも発火しない（後方互換）。sim と live は別実装なので、開発時
 * （`import.meta.env.DEV`）のみ `scheduleComplete` で live の最終結果と sim 結果を
 * 突き合わせ、不一致なら `console.warn` してルールのドリフトを早期検知する
 * （本番ビルドでは何もしない）。
   *
   * Args:
   *     stage (object): `stages.json` の 1 ステージ分。`enemyId` / `slots` /
   *         `edges` に加え、任意で `conditions`（条件分岐ノード配列、空または
   *         未定義可）/ `mergeNodes`（合流ノード配列、`stagesLoader` が条件分岐
   *         を検知して自動生成、線形ステージでは `[]`）を持つ。`nodeMap` 構築
   *         時に `conditions` は `{ type: 'condition', expression }`、`mergeNodes`
   *         は `{ type: 'merge' }` として登録され、合流ノードはカード効果分岐の
   *         ガード（`card && card.id === 'xxx'`）に対して `slotAssignments[id]`
   *         が undefined のため自動的に素通りされる。
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

      const nodeMap = {};
      nodeMap['start'] = { type: 'start' };
      nodeMap['goal'] = { type: 'goal' };
      for (const slot of stage.slots ?? []) {
        nodeMap[slot.id] = { type: 'slot' };
      }
      for (const c of stage.conditions ?? []) {
        nodeMap[c.id] = { type: 'condition', expression: c.expression };
      }
      for (const m of stage.mergeNodes ?? []) {
        nodeMap[m.id] = { type: 'merge' };
      }

      const edgesBySource = {};
      for (const edge of stage.edges ?? []) {
        if (!edgesBySource[edge.source]) edgesBySource[edge.source] = [];
        edgesBySource[edge.source].push(edge);
      }

      const nodeVisitCounts = {};

      /*
       * 加速実行（最終ボス第二形態、`stage.isSecondPhase`）：進行度 t を
       * easeInQuad（t²）に通した速度倍率で次のフェーズ時間を短縮し、無限
       * ループ攻撃が「じわじわ加速し始め、終盤一気に最高速になる」演出を
       * 作る。`currentPhaseMs` も短縮後の値になるため、`AnimatedProgressEdge`
       * の進行アニメも自動で同期して速くなる。easeIn 済みの進行度は
       * `accelIntensity`（0〜1）としてフェーズ更新のたびに state へ流し、
       * `AccelerationEffect`（フローチャートの加速エフェクト）の強度と
       * 点滅速度を駆動する。通常ステージでは常に基準時間・強度 0 のまま。
       */
      let acceleratedPhaseCount = 0;
      let accelEased = 0;
      const nextPhaseMs = (baseMs, minMs) => {
        if (!stage.isSecondPhase) {
          return baseMs;
        }
        const t = Math.min(1, acceleratedPhaseCount / ACCEL_RAMP_PHASES);
        accelEased = t * t;
        const speed = 1 + (ACCEL_MAX_SPEED - 1) * accelEased;
        acceleratedPhaseCount += 1;
        return Math.max(minMs, Math.round(baseMs / speed));
      };

      set((s) => ({
        isExecuting: true,
<<<<<<< HEAD
        currentPhaseMs: NODE_PHASE_MS,
        accelIntensity: 0,
=======
        currentPhaseMs: NODE_PHASE_MS / get().speedMultiplier,
>>>>>>> 539fa1b (倍速ボタン実装)
        currentEnemyHp: s.maxEnemyHp,
        enemyDamageEvents: [],
        currentPlayerHp: s.maxPlayerHp,
        playerDamageEvents: [],
        playerHealEvents: [],
        playerGuardEvents: [],
        playerShakeEvents: [],
        traversedEdgeIds: [],
        traversedNodeIds: [],
        failPhase: null,
        guardShield: 0,
        reflectActive: false,
        enemyReflectEvents: [],
      }));

      const simOutcome = simulateBattle({
        edgesBySource,
        nodeMap,
        slotAssignments: get().slotAssignments,
        slotMetadata: get().slotMetadata,
        initialState: {
          enemyHp: get().maxEnemyHp,
          playerHp: get().maxPlayerHp,
          guardShield: 0,
          reflectActive: false,
          maxPlayerHp: get().maxPlayerHp,
          maxEnemyHp: get().maxEnemyHp,
          counterValues: get().counterValues,
        },
        maxVisits: LOOP_MAX_VISITS,
      });
      if (simOutcome === 'runaway') {
        set({
          isExecuting: false,
          executionStep: null,
          currentPhaseMs: null,
          failPhase: 'shown',
          speedMultiplier: 1,
        });
        return;
      }

      const buildEvalContext = (state) => ({
        variables: {
          playerHp: state.currentPlayerHp,
          enemyHp: state.currentEnemyHp,
          maxPlayerHp: state.maxPlayerHp,
          maxEnemyHp: state.maxEnemyHp,
          guardShield: state.guardShield,
          reflectActive: state.reflectActive,
        },
        slot: (slotId) => {
          const card = state.slotAssignments[slotId];
          return card?.id ?? null;
        },
      });

      const selectNextEdge = (nodeId) => {
        const edges = edgesBySource[nodeId] ?? [];
        const node = nodeMap[nodeId];
        if (node?.type === 'condition') {
          const result = evaluateCondition(node.expression, buildEvalContext(get()));
          const target = result ? 'true' : 'false';
          return edges.find((e) => e.sourceHandle === target);
        }
        return edges[0];
      };

      const scheduleNodePhase = (nodeId, delay) => {
        const tid = setTimeout(() => {
          if (get().failPhase !== null) return;

          nodeVisitCounts[nodeId] = (nodeVisitCounts[nodeId] ?? 0) + 1;
          if (nodeVisitCounts[nodeId] > LOOP_MAX_VISITS) {
            cancelExecutionTimers();
            set({
              failPhase: 'shown',
              isExecuting: false,
              executionStep: null,
              currentPhaseMs: null,
              speedMultiplier: 1,
            });
            return;
          }
          
          const nodePhaseMs = nextPhaseMs(NODE_PHASE_MS, ACCEL_MIN_NODE_MS);
          set((s) => ({
            executionStep: { type: 'node', id: nodeId },
<<<<<<< HEAD
            currentPhaseMs: nodePhaseMs,
            accelIntensity: accelEased,
=======
            currentPhaseMs: NODE_PHASE_MS / get().speedMultiplier,
>>>>>>> 539fa1b (倍速ボタン実装)
            traversedNodeIds: [...s.traversedNodeIds, nodeId],
          }));

          const card = get().slotAssignments[nodeId];
          const meta = get().slotMetadata[nodeId];
          const multiplier =
            typeof meta?.multiplier === 'number' ? meta.multiplier :
            typeof meta?.counterRef === 'string' ? (get().counterValues[meta.counterRef] ?? 0) : 1;
          if (card && card.id === 'counter' && card.counterId) {
            get().incrementCounter(card.counterId);
            set({ activeCounterId: card.counterId });
          }
          /* finisher（ひっさつカード）は attack と同じ「敵にダメージ」効果 */
          if (card && (card.id === 'attack' || card.id === 'finisher') && card.power > 0) {
            get().applyEnemyDamage(card.power * multiplier);
          }
          if (card && card.id === 'monster' && card.power > 0) {
            if (get().reflectActive) {
              get().applyReflectDamage(card.power);
            } else {
              get().consumeShieldOnDamage(card.power);
            }
          }
          if (card && card.id === 'heal' && card.power > 0) {
            get().applyPlayerHeal(card.power * multiplier);
          }
          if (card && card.id === 'guard' && card.power > 0) {
            get().applyGuard(card.power * multiplier);
          }
          if (card && card.id === 'reflect') {
            get().applyReflect();
          }

          if (nodeId === 'goal') {
            scheduleComplete(nodePhaseMs);
            return;
          }

          const nextEdge = selectNextEdge(nodeId);
          if (!nextEdge) {
            scheduleComplete(nodePhaseMs);
            return;
          }

<<<<<<< HEAD
          scheduleEdgePhase(nextEdge, nodePhaseMs);
        }, delay);
=======
          scheduleEdgePhase(nextEdge, NODE_PHASE_MS);
        }, delay / get().speedMultiplier);
>>>>>>> 539fa1b (倍速ボタン実装)
        executionTimers.push(tid); 
      };

      const scheduleEdgePhase = (edge, delay) => {
        const tid = setTimeout(() => {
          if (get().failPhase !== null) return;
          if (get().activeCounterId !== null) {
            set({ activeCounterId: null });
          }

          const edgePhaseMs = nextPhaseMs(EDGE_PHASE_MS, ACCEL_MIN_EDGE_MS);
          set((s) => ({
            executionStep: { type: 'edge', id: edge.id },
<<<<<<< HEAD
            currentPhaseMs: edgePhaseMs,
            accelIntensity: accelEased,
=======
            currentPhaseMs: EDGE_PHASE_MS / get().speedMultiplier,
>>>>>>> 539fa1b (倍速ボタン実装)
            traversedEdgeIds: [...s.traversedEdgeIds, edge.id],
          }));

          const prevNodeId = edge.source;
          const prevCard = get().slotAssignments[prevNodeId];
          const isPrevGuard = prevCard && prevCard.id === 'guard';
          const isPrevReflect = prevCard && prevCard.id === 'reflect';
          if (!isPrevGuard && get().guardShield > 0) {
            get().clearGuard();
          }
          if (!isPrevReflect && get().reflectActive) {
            get().clearReflect();
          }

<<<<<<< HEAD
          scheduleNodePhase(edge.target, edgePhaseMs);
        }, delay);
=======
          scheduleNodePhase(edge.target, EDGE_PHASE_MS);
        }, delay / get().speedMultiplier);
>>>>>>> 539fa1b (倍速ボタン実装)
        executionTimers.push(tid);
      };

      const scheduleComplete = (delay) => {
        const tid = setTimeout(() => {
          if (get().failPhase !== null) return;
          set({ isExecuting: false, executionStep: null, currentPhaseMs: null });
          const { currentEnemyHp, currentPlayerHp } = get();
          if (import.meta.env.DEV) {
            const liveOutcome = currentEnemyHp <= 0 && currentPlayerHp > 0 ? 'win' : 'lose';
            if (liveOutcome !== simOutcome) {
              console.warn(`[simulateBattle] outcome mismatch: sim=${simOutcome} live=${liveOutcome} (効果ルールがズレている可能性) `);
            }
          }
          if (currentEnemyHp === 0 && currentPlayerHp > 0) {
            if (stage.secondPhase) {
              /*
               * 第二形態（`stagesLoader` が展開した `stage.secondPhase`）を
               * 持つボスは、ここでは倒れず復活シーケンスへ入る。勝利演出は
               * 第二形態を倒した実行（secondPhase 側には secondPhase が
               * 無い）でのみ発火する。
               */
              get().startReviveSequence(stage);
            } else {
              get().startVictorySequence(stage.enemyId);
            }
          } else {
            set({ failPhase: 'shown', speedMultiplier: 1 });
          }
        }, delay / get().speedMultiplier);
        executionTimers.push(tid);
      };

      scheduleNodePhase('start', 0);
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
      result.speedMultiplier = 1;
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
    * 指定 id のプレイヤー向けガードイベントを `playerGuardEvents` から削除する。
    *
    * `PlayerGuardFloater` の各浮き数字要素が `onAnimationEnd` で呼び出し、
    * 自身を配列から取り除いて自走 unmount する。これにより
    * `playerGuardEvents` が累積し続けるのを防ぐ。ヒール側
    * `dismissPlayerHealEvent` と完全対称の責務を持つ。
    *
    * Args:
    *     id (string): 削除対象のガードイベント id。`playerGuardEvents`
    *         内に該当が無ければ no-op。
    */
   dismissPlayerGuardEvent: (id) => set((state) => ({
    playerGuardEvents: state.playerGuardEvents.filter((e) => e.id !== id),
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
    * `guardShield` フィールドに `Math.min(amount, state.maxPlayerHp)` をセット
    * する（既存値との累積はせず上書き式、`guard-bar-redesign` 要件 3-1）。
    * `maxPlayerHp` でクランプすることでガードバーがバー幅を超えないことを保証
    * する（要件 3-2）。`set` を関数形式に切り替えているのは `state.maxPlayerHp`
    * を読みながら更新する必要があるため。
    *
    * 同時に `reflectActive` を `false` にクリアする：guard と reflect は互いに
    * 排他のバフ系として扱い、後発のバフが先発を上書きする（`reflect-card-effect`
    * 要件 6-2、`guard-bar-redesign` 要件 7-1）。`startExecution` の防御カード
    * （`id === 'guard'`）ノードフェーズから呼ばれる。上書き式にすることで、
    * 同一実行内に複数の防御カードが配置されている場合でも「最後に通った防御
    * カードの power」が有効になる（`guard-card-effect` 要件 5-1、
    * `guard-bar-redesign` 要件 3-4）。直後 1 ノード分のみ有効で、次のエッジ
    * フェーズで `clearGuard` が呼ばれて 0 に戻る運用を `startExecution` 側で
    * 担保する。
    *
    * あわせて `playerGuardEvents` に `{ id, amount }` を push する。`id` は
    * `_playerGuardCounter` ベースの単調増加文字列で、敵被弾 (`d-`) ／プレイヤー
    * 被弾 (`pd-`) ／ヒール (`ph-`) と区別するため `pg-` プレフィックスを付ける。
    * このイベントは `PlayerGuardFloater` がガード青の浮き数字（`+<amount>`）を
    * 描画するトリガーで、`applyPlayerHeal` → `playerHealEvents` と完全対称。
    * `guardShield` は上書き式で実際の増分とは一致しないため、フロートには
    * 実増分ではなく `amount`（= `card.power * multiplier`）をそのまま表示し、
    * 「通った防御カードの power」を可視化する（ヒール演出と同じ思想）。
    *
    * Args:
    *     amount (number): シールドとしてセットする値。`card.power` がそのまま
    *         渡される前提で、呼び出し側で `card.power > 0` をガードしている。
    *         `maxPlayerHp` を超える値は内部でクランプされる（フロート表示は
    *         クランプ前の `amount`）。
    */
   applyGuard: (amount) => set((state) => {
    const id = `pg-${state._playerGuardCounter}`;
    return {
      guardShield: Math.min(amount, state.maxPlayerHp),
      reflectActive: false,
      playerGuardEvents: [...state.playerGuardEvents, { id, amount }],
      _playerGuardCounter: state._playerGuardCounter + 1,
    };
   }),

   /**
    * シールド吸収を考慮してプレイヤーにダメージを適用する。
    *
    * `guardShield` が正の値の場合は `Math.min(guardShield, amount)` を吸収量
    * として算出し、`guardShield` から減算する（同期的に `set` で反映、青バーが
    * すぐ縮み始める）。残ダメージ（`amount - absorbed`）が正なら、`setTimeout`
    * で `GUARD_TO_HP_DELAY_MS`（= 250ms、CSS `.fill` の `transition: width
    * 0.25s` と同期）だけ待ってから `applyPlayerDamage(remaining)` を呼ぶ。
    * これにより「青バーが完全に縮みきってから緑バーが動き出す」段階アニメー
    * ションが成立し、ガードが防いだ印象を強調する（`guard-bar-redesign`
    * 要件 4-5/4-6）。完全吸収された場合（`remaining === 0`）は
    * `applyPlayerDamage` を呼ばないため、被弾演出は発火しない（`guard-card-effect`
    * 要件 2-3）。
    *
    * 遅延 `setTimeout` の戻り値はモジュールスコープの `executionTimers` 配列に
    * push する。これにより `cancelExecutionTimers()`（リトライ・初期化時に呼ばれる）
    * の対象に含まれ、ガード吸収中にリトライしても予約済みの HP 減算が暴走しない。
    * さらに `setTimeout` のコールバック先頭で `if (get().failPhase !== null)
    * return;` の中断ガードを置き、ガード吸収中に他経路で Fail が発火した場合
    * （別フェーズで HP=0 になった等）の二重防御とする。
    *
    * `guardShield` が 0 の場合は `applyPlayerDamage(amount)` を直接呼ぶだけで、
    * 従来挙動と完全互換。これにより `startExecution` のモンスターカード分岐は
    * シールド有無を意識せず `consumeShieldOnDamage` を呼ぶだけでよい。
    *
    * `set` を 2 回（シールド減算と HP 減算が別アクション）に分けて呼ぶ構造を
    * 維持しているのは、`applyPlayerDamage` 内の死亡検知・中断ロジックを変更
    * せずに再利用するため。
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
        const tid = setTimeout(() => {
          if (get().failPhase !== null) return;
          get().applyPlayerDamage(remaining);
        }, GUARD_TO_HP_DELAY_MS);
        executionTimers.push(tid);
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
    * 指定された `counterId` のカウンタ値を +1 する（`loop-counter` 仕様）。
    *
    * `scheduleNodePhase` がループボディ内の counter ノード（`lockedCard.id ===
    * 'counter'`）に到達したときに呼び出され、対応するカウンタ値を 1 ずつ増やす
    * （要件 3-2）。`initializeBattle` で `counterValues` に登録済みの ID のみ
    * 反映する：未登録の ID（typo・ローダー検証で剥がされた counter 等）が来た
    * 場合は `s.counterValues[counterId] === undefined` で早期 return し、state を
    * 一切変えずに無害化する。zustand は `set` から返された値が `=== s`（同一参照）
    * のとき購読者に通知しないため、未登録 ID では再レンダリングも発火しない
    * （要件 11-4 のクラッシュ防止と整合）。
    *
    * 不変更新パターン：`{ ...s.counterValues, [counterId]: 新値 }` で新しいオブジェクト
    * を作って返す。同じキーが 2 度現れた場合、オブジェクトリテラルの「後勝ち」規則で
    * 後者が採用されるため、スプレッドで全カウンタをコピーした直後に対象カウンタだけ
    * を新値で上書きできる。`counterValues` 自体の参照が変わることで、`SlotNode` が
    * 細粒度購読している `s.counterValues[meta.counterRef]` の値変化が React に伝わる
    * （要件 8-1 / 8-3 のリアルタイム反映の土台）。
    *
    * Args:
    *     counterId (string): カウンタの識別子。`stages.json` の `lockedCard.counterId`
    *         および対応する `multiplier.counterRef` に同じ値が書かれている前提。
    */
   incrementCounter: (counterId) => set((s) => {
    if (s.counterValues[counterId] === undefined) return s;
    return {
      counterValues: {
        ...s.counterValues,
        [counterId]: s.counterValues[counterId] + 1,
      },
    };
   }),

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
      set({ victoryPhase: 'dead', speedMultiplier: 1 });
      setTimeout(() => set({ victoryPhase: 'fading' }), deadDurationMs);
    } else {
      set({ victoryPhase: 'fading', speedMultiplier: 1 });
    }
    setTimeout(() => set({ victoryPhase: 'cleared' }), deadDurationMs + VICTORY_FADE_DURATION_MS, );
   },

   /**
    * ボス復活（第二形態突入）シーケンスを開始する。
    *
    * 最終ボス戦（4-4）で第一形態の HP を 0 にしたとき、`scheduleComplete` の
    * 勝敗判定から `startVictorySequence` の代わりに呼ばれる。`revivePhase` を
    * `setTimeout` チェーンで以下のように遷移させる：
    *   - `'dying'` : 敵の dead アニメを再生する（`BattleScreen` が
    *     `revivePhase === 'dying'` でスプライトを `dead` 状態にする）。
    *     入力は `BossReviveOverlay` の透明ブロッカーで塞ぐ
    *   - `'down'`  : 敵が倒れたまま静止する。ここでシーケンスは一時停止し、
    *     `BattleScreen` が `bossDown` トリガーを発火してロボの「やった！
    *     倒した！」会話（フェイクアウト。`stage4-4-fakeout`）を流す。会話の
    *     末尾 step（`reviveBoss`）で `BattleScreen` が
    *     `resumeReviveSequence(stage)` を呼ぶまで先へ進まない
    *
    * 続き（`'flash'` 以降）は `resumeReviveSequence` が担う。
    *
    * 倒れるアニメ（`'dying'` の長さ）は **第一形態の敵**（`stage.enemyId`）の
    * dead アニメ定義から算出する。画面で倒れているのは第一形態のスプライト
    * なので、第二形態側の定義を見るとアニメの尺とズレる。
    *
    * タイマー管理：各 `setTimeout` の ID は `executionTimers` に push し、
    * ステージ離脱やリセットで `cancelExecutionTimers()` により破棄される。
    *
    * Args:
    *     stage (object): 第一形態（いま戦っていた）ステージ定義。
    *         `enemyId`（dead アニメの尺）を参照する。
    */
   startReviveSequence: (stage) => {
    const firstEnemy = enemiesData.enemies.find((e) => e.id === stage.enemyId);
    const deadAnim = firstEnemy?.animations?.dead;
    const deadDurationMs = deadAnim ? deadAnim.frameCount * deadAnim.frameDurationMs : 0;
    set({ revivePhase: 'dying' });
    const dyingTimer = setTimeout(() => {
      set({ revivePhase: 'down' });
    }, deadDurationMs + REVIVE_DEAD_HOLD_MS);
    executionTimers.push(dyingTimer);
   },

   /**
    * ボス復活シーケンスの後半（白フラッシュ〜復活）を再開する。
    *
    * `'down'`（倒れたまま静止）で一時停止していたシーケンスを、フェイク
    * アウト会話（「やった！倒した！」）の末尾 step（`reviveBoss`）から
    * `BattleScreen` が呼び出して再開する。遷移は次のとおり：
    *   - `'flash'` : 画面全体を白フラッシュで覆う（REVIVE_FLASH_IN_MS かけて
    *     真っ白へ）。真っ白になった瞬間に **敵の HP と見た目だけ** を第二形態
    *     へ差し替える（HP は `secondPhase.maxEnemyHp`、見た目は
    *     `overrideEnemyId` に第二形態の敵 ID（例: `dragon_final`）を立てて
    *     `BattleScreen` の `EnemySprite` を差し替える）。フローチャート・
    *     手札・実行の軌跡は第一形態のまま残す（盤面の差し替えは後、ロボの
    *     決意のセリフに続く `boardTransform` step で `BattleScreen` が
    *     `initializeBattle(stage.secondPhase)` を呼んで行う。その際
    *     `overrideEnemyId` は `initializeBattle` が null へ戻すが、以降は
    *     `isSecondPhase` が立つため表示は第二形態のまま変わらない）
    *   - `'risen'` : 白が REVIVE_FADE_OUT_MS かけて明け、HP 9999 の第二形態
    *     ボスと元のままの盤面が現れる。明け切ったら `null` に戻し、
    *     `BattleScreen` がこの `'risen' → null` 遷移を検知して `bossRevive`
    *     トリガー（ロボの会話）を発火する
    *
    * `revivePhase !== 'down'` のときは no-op（二重呼び出しや、シーケンス外
    * からの誤呼び出しへのガード）。
    *
    * Args:
    *     stage (object): 第一形態のステージ定義。`secondPhase`（復活後の
    *         敵 ID・HP）を参照する。
    */
   resumeReviveSequence: (stage) => {
    const secondPhaseStage = stage?.secondPhase;
    if (!secondPhaseStage || get().revivePhase !== 'down') {
      return;
    }
    const secondEnemy = enemiesData.enemies.find((e) => e.id === secondPhaseStage.enemyId);
    set({ revivePhase: 'flash' });
    const flashTimer = setTimeout(() => {
      const revivedHp = secondPhaseStage.maxEnemyHp ?? secondEnemy?.maxHp ?? 0;
      set({
        maxEnemyHp: revivedHp,
        currentEnemyHp: revivedHp,
        enemyDamageEvents: [],
        enemyReflectEvents: [],
        overrideEnemyId: secondPhaseStage.enemyId,
        revivePhase: 'risen',
      });
      const risenTimer = setTimeout(() => set({ revivePhase: null }), REVIVE_FADE_OUT_MS);
      executionTimers.push(risenTimer);
    }, REVIVE_FLASH_IN_MS);
    executionTimers.push(flashTimer);
   },

   /**
    * Fail フェーズからの「やり直す」アクション。
    *
    * Fail オーバーレイの「やり直す」ボタンから呼び出される。`failPhase` を
    * `null` に戻し、敵 HP・プレイヤー HP を各 `maxHp` に復元、敵向け／プレイヤー
    * 向けのダメージ演出キューおよびヒール演出キューをすべて空にし、通過軌跡
    * （`traversedEdgeIds` / `traversedNodeIds`）と防御シールド（`guardShield`）、
    * リフレクト状態（`reflectActive`）、反射ダメージ演出キュー
    * （`enemyReflectEvents`）もクリアする。さらに、カウンタ値マップ
    * （`counterValues`）の全エントリを 0 に戻し、現在発光中のカウンタ ID
    * （`activeCounterId`）も `null` に戻す（`loop-counter` 要件 3-3）。
    * これにより画面は「実行前の操作可能状態（A 状態）」に戻る
    * （`battle-fail-retry` 要件 5-1, 5-3, 5-4, 5-5、`guard-card-effect` 要件 4-3、
    * `reflect-card-effect` 要件 5-3）。
    *
    * カウンタリセットは **キー集合を保持して値だけ 0 に戻す**：
    * `Object.fromEntries(Object.keys(state.counterValues).map((id) => [id, 0]))`
    * で `state.counterValues` の現在のキーをそのまま使うため、再挑戦時に集合が
    * 変わることがない（counter スロットはステージ定義の一部なので、リトライで
    * 増減しない）。これにより `initializeBattle` を呼び直さずに済み、既存の
    * `slotAssignments` / `handCards` を保持する `retryFromFail` の設計と整合する。
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
      speedMultiplier: 1,
      currentEnemyHp: state.maxEnemyHp,
      currentPlayerHp: state.maxPlayerHp,
      enemyDamageEvents: [],
      playerDamageEvents: [],
      playerHealEvents: [],
      playerGuardEvents: [],
      playerShakeEvents: [],
      traversedEdgeIds: [],
      traversedNodeIds: [],
      guardShield: 0,
      reflectActive: false,
      enemyReflectEvents: [],
      counterValues: Object.fromEntries(
        Object.keys(state.counterValues).map((id) => [id, 0])
      ),
      activeCounterId: null,
   }));
  },
}));

export default useBattleStore;
export { HAND, selectAllSlotsFilled };
