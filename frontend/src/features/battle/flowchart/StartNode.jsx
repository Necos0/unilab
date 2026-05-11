import { Handle, Position } from '@xyflow/react';
import styles from './StartNode.module.css';
import useBattleStore from '../../../stores/battleStore';

/**                                                                           
 * フローチャートの起点を示すスタートマーカー（→）。
 *                                                                            
 * React Flow のカスタムノードとしてフローチャート最左に配置され、
 * 「処理がここから始まる」ことを視覚的に伝える。`SlotNode` と異なり          
 * `useDroppable` を呼ばないため dnd-kit のヒットテストに登録されず、
 * カードのドロップ対象にならない。エッジの起点として右辺に
 * `source` Handle を 1 つだけ持つ。
 *
 * 実行中、`executionStep` が自身（`type: 'node', id: 'start'`）と一致したら
 * `.active` クラスを付与し、CSS の `@keyframes startGoalHighlight` で
 * アイコンを発光・点滅させる（play-button 要件 5-1）。
 *
 * 通過済みの可視化（`battle-fail-retry` 要件 1-3, 1-4, 1-6）：
 * `traversedNodeIds` に `'start'` が含まれていれば `.traversed` クラスを
 * 付与し、`startGoalHighlight` キーフレーム終端と同一値の `filter` を静的に
 * 当てた固定光を維持する。`.active` の点滅終了から `.traversed` の固定光へ
 * 明度差なく遷移する。実行終了後も `initializeBattle` または `retryFromFail`
 * が呼ばれるまで残るため、失敗時に「実行がここから始まった」ことを白く
 * 光った経路の起点として確認できる。`SlotNode` ／ `GoalNode` と同一パターン。
 *
 * Returns:
 *     JSX.Element: スタートマーカーを表す div 要素。
 */
function StartNode(){
    const isActive = useBattleStore(
        (s) => s.executionStep?.type === 'node' && s.executionStep?.id === 'start',
    );
    const isTraversed = useBattleStore((s) => s.traversedNodeIds.includes('start'));

    const className = [
        styles.marker, 
        isActive && styles.active, 
        isTraversed && styles.traversed
    ]
        .filter(Boolean)
        .join(' ');
    
    return (
        <div className={className}>
            <img
                className={styles.icon}
                src="/icons/flowchart/start.svg"
                alt="スタート"
                draggable={false}
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

export default StartNode;