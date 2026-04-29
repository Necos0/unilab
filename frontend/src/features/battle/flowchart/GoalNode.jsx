import { Handle, Position } from '@xyflow/react';                             
import styles from './GoalNode.module.css';      
import useBattleStore from '../../../stores/battleStore';                             

/**                                                                           
 * フローチャートの終点を示すゴールマーカー（モノクロ旗）。
 *                                                                            
 * React Flow のカスタムノードとしてフローチャート最右に配置され、
 * 「処理がここで終わる」ことを視覚的に伝える。`SlotNode` と異なり            
 * `useDroppable` を呼ばないため dnd-kit のヒットテストに登録されず、
 * カードのドロップ対象にならない。エッジの終点として左辺に
 * `target` Handle を 1 つだけ持つ。
 *
 * 実行中、`executionStep` が自身（`type: 'node', id: 'goal'`）と一致したら
 * `.active` クラスを付与し、CSS の `@keyframes startGoalHighlight` で
 * アイコンを発光・点滅させる（play-button 要件 5-5）。
 *
 * Returns:
 *     JSX.Element: ゴールマーカーを表す div 要素。                           
 */
function GoalNode() {               
    const isActive = useBattleStore(
        (s) => s.executionStep?.type === 'node' && s.executionStep?.id === 'goal',
    );
    
    const className = [styles.marker, isActive && styles.active]
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
        <img
            className={styles.icon}
            src="/icons/flowchart/goal.svg"
            alt="ゴール"                                                          
            draggable={false}
        />                                                                      
        </div>      
    );
}

export default GoalNode;