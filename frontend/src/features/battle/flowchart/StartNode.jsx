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
 * Returns:
 *     JSX.Element: スタートマーカーを表す div 要素。
 */
function StartNode(){
    const isActive = useBattleStore(
        (s) => s.executionStep?.type === 'node' && s.executionStep?.id === 'start',
    );

    const className = [styles.marker, isActive && styles.active]
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