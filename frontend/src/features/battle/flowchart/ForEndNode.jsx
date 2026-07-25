import { Handle, Position } from '@xyflow/react';
import useBattleStore from '../../../stores/battleStore';
import styles from './ForNode.module.css';

/**
 * for ループの終了点を示すマーカー兼「ループバック／出口」の分岐点
 * （`for-loop` 仕様）。
 *
 * React Flow のカスタムノードとして描画され、右辺（goal 側）の 2 つの角を
 * 斜めに切った長方形（`for-start` を左右反転した六角形）で表現する。
 * `for-start` と対を成し、両者で「for 文の開始／終了」を視覚的にマークする。
 * `for-start` と違い数字表示は持たず、装飾のみを担う（残回数は for-start に
 * 集約表示）。
 *
 * 実行時の役割：
 *   1. **カウンタ decrement**：`for-end` に到達すると `battleStore` の
 *      `scheduleNodePhase` が `decrementForLoopCounter(forLoopId)` を呼び、
 *      `forLoopCounters[forLoopId]` を 1 減らす（0 でクランプ）。
 *      `forLoopId` は `data.forLoopId` として `FlowchartArea.forEndsToNodes`
 *      から React Flow の `data` prop 経由で運ばれるが、実際に参照するのは
 *      store 側で持つ `nodeMap[nodeId].forLoopId`
 *   2. **loop-back / exit 分岐**：`battleStore.selectNextEdge` が
 *      `nodeMap[nodeId].type === 'for-end'` を検知して、decrement 直後の
 *      `forLoopCounters[forLoopId]` を読み、残 > 0 なら
 *      `sourceHandle: 'loop-back'` のエッジ、残 == 0 なら
 *      `sourceHandle: 'exit'` のエッジを選ぶ
 *
 * Handle 構成（3 つ）：
 *   - Left（target、デフォルト id）：body の最後のノードから到達する
 *     通常の incoming エッジ
 *   - Top（source、`id="loop-back"`）：`for-start` の `id="loop-back"`
 *     target ハンドルへ戻るループバックエッジの出口。上を回る smoothstep で
 *     `for-start` に接続する想定
 *   - Right（source、`id="exit"`）：ループを抜けて後続ノード（合流ノード、
 *     Attack、Goal 等）へ進む出口。`selectNextEdge` が exit を選んだときの
 *     行き先
 *
 * 視覚演出は `for-start` と同じパターン：
 *   - `executionStep` が自身に一致 → `.active` クラスで発光・点滅
 *     （`@keyframes forHighlight`、`speedMultiplier` に追従）
 *   - `traversedNodeIds` に自身の id を含む → `.traversed` クラスで固定発光
 *
 * `for-end` は dnd-kit のドロップターゲットではない（`useDroppable` を
 * 呼ばない）。カードを配置する概念がないため。
 *
 * Args:
 *     props (object): React Flow からカスタムノードに渡される props。
 *         id (string): for-end ノード ID（`stages.json` の `forEnds[].id`
 *             に一致）。
 *
 * Returns:
 *     JSX.Element: 右角カット長方形を表す div 要素。
 */
function ForEndNode({ id }) {
  const isActive = useBattleStore(
    (s) => s.executionStep?.type === 'node' && s.executionStep?.id === id,
  );
  const isTraversed = useBattleStore((s) => s.traversedNodeIds.includes(id));

  const className = [
    styles.forNode,
    styles.end,
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
        type="source"
        position={Position.Top}
        id="loop-back"
        className={styles.handle}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="exit"
        className={styles.handle}
        isConnectable={false}
      />
    </div>
  );
}

export default ForEndNode;