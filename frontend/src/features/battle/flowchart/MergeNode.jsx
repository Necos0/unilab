import { Handle, Position } from '@xyflow/react';
import useBattleStore from '../../../stores/battleStore';
import styles from './MergeNode.module.css';

/**
 * フローチャート上の合流ノードを表す React Flow カスタムノード。
 *
 * 条件分岐ノード（`ConditionNode`）の True / False 経路が合流するポイントを
 * 視覚的にマークする小さな円。`stagesLoader` が条件分岐の存在を検知して
 * 自動的に挿入するノードで、ステージデザイナーが `stages.json` の `flow`
 * 配列に明示的に書く必要はない（`merge-node` 要件 2-1）。
 *
 * IEC 5807 などのフローチャート慣習で「合流」は円で表現されるため、
 * 条件分岐の菱形と視覚的に明確に区別される。本ノードはカード効果を持たず、
 * 実行シーケンスが通過しても HP やシールド等の状態は変動しない
 * （`battleStore.scheduleNodePhase` で `slotAssignments[mergeId]` が
 * undefined のため、既存の効果分岐ガードで自動的にスキップされる）。
 *
 * Handle 構成（3 つ）：
 *   - Left（target、デフォルト id）：True 経路の終端ノードから水平直線で
 *     入ってくる
 *   - Bottom（target、`id="bottom"`）：False 経路の終端から smoothstep の
 *     U 字経路で **下から上向きに** 入ってくる（`AnimatedProgressEdge` の
 *     `targetHandleId === 'bottom'` 判定で smoothstep が選ばれる）。
 *     False 経路は `processSubFlow` 内で `yLevel + 160` の下段を走るため、
 *     合流ノード側のハンドルを下辺に置くことで「下段で右へ進行 → 合流
 *     ノード直下で上向きに進入」という自然な経路になる。当初は Top に
 *     置いていたが、source（下段）が target（上段）より下にある状況で
 *     smoothstep が「一度 target を上方に越えて上から進入する」不自然な
 *     経路を生成してしまうため Bottom に変更した
 *   - Right（source、デフォルト id）：合流先（次の通常スロット または goal）
 *     へ水平直線で出ていく
 *
 * 視覚演出は既存 `SlotNode` / `ConditionNode` と同じパターン：
 *   - `executionStep` が自身に一致 → `.active` クラスで点滅発光
 *     （`@keyframes mergeHighlight`）
 *   - `traversedNodeIds` に自身の id を含む → `.traversed` クラスで固定発光
 *     （実行終了後の経路振り返り）
 *
 * 合流ノードは dnd-kit のドロップターゲットではない（`useDroppable` を
 * 呼ばない）。カードを配置する概念がないため。
 *
 * Args:
 *     props (object): React Flow からカスタムノードに渡される props。
 *         id (string): 合流ノード ID（`stagesLoader` 自動生成、`merge-K` 形式）。
 *
 * Returns:
 *     JSX.Element: 小さな円を表す div 要素。
 */
function MergeNode({ id }) {
  const isActive = useBattleStore(
    (s) => s.executionStep?.type === 'node' && s.executionStep?.id === id,
  );
  const isTraversed = useBattleStore((s) => s.traversedNodeIds.includes(id));

  const className = [
    styles.circle,
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
        position={Position.Bottom}
        id="bottom"
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

export default MergeNode;