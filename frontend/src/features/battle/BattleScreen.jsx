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
import EnemySprite from './enemy/EnemySprite';
import Hand from '../cards/Hand';
import Card from '../cards/Card';
import HpBar from '../../components/HpBar';
import useBattleStore from '../../stores/battleStore';
import stagesData from '../../data/stages.json';
import enemiesData from '../../data/enemies.json';
import playerData from '../../data/player.json';

const stage = stagesData.stages[0];

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
 *   - 中段: フローチャート領域（React Flow）
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
 * Returns:
 *     JSX.Element: 戦闘画面全体を表す section 要素。
 */
function BattleScreen() {
  const enemy = enemiesData.enemies.find((e) => e.id === stage.enemyId);
  const enemyMaxHp = enemy?.maxHp;
  const playerMaxHp = playerData.maxHp;

  const initializeBattle = useBattleStore((s) => s.initializeBattle);
  const beginDrag = useBattleStore((s) => s.beginDrag);
  const endDrag = useBattleStore((s) => s.endDrag);
  const activeCard = useBattleStore(selectActiveCard);

  useEffect(() => {
    initializeBattle(stage);
  }, [initializeBattle]);

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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section className={styles.root}>
        <div className={styles.enemyArea}>
          <EnemySprite enemyId={stage.enemyId} state="idle" />
          <HpBar currentHp={enemyMaxHp} maxHp={enemyMaxHp} />
        </div>
        <div className={styles.flowchartArea}>
          <FlowchartArea stage={stage} />
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
