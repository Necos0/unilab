import { useDraggable } from '@dnd-kit/core';
import Card from './Card';
import useBattleStore from '../../stores/battleStore';
import styles from './DraggableCard.module.css';

/**
 * カードをドラッグ可能にする薄いラッパーコンポーネント。
 *
 * 既存の `Card`（描画専用）を `useDraggable` でラップし、ドラッグ時の
 * `id` として `card.instanceId` を、`data.source` としてドラッグ元の種別
 * （`'hand'` または元スロット ID）を渡す。`source` は `BattleScreen` の
 * `onDragEnd` がストアの `endDrag` に転送する際に必要となる。
 *
 * ドラッグ中は、ストアの `activeInstanceId` が自身の `instanceId` と一致
 * するときに半透明化して「つかんでいる」ことを元位置に示す。実際に
 * ポインタに追従するカードは `BattleScreen` 側の `DragOverlay` が
 * 別途描画する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         card (object): `CardInstance`。`instanceId` / `id` / `power` を持つ。
 *         source (string): ドラッグ元。`'hand'` またはスロット ID。
 *
 * Returns:
 *     JSX.Element: ドラッグ可能な領域としてカードを包む div 要素。
 */
function DraggableCard({ card, source }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: card.instanceId,
    data: { source },
  });
  const isDragging = useBattleStore(
    (s) => s.activeInstanceId === card.instanceId,
  );

  const className = isDragging
    ? `${styles.root} ${styles.dragging}`
    : styles.root;

  return (
    <div
      ref={setNodeRef}
      className={className}
      {...listeners}
      {...attributes}
    >
      <Card card={card} />
    </div>
  );
}

export default DraggableCard;
