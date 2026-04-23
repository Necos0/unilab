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

  const isDragActive = activeInstanceId !== null;
  const isDraggingThisCard =
    isDragActive && assignedCard?.instanceId === activeInstanceId;
  const showAsFilled = !!assignedCard && !isDraggingThisCard;

  const className = [
    styles.slot,
    showAsFilled && styles.filled,
    isDragActive && styles.dropTarget,
    isOver && styles.isOver,
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
