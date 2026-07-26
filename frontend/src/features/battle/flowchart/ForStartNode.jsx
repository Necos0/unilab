import { Handle, Position } from '@xyflow/react';
import useBattleStore from '../../../stores/battleStore';
import styles from './ForNode.module.css';

/**
 * for ループの開始点を示すマーカー兼「残り回数」ディスプレイ
 * （`for-loop` 仕様）。
 *
 * React Flow のカスタムノードとして描画され、左辺（start 側）の 2 つの角を
 * 斜めに切った長方形（右向きに広がる六角形）で表現する。`for-end` と対を
 * 成し、両者で「for 文の開始／終了」を視覚的にマークする。中央には現在の
 * 残回数（`forLoopCounters[id]`）を大きな数字で表示し、実行中に iteration が
 * 進むたびに更新される（3 → 2 → 1 と減っていくのが見える）。
 *
 * 内部カウンタの初期化とデクリメント：
 *   - **初期化**：`battleStore.initializeBattle` がステージ定義の `forStarts`
 *     配列を走査して `forLoopCounters[f.id] = f.iterations` にセットする。
 *     retryFromFail 時は `forLoopIterations` から復元される
 *   - **デクリメント**：`for-end` に到達したときに `battleStore` の
 *     `scheduleNodePhase` が `decrementForLoopCounter(forLoopId)` を呼ぶ。
 *     `for-start` 自身は counter を変更しない（`for-start` に何回到達しても
 *     残回数は変わらず、body に入るタイミングで body の中の条件ノードが
 *     現在値を `forCounter('<id>')` で参照する）
 *
 * ループ抜け判定は `for-end` 側で行う：`for-end` に到達 → decrement → 残 > 0
 * なら `sourceHandle: 'loop-back'` エッジで `for-start` へ戻る、残 == 0 なら
 * `sourceHandle: 'exit'` エッジでループ外へ進む。`for-start` 自体は 1 本の
 * outgoing エッジ（body へ進む）だけを持ち、分岐しない。
 *
 * Handle 構成（3 つ）：
 *   - Left（target、デフォルト id）：前ノードから初回入場する通常のエッジ
 *   - Top（target、`id="top"`）：`for-end` から折り返してくるループバックエッジの
 *     受け口。`AnimatedProgressEdge` の `shouldUseStep` が `targetHandleId ===
 *     'top'` を検知して smoothstep（上を回る角丸経路）を選ぶ。既存の `MergeNode`
 *     の loop-back 受け口（`id="top"`）と同じ命名規約。for-end 側の
 *     `sourceHandle: "loop-back"` は `battleStore.selectNextEdge` が
 *     loop-back / exit を区別するためのソース側の識別子で、target 側とは意味が
 *     独立している
 *   - Right（source、デフォルト id）：body の最初のノードへ進む outgoing エッジ
 *
 * 視覚演出は既存 `SlotNode` / `ConditionNode` と同じパターン：
 *   - `executionStep` が自身に一致 → `.active` クラスで発光・点滅
 *     （`@keyframes forHighlight`、`speedMultiplier` に追従）
 *   - `traversedNodeIds` に自身の id を含む → `.traversed` クラスで固定発光
 *     （実行終了後の経路振り返り）
 *
 * `for-start` は dnd-kit のドロップターゲットではない（`useDroppable` を
 * 呼ばない）。カードを配置する概念がないため。
 *
 * ルート要素の `data-cutscene-point={id}`（例: `for-start-1`）はカットシーンの
 * 指差し誘導（`CutscenePointer`）の対象にするためのアンカー。4-2 入場時の
 * カウントマスチュートリアル（cutscenes.json の `stage4-2-enter`）が参照する。
 *
 * Args:
 *     props (object): React Flow からカスタムノードに渡される props。
 *         id (string): for-start ノード ID（`stages.json` の `forStarts[].id`
 *             に一致）。`forLoopCounters[id]` のキーにもなる。
 *         data (object): `{ iterations: number }` を含むデータ。
 *             `FlowchartArea.forStartsToNodes` から渡される。`iterations` は
 *             ステージ定義で指定した反復回数（3 以上でも可、上限なし）。
 *             `forLoopCounters[id]` が未初期化のときのフォールバック表示に使う。
 *
 * Returns:
 *     JSX.Element: 左角カット長方形＋残回数表示を表す div 要素。
 */
function ForStartNode({ id, data }) {
  const isActive = useBattleStore(
    (s) => s.executionStep?.type === 'node' && s.executionStep?.id === id,
  );
  const isTraversed = useBattleStore((s) => s.traversedNodeIds.includes(id));
  const remaining = useBattleStore(
    (s) => s.forLoopCounters?.[id] ?? data.iterations ?? 0,
  );

  const className = [
    styles.forNode,
    styles.start,
    isActive && styles.active,
    isTraversed && styles.traversed,
  ]
    .filter(Boolean)
    .join(' ');
  
  return (
    <div className={className} data-cutscene-point={id}>
      <span className={styles.count}>{remaining}</span>
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
        className={styles.handle}
        isConnectable={false}
      />
    </div>
  );
}

export default ForStartNode;