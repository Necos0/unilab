import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import styles from './BattleScreen.module.css';
import FlowchartArea from './flowchart/FlowchartArea';
import ResetButton from './flowchart/ResetButton';
import ZoomButton from './flowchart/ZoomButton';
import EnemySprite from './enemy/EnemySprite';
import BackToMapButton from './BackToMapButton';
import HelpButton from './HelpButton';
import HelpWindow from './HelpWindow';
import Hand from '../cards/Hand';
import Card from '../cards/Card';
import HpBar from '../../components/HpBar';
import GuardBar from '../../components/GuardBar';
import DamageFloater from './enemy/DamageFloater';
import ReflectDamageFloater from './enemy/ReflectDamageFloater';
import PlayerDamageFloater from './player/PlayerDamageFloater';
import PlayerHealFloater from './player/PlayerHealFloater';
import PlayerGuardFloater from './player/PlayerGuardFloater';
import useBattleStore from '../../stores/battleStore';
import useCutsceneStore from '../../stores/cutsceneStore';
import useProgressStore from '../../stores/progressStore';
import RoboBubble from '../cutscene/RoboBubble';
import stagesData from '../../data/stagesLoader.js';
import VictoryClearOverlay from './VictoryClearOverlay';
import BattleFailOverlay from './BattleFailOverlay';
import enemiesData from '../../data/enemies.json';


/**
 * ドラッグ中のカード（`activeInstanceId`）を手札・スロット割当の両方
 * から探して返すセレクタ。
 *
 * ドラッグ中のカード実体は、スロット上に残っているか（スロット発）、
 * 手札の元位置に残っているか（手札発）のどちらかなので、両方を検索する。
 *
 * Args:
 *     state (object): `battleStore` の状態。
 *
 * Returns:
 *     object | null: `CardInstance` を返す。ドラッグ中でなければ `null`。
 */
function selectActiveCard(state) {
  const id = state.activeInstanceId;
  if (!id) {
    return null;
  }
  const fromHand = state.handCards.find((c) => c.instanceId === id);
  if (fromHand) {
    return fromHand;
  }
  for (const card of Object.values(state.slotAssignments)) {
    if (card && card.instanceId === id) {
      return card;
    }
  }
  return null;
}

function CrossIcon() {
  return (
    <svg 
      width="14"
      height="14"
      viewBox="0 0 14 14" 
      shapeRendering="crispEdges"
      style={{ flex: '0 0 14px' }}
    >
      <rect x="5" y="2" width="4" height="10" fill="#3ad430" />
      <rect x="2" y="5" width="10" height="4" fill="#3ad430" />
    </svg>
  );
}

/**
 * 戦闘画面のルートコンポーネント。
 *
 * Undertale 風の3段レイアウトで画面を構成し、`DndContext` で全体を
 * ラップすることで手札⇄スロット間のドラッグ＆ドロップを可能にする。
 *   - 上段: 敵スプライト + 敵 HP バー（数値併記） + ダメージ数字フロート層
 *      （`EnemySprite` + 汎用 `HpBar` + `DamageFloater` + `ReflectDamageFloater`）。
 *      `DamageFloater` は赤系で通常攻撃ダメージを、`ReflectDamageFloater` は
 *      オレンジ系で反射ダメージを描画する独立 2 系統のフロート層。HP バー
 *      ラッパーは `enemyHpBox` クラス
 *   - 中段: フローチャート領域（React Flow） ＋ 右上のコントロール群
 *      （上段に拡大トグル ＋ リセット、下段に実行ボタン）
 *   - 下段: プレイヤー HP バー（数値併記） + プレイヤー被弾ダメージ数字
 *      フロート層 + プレイヤー回復数字フロート層 + プレイヤーガード数字
 *      フロート層 + 手札カード領域。HP バーラッパーは `playerHpBox`
 *      クラスで、内側に `PlayerDamageFloater` / `PlayerHealFloater` /
 *      `PlayerGuardFloater` を絶対配置で重ねる
 *
 * `enemyHpBox` と `playerHpBox` は対称的な命名で、それぞれ片側だけに
 * レイアウト・演出変更が入っても他方に影響が出ないように分離している。
 *
 * プレイヤー HUD（`playerHpBox`）の状態演出は、ガード付与時の青い box-shadow
 * グローを基調に、被弾＝赤・回復＝緑・反射＝橙・ガード＝青の 4 色グローで
 * 統一している（フロート数字の色とも一致）。被弾と反射はグローに加えてシェイク
 * も併発する。各グローは 0.5 秒、シェイクは 0.3 秒で、CSS のカンマ区切り複数
 * アニメ（`transform` と `box-shadow` で property 非衝突）として独立に持たせる。
 * `onAnimationEnd` での id 消費は **最長の 0.5 秒グロー終了時**に行い、短い
 * シェイク終了でクラスが外れてグローが途中で切れるのを防ぐ。
 *
 * 被弾は `battleStore.{enemy,player}DamageEvents` 末尾要素の `id` を購読し、
 * 「最新の id」と「すでに消費済みの id」を比較する派生計算で `isEnemyHit` /
 * `isPlayerHit` を求める方式（`EnemySprite` のフラッシュ判定と同じパターン）。
 * 両者が異なるとき `.hit` クラスが付与される。**敵バー**は `@keyframes hpBoxHit`
 * （0.3 秒の `translateX` 振動 + `filter: brightness/saturate/hue-rotate` の
 * 赤系フラッシュを 1 キーフレームに合成）を従来どおり使う。**プレイヤーバー**は
 * `hpBoxShakeX`（`translateX` 振動のみ）＋ `hpBoxDamageGlow`（赤い box-shadow
 * グロー）の 2 アニメで、色フィルタではなくグローで赤を表現する。
 * `onAnimationEnd` で「消費済み id」を「最新の id」に進めると判定が `false` に
 * 戻り、次回の被弾で末尾 id が更新されると再び `true` になる。`useEffect` を
 * 使わない派生計算パターンにより、React 19 の
 * `react-hooks/set-state-in-effect` ルールにも適合する。
 *
 * 反射成立時は通常被弾と区別された専用演出が発火する。`isEnemyReflected`
 * （`enemyReflectEvents` の末尾 id を購読する派生計算）が `true` のとき、
 * `enemyHpBox` には `.hit`（横シェイク + 赤フラッシュ）ではなく `.shakenVert`
 * が付与される。同時に `isPlayerShaken`（`playerShakeEvents` 購読）も `true`
 * になり、`playerHpBox` にも `.shakenVert` が付与されて両者の HP バーが連動して
 * 縦揺れする。CSS では `@keyframes hpBoxShakeVert`（`translateY` の振動）を
 * **敵は単独**で、**プレイヤーは `hpBoxReflectGlow`（橙の box-shadow グロー）と
 * 併発**で再生する（`.enemyHpBox.shakenVert` と `.playerHpBox.shakenVert` の
 * ルールを分け、橙グローが敵に乗らないようにしている）。これにより「攻撃が来た
 * が跳ね返した」という反射の手応えを、(1) オレンジ色のダメージフロート、
 * (2) 両 HP バーの縦揺れ＋プレイヤーバーの橙グロー、(3) プレイヤー HP は不変、
 * で視覚化する。プレイヤー側の `onAnimationEnd` では最長の `hpBoxReflectGlow`
 * 終了時に `consumedPlayerShakeId` を進める。敵側の `consumedEnemyReflectId` は
 * 敵バーの `onAnimationEnd` 直接ハンドラで `consumedEnemyDamageId` と一緒に
 * 進める実装。
 *
 * `playerHpBox` には被弾と対称に、ヒール時の緑グロー演出も乗る。
 * `playerHealEvents` 末尾の `id` を購読する `isPlayerHealed` の派生計算で
 * `.healed` クラスを付与し、CSS の `@keyframes hpBoxHealGlow`（shake なし、
 * 緑の box-shadow グローのみ）が 0.5 秒 1 ショット再生される（heal-card
 * 要件 3-1〜3-4）。被弾・回復・反射は同じ `onAnimationEnd` ハンドラに乗るため、
 * `event.animationName` が `hpBoxDamageGlow` / `hpBoxHealGlow` /
 * `hpBoxReflectGlow` のいずれか（= 各イベントの最長 0.5 秒グロー）かで分岐し、
 * `consumedPlayerDamageId` / `consumedPlayerHealId` / `consumedPlayerShakeId` の
 * id 系列を独立に進める。CSS Modules によるキーフレーム名のハッシュ化に備え、
 * `styles.hpBoxHealGlow || 'hpBoxHealGlow'` の OR 併記で実名・生名どちらでも
 * 一致するようにしている。
 *
 * `playerHpBox` には防御カード通過時の青フラッシュ演出も乗る
 * （`guard-card-effect` 要件 6-5）。`battleStore.guardShield` の値を購読し、
 * `useRef` で前回値を保持して「増加方向（0→正、または正→より大きい正）」
 * のときのみ `isShielded` フラグを 500ms 立てる。これにより、シールド消費
 * （減少）やクリア（正→0）ではフラッシュが発火せず、純粋な「付与イベント」
 * だけが視覚化される。`isShielded` の自動オフは `setTimeout` で行い、
 * `useEffect` の cleanup と組み合わせて連続発火時のタイマー破棄も担保する。
 * CSS の `@keyframes hpBoxShielded` は 0% → 30% で青い box-shadow が広がり、
 * 30% → 100% でフェードアウトする 1 ショットアニメ。プレイヤーバーの 4 演出
 * （`hpBoxDamageGlow` 赤 / `hpBoxHealGlow` 緑 / `hpBoxReflectGlow` 橙 /
 * `hpBoxShielded` 青）は同一意匠のグローで、色だけで意味を分ける。
 *
 * ガード残量の視覚表示は `playerHpBox` 内の **HP バー真上に並べた専用
 * `GuardBar`** が担う（`guard-bar-redesign` 仕様）。プレイヤー HUD は
 * `.playerStatusBars`（flex column）でラップし、`<GuardBar current={guardShield}
 * max={maxPlayerHp} />` と `<HpBar ... icon={<CrossIcon />} />` を縦に並べる
 * Fortnite 風 2 段スタック構造。プレイヤー HP バーは左に小さな緑の十字
 * アイコン（`CrossIcon`、SVG `<rect>` の 2 段構成、`fill: #3ad430` で
 * HpBar の `.fill` 背景色と一致）、Guard バーは左に小さな青い盾アイコン
 * （`GuardBar` 内蔵、`fill: #4a8ef0` で GuardBar の `.fill` 背景色と一致）が
 * 付き、「緑 = HP 関連」「青 = ガード関連」のカラーグルーピングで種別を視覚的に
 * 区別する。reflect 中も CrossIcon は緑のまま固定（reflect の視覚表現はバー
 * 本体と数値テキスト分子の 2 ヶ所で十分強調されており、アイコンまで色を
 * 変えるとノイズが増える + 「HP の概念」自体は reflect 中も存在し続けるため、
 * 色の一貫性を優先）。
 *
 * HP 数値テキストは旧仕様のまま「総体力 = HP + ガード」を 1 文字列で表示する：
 * 分子は `currentPlayerHp + guardShield`、分母は `maxPlayerHp`。さらに分子
 * 部分の内側 `<span>` に三項演算子で `.hpNumeratorShielded` / `.hpNumeratorReflect`
 * のクラスを条件付与し、`guardShield > 0` なら青、`reflectActive === true`
 * なら橙、いずれもなければデフォルト色にする。これにより GuardBar の青い
 * 塗り幅と HP テキストの青色化が連動し、「いま積まれているガード値はいくつ
 * なのか」を数値でも読み取れる（Fortnite 同様に HUD 数字 = Shield + Health
 * の合算という慣習にも合致）。`guardShield` と `reflectActive` は
 * `battleStore` 側の `applyGuard` / `applyReflect` で互いをクリアする排他
 * 制御がかかっているため、青と橙が同時に分子に乗ることはない。
 *
 * `playerHpBox` にはさらにカウンターカード通過時のリフレクト演出も乗る
 * （`reflect-card-effect` 要件 1）。`battleStore.reflectActive` を購読し、
 * `true` の間は `HpBar` の `.fill` が緑→オレンジに切替わる演出と、上述の
 * HP 数値分子のオレンジ化（`.hpNumeratorReflect`）の 2 要素で状態を示す。
 * `HpBar` には `reflectActive={reflectActive}` を渡して `.fill` の色を
 * 緑→オレンジに切替える。継続的なグロー演出（box-shadow など）は意図的に
 * 持たせず、戦闘画面全体の演出ノイズを下げて反射成立時の縦シェイク +
 * オレンジフロートのインパクトを際立たせる設計。
 *
 * 敵側のダメージフロートは赤系の `DamageFloater`（`enemyDamageEvents` 購読）と
 * オレンジ系の `ReflectDamageFloater`（`enemyReflectEvents` 購読）を独立 2 系統で
 * マウントしている。反射成立時は `applyEnemyDamage` を経由せず
 * `applyReflectDamage` 経由で敵 HP を減らすため、両系統が同時に発火することは
 * ない。色で「通常攻撃ダメージ」と「反射ダメージ」を視覚的に区別する設計
 * （`reflect-card-effect` 要件 2-3, 7-4）。
 *
 * マウント時に `initializeBattle(stage)` でストアを初期化し、以降の
 * 手札・スロット割当・敵 HP（`currentEnemyHp` / `maxEnemyHp`）・敵向け
 * ダメージ演出キュー（`enemyDamageEvents`）・プレイヤー HP（`currentPlayerHp`
 * / `maxPlayerHp`）・プレイヤー向けダメージ演出キュー（`playerDamageEvents`）・
 * プレイヤー向けヒール演出キュー（`playerHealEvents`）・勝利演出フェーズ
 * （`victoryPhase`）・防御シールド残量（`guardShield`）は `battleStore` が保持する。プレイヤー HP は以前ローカル変数で `playerData.maxHp` を
 * 静的に表示していたが、モンスターカード被弾処理（monster-attack 仕様）
 * の導入に合わせてストア値の購読に切り替えた。`DndContext` の
 * `onDragStart` / `onDragEnd` はそれぞれ `beginDrag` / `endDrag` に
 * 橋渡しする。センサーは `PointerSensor` と `TouchSensor` を登録し、
 * どちらも 4px の距離しきい値を付けてタップ・クリックとの誤検出を避ける。
 * 追加で `DragOverlay` を配置し、ドラッグ中のカードがポインタに追従
 * するフローティング表示を提供する。
 *
 * フローチャートの拡大／縮小状態はストアの `isExpanded` を購読して
 * ルート `<section>` の className に `.expanded` を条件付与することで
 * レイアウトを切り替える。切替アニメーション中（`isTransitioning`）と
 * 実行中（`isExecuting`）と勝利演出中（`victoryPhase` 非 null）と失敗
 * 演出中（`failPhase` 非 null）は `.transitioning` ／ `.executing` ／
 * `.victory` ／ `.failed` クラスを付与して pointer-events を無効化し、
 * ユーザー操作をブロックする。`isExpanded` はバトルをまたいで保持される
 * ストア状態のため、`BattleScreen` の unmount 時（マップへ戻る全経路）に
 * cleanup で `collapseFlowchart()` を呼び、拡大状態が次バトルへ持ち越されて
 * 「別ステージに入ったら拡大表示のまま」になるのを防ぐ。リセットボタン
 * （`initializeBattle`）では拡大を保持する要件があるため、リセットでなく離脱
 * 時に戻す（`battleStore.collapseFlowchart` 参照）。
 *
 * 勝利演出（`victory-clear` 仕様）の組み込み：
 *   - `EnemySprite` に渡す `state` は、`victoryPhase` 非 null かつ対象敵に
 *     dead アニメ定義があれば `'dead'`、それ以外は `'idle'`。dead 未実装の
 *     敵（slime 等）は idle のままフェードアウトする
 *   - `victoryPhase === 'cleared'` のとき、敵エリアに
 *     `VictoryClearOverlay` をマウントして CLEAR! テキストとマップへ戻る
 *     ボタンを表示する。同時に右上の `BackToMapButton` は unmount し、
 *     ボタンを物理的に 1 つだけにする
 *   - dead/fading フェーズ中は右上 `BackToMapButton` は残るが
 *     `.root.victory` の `pointer-events: none` で押せない状態になる
 *
 * 失敗演出（`battle-fail-retry` 仕様）の組み込み：
 *   - `failPhase === 'shown'` のとき、敵エリアに `BattleFailOverlay` を
 *     マウントして Fail テキストと「マップへ戻る」「やり直す」の 2 ボタンを
 *     表示する。同時に右上の `BackToMapButton` を unmount してボタンの
 *     重複を避ける（要件 3-1, 3-3, 3-4）
 *   - `enemyHpBox` には `failPhase === 'shown'` 連動で `.dimmed` クラスを
 *     付与し、敵 HP バー＋数値ラベルを半透過にする。`EnemySprite` 側にも
 *     対称な `.dimmed` を付与し、敵スプライトと HP バーが同じ透過度で
 *     残る視覚を作る（要件 3-5, 3-6）
 *   - `.root.failed` の `pointer-events: none` で全体ロック。`BattleFailOverlay`
 *     内の `.overlay` は `pointer-events: auto` を再付与して 2 ボタンだけは
 *     押せる状態にする（`VictoryClearOverlay` と同じロック解除パターン）
 *   - 「やり直す」ボタンは `retryFromFail` を直接 `onRetry` プロップとして
 *     渡し、押下時に `slotAssignments` / `handCards` を保ったまま HP・軌跡・
 *     演出キューだけがリセットされて A 状態に戻る（要件 5-1〜5-6）
 *   - 「マップへ戻る」ボタンは `onExitToMap` を渡し、敗北はクリア記録の
 *     対象外（stage-unlock 要件 3-4）であるため通常退出と同じハンドラを
 *     共有する。
 *
 * `victoryPhase` と `failPhase` は `startExecution` 完了時の判定で必ず
 * どちらか片方しか立たないため、両オーバーレイが同時にマウントされること
 * はない。両者の出し分け分岐は兄弟として並列に書くことで、勝利／失敗が
 * 対称な選択肢であることがコード構造から読み取れるようにしている。
 *
 * 「マップへ戻る」操作は退出経路を 2 系統に分けている（stage-unlock 要件 3）：
 *   - 右上 `BackToMapButton`（テスト用）・`BattleFailOverlay` 内ボタン →
 *     `onExitToMap()` のみ呼ぶ。クリア記録には影響を与えない（要件 3-3,
 *     3-4：勝利演出を経由していないため、クリアとして扱わない）。
 *   - `VictoryClearOverlay` 内「マップへ戻る」→ `onClearedExitToMap(stageId)`
 *     を呼ぶ。`App.jsx` 側でクリア記録（`progressStore.markStageCleared`）
 *     を行ってからマップ画面へ遷移する（要件 3-1）。
 * `onClearedExitToMap` が未指定（呼び出し側がこの分岐を扱わない場合）は、
 * フォールバックとして `onExitToMap` を使う。
 *
 * Args:
 *     props (object): React プロパティ。
 *         stageId (string): 戦うステージの ID。`stages.json` のキーに対応。
 *             未指定時は `stagesData.demoStageIds[0]` をフォールバックとして使う
 *             （開発用バトルデモのデフォルト ID）。
 *         onExitToMap (function): 通常退出時に呼ぶハンドラ。引数なし。
 *             右上の `BackToMapButton`（テスト用）と `BattleFailOverlay`
 *             内「マップへ戻る」ボタンから呼ばれる（敗北はクリア対象外）。
 *         onClearedExitToMap (function, optional): 勝利演出経由の退出時に
 *             呼ぶハンドラ。`stageId` 1 引数で呼ばれる。`App.jsx` 側で
 *             `progressStore.markStageCleared(stageId)` を実行してから
 *             画面遷移する想定。未指定なら `onExitToMap` がフォールバック。
 *
 * Returns:
 *     JSX.Element: 戦闘画面全体を表す section 要素。
 */
function BattleScreen({ stageId, onExitToMap, onClearedExitToMap }) {
  const resolvedStageId = stageId ?? stagesData.demoStageIds[0];
  const stage = stagesData.stages[resolvedStageId];

  const initializeBattle = useBattleStore((s) => s.initializeBattle);
  const collapseFlowchart = useBattleStore((s) => s.collapseFlowchart);
  const beginDrag = useBattleStore((s) => s.beginDrag);
  const endDrag = useBattleStore((s) => s.endDrag);
  const activeCard = useBattleStore(selectActiveCard);
  const isExpanded = useBattleStore((s) => s.isExpanded);
  const isTransitioning = useBattleStore((s) => s.isTransitioning);
  const isExecuting = useBattleStore((s) => s.isExecuting);
  const currentEnemyHp = useBattleStore((s) => s.currentEnemyHp);
  const maxEnemyHp = useBattleStore((s) => s.maxEnemyHp);
  const currentPlayerHp = useBattleStore((s) => s.currentPlayerHp);
  const maxPlayerHp = useBattleStore((s) => s.maxPlayerHp);
  const guardShield = useBattleStore((s) => s.guardShield);
  const reflectActive = useBattleStore((s) => s.reflectActive);
  const victoryPhase = useBattleStore((s) => s.victoryPhase);
  const failPhase = useBattleStore((s) => s.failPhase);
  const retryFromFail = useBattleStore((s) => s.retryFromFail);
  const isEnemyFading = victoryPhase === 'fading' || victoryPhase === 'cleared';
  const isEnemyDimmed = failPhase === 'shown';
  const lastPlayerDamageId = useBattleStore(
    (s) => s.playerDamageEvents.at(-1)?.id ?? null,
  );
  const [consumedPlayerDamageId, setConsumedPlayerDamageId] = useState(null);
  const isPlayerHit = lastPlayerDamageId !== null && lastPlayerDamageId !== consumedPlayerDamageId;
  const lastPlayerHealId = useBattleStore(
    (s) => s.playerHealEvents.at(-1)?.id ?? null,
  );
  const [consumedPlayerHealId, setConsumedPlayerHealId] = useState(null);
  const isPlayerHealed = lastPlayerHealId !== null && lastPlayerHealId !== consumedPlayerHealId;
  const lastPlayerShakeId = useBattleStore(
    (s) => s.playerShakeEvents.at(-1)?.id ?? null,
  );
  const [consumedPlayerShakeId, setConsumedPlayerShakeId] = useState(null);
  const isPlayerShaken = lastPlayerShakeId !== null && lastPlayerShakeId !== consumedPlayerShakeId;
  const lastEnemyDamageId = useBattleStore(
    (s) => s.enemyDamageEvents.at(-1)?.id ?? null,
  );
  const [consumedEnemyDamageId, setConsumedEnemyDamageId] = useState(null);
  const isEnemyHit = lastEnemyDamageId !== null && lastEnemyDamageId !== consumedEnemyDamageId;

  const lastEnemyReflectId = useBattleStore(
    (s) => s.enemyReflectEvents.at(-1)?.id ?? null,
  );
  const [consumedEnemyReflectId, setConsumedEnemyReflectId] = useState(null);
  const isEnemyReflected = lastEnemyReflectId !== null && lastEnemyReflectId !== consumedEnemyReflectId;

  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [isShielded, setIsShielded] = useState(false);
  const prevGuardShieldRef = useRef(0);
  useEffect(() => {
    if (guardShield > prevGuardShieldRef.current && guardShield > 0) {
      setIsShielded(true);
      const timer = setTimeout(() => setIsShielded(false), 500);
      prevGuardShieldRef.current = guardShield;
      return () => clearTimeout(timer);
    }
    prevGuardShieldRef.current = guardShield;
    return undefined;
  }, [guardShield]);

  useEffect(() => {
    initializeBattle(stage);
  }, [initializeBattle, stage]);

  /*
   * 説明ヘルプの解放：このステージで手札に出るカードと、スロットに固定された
   * ロックカード（敵攻撃の `monster` 等）を「既出カード」として、ステージに
   * 登場する特殊マス種別（`stagesLoader` が収集した `slotTypeIds`）を
   * 「既出マス」として記録する。`HelpWindow` はまだ出会っていないカード・
   * マスの説明を伏せる（「？？？カード」「？？？マス」表示）ため、出てきた
   * 瞬間（バトル入場時）に記録する。
   */
  const markCardsSeen = useProgressStore((s) => s.markCardsSeen);
  const markSlotTypesSeen = useProgressStore((s) => s.markSlotTypesSeen);
  useEffect(() => {
    markCardsSeen([
      ...(stage.cards ?? []).map((card) => card.id),
      ...(stage.slots ?? [])
        .map((slot) => slot.lockedCard?.id)
        .filter(Boolean),
    ]);
    markSlotTypesSeen(stage.slotTypeIds ?? []);
  }, [markCardsSeen, markSlotTypesSeen, stage]);

  useEffect(() => () => collapseFlowchart(), [collapseFlowchart]);

  /*
   * 自動ガイド（カットシーン）のトリガー発火。
   *   - 入場時: バトル画面マウントで `enterBattle`
   *   - 勝利時: `victoryPhase === 'cleared'`（CLEAR! 演出が出た瞬間）で `defeatEnemy`
   *   - 敗北時: `failPhase === 'shown'` で `battleLost`
   * いずれも `cutsceneStore` 側で表示済み判定・吹き出し有無を確認するため、
   * ここでは素直にイベントを投げるだけにする。
   */
  const fireTrigger = useCutsceneStore((s) => s.fireTrigger);
  useEffect(() => {
    const store = useCutsceneStore.getState();
    /*
     * バトル開始待ち step（`waitForBattle`）を再生中なら、まず進めて（＝末尾
     * step なので終了して指差しリングを消し）、そのうえで入場ガイドを発火する。
     * 先に閉じておかないと `fireTrigger` が「再生中」で no-op になる。
     */
    const currentStep = store.activeId ? store.steps[store.stepIndex] : null;
    if (currentStep?.waitForBattle === resolvedStageId) {
      store.advance();
    }
    fireTrigger({ type: 'enterBattle', stageId: resolvedStageId });
  }, [fireTrigger, resolvedStageId]);
  useEffect(() => {
    if (victoryPhase === 'cleared') {
      fireTrigger({ type: 'defeatEnemy', stageId: resolvedStageId });
    }
  }, [victoryPhase, fireTrigger, resolvedStageId]);
  useEffect(() => {
    if (failPhase === 'shown') {
      fireTrigger({ type: 'battleLost', stageId: resolvedStageId });
    }
  }, [failPhase, fireTrigger, resolvedStageId]);

  /*
   * カットシーンの「操作待ち」step（`waitForCardInSlot`）の進行。プレイヤーが
   * カードをスロットに入れるまで待ち、入った時点で次の step（「実行しよう」）へ
   * 進める。待ち中はロボ吹き出しレイヤーが素通しになり実際にドラッグできる。
   * `slotAssignments` にプレイヤー配置のカード（locked でない＝モンスター等の
   * 固定札を除く）が1枚でもあれば配置済みとみなす。
   */
  const advanceCutscene = useCutsceneStore((s) => s.advance);
  const isWaitingForCardInSlot = useCutsceneStore(
    (s) => Boolean(s.activeId) && s.steps[s.stepIndex]?.waitForCardInSlot === true,
  );
  const hasPlayerCardInSlot = useBattleStore((s) =>
    Object.values(s.slotAssignments).some((card) => card && !card.locked),
  );
  useEffect(() => {
    if (isWaitingForCardInSlot && hasPlayerCardInSlot) {
      advanceCutscene();
    }
  }, [isWaitingForCardInSlot, hasPlayerCardInSlot, advanceCutscene]);

  /*
   * カットシーンの「実行待ち」step（`waitForExecute`）の進行。「ここを押して
   * 実行しよう!」のヒントは素通しレイヤーで出し、プレイヤーが実際に実行
   * ボタンを押して実行が始まった（`isExecuting`）時点で次の step へ進める
   * （末尾 step なのでカットシーンが終了する）。ヒントを見て押したクリックが
   * カットシーン送りに吸われず、1回目のクリックでそのまま実行される。
   */
  const isWaitingForExecute = useCutsceneStore(
    (s) => Boolean(s.activeId) && s.steps[s.stepIndex]?.waitForExecute === true,
  );
  useEffect(() => {
    if (isWaitingForExecute && isExecuting) {
      advanceCutscene();
    }
  }, [isWaitingForExecute, isExecuting, advanceCutscene]);

  /*
   * カットシーンの `openCardHelp` / `openSlotHelp` step による誘導表示。
   * カットシーンがその step に進むと `cutsceneStore.pendingCardHelpId`
   * （カード）または `pendingSlotHelpId`（マス）が立つので、その対象を
   * 初期タブにした説明モーダルを開く。`isHelpOpen`（ヘルプボタンからの
   * 手動表示）かどちらかの pending で開く派生計算にして、effect 内
   * setState（`react-hooks/set-state-in-effect`）を避ける。モーダルを閉じると
   * `consumeCardHelp()` を呼び、カットシーン由来なら次の step（次の吹き出し）へ
   * 進める。手動表示のときは両 pending が null なので呼ばない。
   */
  const pendingCardHelpId = useCutsceneStore((s) => s.pendingCardHelpId);
  const pendingSlotHelpId = useCutsceneStore((s) => s.pendingSlotHelpId);
  const consumeCardHelp = useCutsceneStore((s) => s.consumeCardHelp);
  const isCardHelpOpen =
    isHelpOpen || pendingCardHelpId !== null || pendingSlotHelpId !== null;
  const closeCardHelp = () => {
    setIsHelpOpen(false);
    if (pendingCardHelpId !== null || pendingSlotHelpId !== null) {
      consumeCardHelp();
    }
  };

  const enemy = enemiesData.enemies.find((e) => e.id === stage.enemyId);
  const hasDeadAnim = Boolean(enemy?.animations?.dead);
  const enemySpriteState = victoryPhase && hasDeadAnim ? 'dead' : 'idle';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragStart = (event) => {
    beginDrag(event.active.id);
  };

  const handleDragEnd = (event) => {
    endDrag({
      instanceId: event.active.id,
      source: event.active.data.current?.source,
      destination: event.over?.id ?? null,
    });
  };

  const handleClearedExitToMap = () => {
    if (onClearedExitToMap) {
      onClearedExitToMap(resolvedStageId);
    } else {
      onExitToMap();
    }
  };

  const rootClassName = [
    styles.root,
    isExpanded && styles.expanded,
    isTransitioning && styles.transitioning,
    isExecuting && styles.executing,
    victoryPhase && styles.victory,
    failPhase && styles.failed,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section className={rootClassName}>
        <HelpButton onClick={() => setIsHelpOpen(true)} />
        {isCardHelpOpen && (
          /*
           * key で pending の切り替わりごとに再マウントする。`openCardHelp` →
           * `openSlotHelp` のように誘導 step が連続すると、モーダルは開いた
           * ままタブだけ切り替える必要があるが、初期タブは useState の
           * 初期化でしか決まらないため、key を変えて初期化し直す。
           */
          <HelpWindow
            key={
              pendingCardHelpId !== null
                ? `card-${pendingCardHelpId}`
                : pendingSlotHelpId !== null
                  ? `slot-${pendingSlotHelpId}`
                  : 'manual'
            }
            initialCardId={pendingCardHelpId}
            initialSlotTypeId={pendingSlotHelpId}
            onClose={closeCardHelp}
          />
        )}
        {victoryPhase !== 'cleared' && failPhase !== 'shown' && !isExpanded && <BackToMapButton onClick={onExitToMap} />}
        <div className={styles.enemyArea}>
          <EnemySprite enemyId={stage.enemyId} state={enemySpriteState} />
          <div
            data-cutscene-point="enemyHpBar"
            className={`${styles.enemyHpBox} ${isEnemyFading ? styles.fading : ''} ${isEnemyDimmed ? styles.dimmed : ''} ${isEnemyHit ? styles.hit : ''} ${isEnemyReflected ? styles.shakenVert : ''}`}
            onAnimationEnd={() => {
              setConsumedEnemyDamageId(lastEnemyDamageId);
              setConsumedEnemyReflectId(lastEnemyReflectId);
            }}
          >
            <HpBar currentHp={currentEnemyHp} maxHp={maxEnemyHp} />
            <span className={styles.hpText}>
              {currentEnemyHp}/{maxEnemyHp}
            </span>
          </div>
          <div
            data-cutscene-point="playerHpBar"
            className={[
              styles.playerHpBox,
              isPlayerHit && styles.hit,
              isPlayerHealed && styles.healed,
              isShielded && styles.shielded,
              isPlayerShaken && styles.shakenVert,
            ].filter(Boolean).join(' ')}
            onAnimationEnd={(event) => {
              if (event.animationName === styles.hpBoxDamageGlow || event.animationName === 'hpBoxDamageGlow') {
                setConsumedPlayerDamageId(lastPlayerDamageId);
              } else if (event.animationName === styles.hpBoxHealGlow || event.animationName === 'hpBoxHealGlow') {
                setConsumedPlayerHealId(lastPlayerHealId);
              } else if (event.animationName === styles.hpBoxReflectGlow || event.animationName === 'hpBoxReflectGlow') {
                setConsumedPlayerShakeId(lastPlayerShakeId);
              }
            }}
          >
            <div className={styles.playerStatusBars}>
              <GuardBar current={guardShield} max={maxPlayerHp} />
              <HpBar
                currentHp={currentPlayerHp}
                maxHp={maxPlayerHp}
                reflectActive={reflectActive}
                icon={<CrossIcon />}
              />
            </div>
            <span className={styles.hpText}>
              <span
                className={guardShield > 0
                  ? styles.hpNumeratorShielded
                  : reflectActive
                    ? styles.hpNumeratorReflect
                    : undefined}>
                {currentPlayerHp + guardShield}
              </span>
              /{maxPlayerHp}
            </span>
            <PlayerDamageFloater />
            <PlayerHealFloater />
            <PlayerGuardFloater />
          </div>
          <DamageFloater />
          <ReflectDamageFloater />
          {victoryPhase === 'cleared' && (
            <VictoryClearOverlay onExitToMap={handleClearedExitToMap} />
          )}
          {failPhase === 'shown' && (
            <BattleFailOverlay onExitToMap={onExitToMap} onRetry={retryFromFail} />
          )}
        </div>
        <div className={styles.roboPanel}>
          <div className={styles.flowchartArea}>
            <FlowchartArea stage={stage} />
            <div className={styles.flowchartControls}>
              <div className={styles.topRow}>
                <ZoomButton />
                <ResetButton stage={stage} />
              </div>
            </div>
          </div>
          <div className={styles.playerArea}>
            <Hand />
          </div>
        </div>
        <RoboBubble variant="battle" />
      </section>
      <DragOverlay className={styles.dragOverlayWrapper}>
        {activeCard && (
          <div className={styles.dragOverlay}>
            <Card card={activeCard} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default BattleScreen;
