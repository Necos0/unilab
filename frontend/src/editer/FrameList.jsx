import { useRef, useState } from 'react';
import styles from './FrameList.module.css';

/**
 * 切り取ったコマを左下に並べるサムネイルリスト。ドラッグで並べ替えできる。
 *
 * HTML5 ドラッグ＆ドロップで項目をつかみ、別の項目の上にドロップすると順番が
 * 入れ替わる（実際の配列操作は親の `onReorder` に委譲）。各項目には現在の
 * 並び順インデックスと削除ボタンを表示する。リストの順序がそのまま連番
 * （`_00`, `_01`, ...）と再生順になる。`isSelectable`（＝再生停止中）のときは
 * 項目をクリックするとそのコマをプレビューに表示でき、選択中のコマを強調する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         frames (Array<{id: number, dataUrl: string}>): 表示するコマ一覧。
 *         onReorder (function): 並べ替え時に `(fromIndex, toIndex)` で呼ぶ関数。
 *         onRemove (function): 削除時に対象コマの `id` を渡して呼ぶ関数。
 *         onSelect (function): コマクリック時にそのインデックスを渡して呼ぶ関数。
 *         selectedIndex (number): プレビューに表示中のコマのインデックス。
 *         isSelectable (boolean): クリックでの選択が有効か（再生停止中なら true）。
 *
 * Returns:
 *     JSX.Element: コマ一覧を表す要素。
 */
function FrameList({ frames, onReorder, onRemove, onSelect, selectedIndex, isSelectable }) {
  const dragIndex = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  const handleDrop = (toIndex) => {
    const fromIndex = dragIndex.current;
    if (fromIndex !== null && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
    dragIndex.current = null;
    setOverIndex(null);
  };

  return (
    <div className={styles.list}>
      <div className={styles.title}>切り取ったコマ（{frames.length}）</div>
      <div className={styles.items}>
        {frames.map((frame, index) => (
          <div
            key={frame.id}
            className={[
              styles.item,
              overIndex === index ? styles.over : '',
              isSelectable ? styles.selectable : '',
              isSelectable && selectedIndex === index ? styles.selected : '',
            ]
              .filter(Boolean)
              .join(' ')}
            draggable
            onClick={() => onSelect(index)}
            onDragStart={() => {
              dragIndex.current = index;
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setOverIndex(index);
            }}
            onDragLeave={() => setOverIndex((current) => (current === index ? null : current))}
            onDrop={() => handleDrop(index)}
            onDragEnd={() => {
              dragIndex.current = null;
              setOverIndex(null);
            }}
          >
            <span className={styles.index}>{index}</span>
            <img src={frame.dataUrl} alt="" className={styles.thumb} />
            <button
              type="button"
              className={styles.remove}
              onClick={(event) => {
                event.stopPropagation();
                onRemove(frame.id);
              }}
              title="このコマを削除"
            >
              ×
            </button>
          </div>
        ))}
        {frames.length === 0 && (
          <div className={styles.empty}>
            まだコマがありません。枠を合わせて「この枠を切り取る」を押してください。
          </div>
        )}
      </div>
    </div>
  );
}

export default FrameList;
