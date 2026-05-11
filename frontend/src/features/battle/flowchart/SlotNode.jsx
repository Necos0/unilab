import { Handle, Position } from '@xyflow/react';
import { useDroppable } from '@dnd-kit/core';
import DraggableCard from '../../cards/DraggableCard';
import useBattleStore from '../../../stores/battleStore';
import styles from './SlotNode.module.css';

/**
 * フローチャート上のスロットを表す React Flow カスタムノード。
 *
 * `useDroppable` で dnd-kit のドロップターゲットとして登録し、
 * `battleStore` の `slotAssignments` を購読してこのスロット（`props.id`）
 * に割当られたカードがあれば内側に `DraggableCard` を描画する。
 * 割当がないときは従来の点線枠の空きスロットとして描画する。
 *
 * ドラッグ中の視覚フィードバックとして、以下の分岐でクラスを付け替える：
 *   - `activeInstanceId !== null` のとき：ドロップ候補として控えめなハイライト
 *   - `isOver === true` のとき：ポインタ直下のスロットとして強いハイライト
 *   - スロットに置かれたカード自身がドラッグ中のとき：見た目を空きスロット
 *     表示に戻す（元のカードは `DraggableCard` 側の半透明表現で「つかんで
 *     いる」ことを示しているが、スロット自体は「空」の見た目にする）
 *   - 実行中（`isExecuting`）または拡大／縮小切替中（`isTransitioning`）：
 *     `.locked` クラスで `pointer-events: none` を再付与し、ベース CSS の
 *     `pointer-events: auto`（React Flow ラッパーの `none` を上書きするため）
 *     を一時的に無効化することで、配置済みカードのドラッグもロックする
 *   - `executionStep` が自身（`type: 'node', id: props.id`）と一致したとき：
 *     `.active` クラスで `@keyframes slotHighlight` を起動し、内側のカードを
 *     発光・点滅させる（play-button 要件 5-3）
 *   - `traversedNodeIds` に自身の id が含まれているとき：`.traversed` クラス
 *     で固定の発光（`@keyframes slotHighlight` の終端と同じ filter 値を静的に
 *     当てた光り方）を維持する（`battle-fail-retry` 要件 1-3, 1-4, 1-6）。
 *     `.active` のキーフレーム終端と `.traversed` の固定値を一致させているので、
 *     フェーズ突入時の点滅 → 終了 → 固定光 の遷移が明度差なくシームレスに
 *     繋がる。`initializeBattle` または `retryFromFail` が呼ばれるまで残るため、
 *     失敗時にプレイヤーが「どのスロットを通ったか」を後から振り返れる
 *
 * `Handle` はエッジの接続点として必要なため配置するが、ユーザーが手動で
 * エッジを引く用途ではないため CSS で視覚的に非表示にしている。
 *
 * Args:
 *     props (object): React Flow からカスタムノードに渡される props。
 *         id (string): スロット ID（`stages.json` の `slots[].id` に一致）。
 *
 * Returns:
 *     JSX.Element: スロットを表す div 要素。
 */
function SlotNode({ id }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const assignedCard = useBattleStore((s) => s.slotAssignments[id] ?? null);
  const activeInstanceId = useBattleStore((s) => s.activeInstanceId);
  const isExecuting = useBattleStore((s) => s.isExecuting);
  const isTransitioning = useBattleStore((s) => s.isTransitioning);
  const isActive = useBattleStore(
    (s) => s.executionStep?.type === 'node' && s.executionStep?.id === id,
  );
  const isTraversed = useBattleStore((s) => s.traversedNodeIds.includes(id));

  const isDragActive = activeInstanceId !== null;
  const isDraggingThisCard =
    isDragActive && assignedCard?.instanceId === activeInstanceId;
  const showAsFilled = !!assignedCard && !isDraggingThisCard;

  const className = [
    styles.slot,
    showAsFilled && styles.filled,
    isDragActive && styles.dropTarget,
    isOver && styles.isOver,
    (isExecuting || isTransitioning) && styles.locked,
    isActive && styles.active,
    isTraversed && styles.traversed
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={setNodeRef} className={className}>
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
        isConnectable={false}
      />
      {assignedCard && (
        <DraggableCard card={assignedCard} source={id} variant="fill" />
      )}
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
        isConnectable={false}
      />
    </div>
  );
}

export default SlotNode;
