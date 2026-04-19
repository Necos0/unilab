import { Handle, Position } from '@xyflow/react';
import styles from './SlotNode.module.css';

/**
 * フローチャート上の空きスロットを表す React Flow カスタムノード。
 *
 * 点線枠のカード型コンテナとして描画し、ユーザーに「カードを置く場所」
 * であることを視覚的に伝える。本スペックではクリックやドラッグなどの
 * インタラクションは持たず、見た目のみを提供する。
 *
 * `Handle` はエッジの接続点として必要なため配置するが、ユーザーが
 * 手動でエッジを引く用途ではないため CSS で視覚的に非表示にしている。
 *
 * Returns:
 *     JSX.Element: 空きスロットを表す div 要素。
 */
function SlotNode() {
  return (
    <div className={styles.slot}>
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
        isConnectable={false}
      />
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
