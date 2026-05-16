import { Handle, Position } from '@xyflow/react';
import useBattleStore from '../../../stores/battleStore';
import styles from './ConditionNode.module.css';

/**
 * フローチャート上の条件分岐ノードを表す React Flow カスタムノード。
 *
 * `stages.json` の `conditions[]` から構築されるノードで、菱形の見た目で
 * 描画される。中央に条件式テキスト（例: `playerHp > 50`）を表示し、実行
 * シーケンスがこのノードに到達した時点で `evaluateCondition` の結果に応じて
 * Yes / No の経路が選ばれる（`map-2-stage-1` 要件 1-1〜1-3）。条件式評価
 * 自体は `battleStore` 側の `selectNextEdge` で行い、本コンポーネントは
 * **視覚要素とハンドルの提供** に責務を限定する。
 *
 * Handle 構成（4 つ）：
 *   - Left（target、デフォルト id）：標準的な「左から入ってくるエッジ」用。
 *     線形フローの延長として条件ノードに到達する基本ケース。
 *   - Top（target、`id="top"`）：将来「上からエッジが入ってくる」レイアウト
 *     用の予備ハンドル。エッジ側で `targetHandle: 'top'` を指定したときに
 *     接続される（要件 1-5 の拡張性確保）。
 *   - Right（source、`id="true"`）：菱形の右頂点。条件評価結果が `true` の
 *     とき進む経路。エッジ側で `sourceHandle: 'true'` を指定する。
 *   - Bottom（source、`id="false"`）：菱形の下頂点。条件評価結果が `false` の
 *     とき進む経路。エッジ側で `sourceHandle: 'false'` を指定する。
 *
 * 視覚演出は既存 `SlotNode` と同じパターンで以下を提供：
 *   - `executionStep` が自身に一致 → `.active` クラスで点滅発光
 *     （`@keyframes conditionHighlight`）
 *   - `traversedNodeIds` に自身の id を含む → `.traversed` クラスで固定発光
 *     （実行終了後の経路振り返り、要件 4-1）
 *
 * 条件分岐ノードは dnd-kit のドロップターゲットではない（`useDroppable` を
 * 呼ばない）。カードを配置する概念がないため。
 *
 * Args:
 *     props (object): React Flow からカスタムノードに渡される props。
 *         id (string): 条件ノード ID（`stages.json` の `conditions[].id` に一致）。
 *         data (object): `{ expression: string }` を含むデータ。`FlowchartArea`
 *             の `conditionsToNodes` で `data: { expression: c.expression }` の
 *             形で渡される。
 *
 * Returns:
 *     JSX.Element: 菱形ノードを表す div 要素。
 */
function ConditionNode({ id, data }) {
  const isActive = useBattleStore(
    (s) => s.executionStep?.type === 'node' && s.executionStep?.id === id,
  );
  const isTraversed = useBattleStore((s) => s.traversedNodeIds.includes(id));

  const className = [
    styles.diamond,
    isActive && styles.active,
    isTraversed && styles.traversed,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
        isConnectable={false}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={styles.handle}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className={styles.handle}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className={styles.handle}
        isConnectable={false}
      />
      <div className={styles.expression}>{data.expression}</div>
    </div>
  );
}

export default ConditionNode;
