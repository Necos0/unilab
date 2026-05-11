import { useEffect, useState } from 'react';
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
import PlayButton from './flowchart/PlayButton';
import EnemySprite from './enemy/EnemySprite';
import BackToMapButton from './BackToMapButton';
import Hand from '../cards/Hand';
import Card from '../cards/Card';
import HpBar from '../../components/HpBar';
import DamageFloater from './enemy/DamageFloater';
import PlayerDamageFloater from './player/PlayerDamageFloater';
import PlayerHealFloater from './player/PlayerHealFloater';
import useBattleStore from '../../stores/battleStore';
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

/**
 * 戦闘画面のルートコンポーネント。
 *
 * Undertale 風の3段レイアウトで画面を構成し、`DndContext` で全体を
 * ラップすることで手札⇄スロット間のドラッグ＆ドロップを可能にする。
 *   - 上段: 敵スプライト + 敵 HP バー（数値併記） + ダメージ数字フロート層
 *      （`EnemySprite` + 汎用 `HpBar` + `DamageFloater`）。HP バーラッパー
 *      は `enemyHpBox` クラス
 *   - 中段: フローチャート領域（React Flow） ＋ 右上のコントロール群
 *      （上段に拡大トグル ＋ リセット、下段に実行ボタン）
 *   - 下段: プレイヤー HP バー（数値併記） + プレイヤー被弾ダメージ数字
 *      フロート層 + プレイヤー回復数字フロート層 + 手札カード領域。
 *      HP バーラッパーは `playerHpBox` クラスで、内側に
 *      `PlayerDamageFloater` と `PlayerHealFloater` を絶対配置で重ねる
 *
 * `enemyHpBox` と `playerHpBox` は対称的な命名で、それぞれ片側だけに
 * レイアウト・演出変更が入っても他方に影響が出ないように分離している。
 *
 * 被弾時の shake + 赤フラッシュ演出は `enemyHpBox` / `playerHpBox` 両方の
 * ラッパー側に実装している（HpBar 本体には触らない）。
 * `battleStore.{enemy,player}DamageEvents` 末尾要素の `id` を購読し、
 * 「最新の id」と「すでに消費済みの id」を比較する派生計算で
 * `isEnemyHit` / `isPlayerHit` を求める方式（`EnemySprite` のフラッシュ
 * 判定と同じパターン）。両者が異なるとき `.hit` クラスが付与され、CSS の
 * `@keyframes hpBoxHit`（0.3 秒の `translateX` 振動 +
 * `filter: brightness/saturate/hue-rotate` による赤系フラッシュを 1 つの
 * キーフレームに合成）が両ラッパー共通で 1 ショット再生される。
 * `onAnimationEnd` で「消費済み id」を「最新の id」に進めると判定が
 * `false` に戻り、次回の被弾で末尾 id が更新されると再び `true` になる。
 * `useEffect` を使わない派生計算パターンにより、React 19 の
 * `react-hooks/set-state-in-effect` ルールにも適合する。
 *
 * `playerHpBox` には被弾と対称に、ヒール時の緑フラッシュ演出も乗る。
 * `playerHealEvents` 末尾の `id` を購読する `isPlayerHealed` の派生計算で
 * `.healed` クラスを付与し、CSS の `@keyframes hpBoxHealed`（shake なし、
 * `filter` のみで `hue-rotate(+20〜+25deg)` の緑寄せ + 明度上昇）が 0.3 秒
 * 1 ショット再生される（heal-card 要件 3-1〜3-4）。被弾と回復は同じ
 * `onAnimationEnd` ハンドラに乗るため、`event.animationName` が `hpBoxHit`
 * か `hpBoxHealed` かで分岐し、`consumedPlayerDamageId` /
 * `consumedPlayerHealId` の id 系列を独立に進める。CSS Modules による
 * キーフレーム名のハッシュ化に備え、`styles.hpBoxHit || 'hpBoxHit'` の
 * OR 併記で実名・生名どちらでも一致するようにしている。
 *
 * マウント時に `initializeBattle(stage)` でストアを初期化し、以降の
 * 手札・スロット割当・敵 HP（`currentEnemyHp` / `maxEnemyHp`）・敵向け
 * ダメージ演出キュー（`enemyDamageEvents`）・プレイヤー HP（`currentPlayerHp`
 * / `maxPlayerHp`）・プレイヤー向けダメージ演出キュー（`playerDamageEvents`）・
 * プレイヤー向けヒール演出キュー（`playerHealEvents`）・勝利演出フェーズ
 * （`victoryPhase`）は `battleStore` が保持する。プレイヤー HP は以前ローカル変数で `playerData.maxHp` を
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
 * ユーザー操作をブロックする。
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
 *             未指定時は `demoStageId` をフォールバックとして使う。
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
  const resolvedStageId = stageId ?? stagesData.demoStageId;
  const stage = stagesData.stages[resolvedStageId];

  const initializeBattle = useBattleStore((s) => s.initializeBattle);
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
  const lastEnemyDamageId = useBattleStore(
    (s) => s.enemyDamageEvents.at(-1)?.id ?? null,
  );
  const [consumedEnemyDamageId, setConsumedEnemyDamageId] = useState(null);
  const isEnemyHit = lastEnemyDamageId !== null && lastEnemyDamageId !== consumedEnemyDamageId;

  useEffect(() => {
    initializeBattle(stage);
  }, [initializeBattle, stage]);

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
        {victoryPhase !== 'cleared' && failPhase !== 'shown' && <BackToMapButton onClick={onExitToMap} />}
        <div className={styles.enemyArea}>
          <EnemySprite enemyId={stage.enemyId} state={enemySpriteState} />
          <div 
            className={`${styles.enemyHpBox} ${isEnemyFading ? styles.fading : ''} ${isEnemyDimmed ? styles.dimmed : ''} ${isEnemyHit ? styles.hit : ''}`}
            onAnimationEnd={() => setConsumedEnemyDamageId(lastEnemyDamageId)}
          >
            <HpBar currentHp={currentEnemyHp} maxHp={maxEnemyHp} />
            <span className={styles.hpText}>
              {currentEnemyHp}/{maxEnemyHp}
            </span>
          </div>
          <DamageFloater />
          {victoryPhase === 'cleared' && (
            <VictoryClearOverlay onExitToMap={handleClearedExitToMap} />
          )}
          {failPhase === 'shown' && (
            <BattleFailOverlay onExitToMap={onExitToMap} onRetry={retryFromFail} />
          )}
        </div>
        <div className={styles.flowchartArea}>
          <FlowchartArea stage={stage} />
          <div className={styles.flowchartControls}>
            <div className={styles.topRow}>
              <ZoomButton />
              <ResetButton stage={stage} />
            </div>
            <PlayButton stage={stage} />
          </div>
        </div>
        <div className={styles.playerArea}>
          <div 
            className={[
              styles.playerHpBox,
              isPlayerHit && styles.hit,
              isPlayerHealed && styles.healed,
            ].filter(Boolean).join(' ')}
            onAnimationEnd={(event) => {
              if (event.animationName === styles.hpBoxHit || event.animationName === 'hpBoxHit') {
                setConsumedPlayerDamageId(lastPlayerDamageId);
              } else if (event.animationName === styles.hpBoxHealed || event.animationName === 'hpBoxHealed') {
                setConsumedPlayerHealId(lastPlayerHealId);
              }
            }}
          >
            <HpBar currentHp={currentPlayerHp} maxHp={maxPlayerHp} />
            <span className={styles.hpText}>
              {currentPlayerHp}/{maxPlayerHp}
            </span>
            <PlayerDamageFloater />
            <PlayerHealFloater />
          </div>
          <Hand />
        </div>
      </section>
      <DragOverlay>
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
