import { useEffect } from 'react';
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
import useBattleStore from '../../stores/battleStore';
import stagesData from '../../data/stages.json';
import enemiesData from '../../data/enemies.json';
import playerData from '../../data/player.json';


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
 *   - 上段: 敵スプライトと敵 HP バー（`EnemySprite` + 汎用 `HpBar`）
 *   - 中段: フローチャート領域（React Flow） ＋ 右上のコントロール群         
 *      （上段に拡大トグル ＋ リセット、下段に実行ボタン）  
 *   - 下段: プレイヤー HP バー + 数値と手札カード領域
 *
 * マウント時に `initializeBattle(stage)` でストアを初期化し、以降の
 * 手札・スロット割当は `battleStore` が保持する。`DndContext` の
 * `onDragStart` / `onDragEnd` はそれぞれ `beginDrag` / `endDrag` に
 * 橋渡しする。センサーは `PointerSensor` と `TouchSensor` を登録し、
 * どちらも 4px の距離しきい値を付けてタップ・クリックとの誤検出を避ける。
 * 追加で `DragOverlay` を配置し、ドラッグ中のカードがポインタに追従
 * するフローティング表示を提供する。
 *
 * フローチャートの拡大／縮小状態はストアの `isExpanded` を購読して           
 * ルート `<section>` の className に `.expanded` を条件付与することで        
 * レイアウトを切り替える。切替アニメーション中（`isTransitioning`）と
 * 実行中（`isExecuting`）は `.transitioning` ／ `.executing` クラスを        
 * 付与して pointer-events を無効化し、ユーザー操作をブロックする。
 *
 * Args:
 *     props (object): React プロパティ。
 *         stageId (string): 戦うステージの ID。`stages.json` のキーに対応。
 *             未指定時は `demoStageId` をフォールバックとして使う。
 *         onExitToMap (function): 右上「マップへ戻る」ボタン押下時に呼ぶ
 *             ハンドラ。引数なし。テスト用途のため戦闘進行や勝敗に
 *             関係なく即座にマップ画面へ戻る。
 *
 * Returns:
 *     JSX.Element: 戦闘画面全体を表す section 要素。
 */
function BattleScreen({ stageId, onExitToMap }) {
  const resolvedStageId = stageId ?? stagesData.demoStageId;
  const stage = stagesData.stages[resolvedStageId];
  const enemy = enemiesData.enemies.find((e) => e.id === stage.enemyId);
  const enemyMaxHp = enemy?.maxHp;
  const playerMaxHp = playerData.maxHp;

  const initializeBattle = useBattleStore((s) => s.initializeBattle);
  const beginDrag = useBattleStore((s) => s.beginDrag);
  const endDrag = useBattleStore((s) => s.endDrag);
  const activeCard = useBattleStore(selectActiveCard);
  const isExpanded = useBattleStore((s) => s.isExpanded);
  const isTransitioning = useBattleStore((s) => s.isTransitioning);
  const isExecuting = useBattleStore((s) => s.isExecuting);

  useEffect(() => {
    initializeBattle(stage);
  }, [initializeBattle, stage]);

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

  const rootClassName = [
    styles.root,
    isExpanded && styles.expanded,
    isTransitioning && styles.transitioning,
    isExecuting && styles.executing,
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
        <BackToMapButton onClick={onExitToMap} />
        <div className={styles.enemyArea}>
          <EnemySprite enemyId={stage.enemyId} state="idle" />
          <HpBar currentHp={enemyMaxHp} maxHp={enemyMaxHp} />
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
          <div className={styles.hpBox}>
            <HpBar currentHp={playerMaxHp} maxHp={playerMaxHp} />
            <span className={styles.hpText}>
              {playerMaxHp}/{playerMaxHp}
            </span>
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
