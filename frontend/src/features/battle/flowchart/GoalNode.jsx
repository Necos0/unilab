import { Handle, Position } from '@xyflow/react';                             
import styles from './GoalNode.module.css';                                   

/**                                                                           
 * フローチャートの終点を示すゴールマーカー（モノクロ旗）。
 *                                                                            
 * React Flow のカスタムノードとしてフローチャート最右に配置され、
 * 「処理がここで終わる」ことを視覚的に伝える。`SlotNode` と異なり            
 * `useDroppable` を呼ばないため dnd-kit のヒットテストに登録されず、         
 * カードのドロップ対象にならない。エッジの終点として左辺に                   
 * `target` Handle を 1 つだけ持つ。                                          
 *                                                                            
 * Returns:     
 *     JSX.Element: ゴールマーカーを表す div 要素。                           
 */
function GoalNode() {                                                         
    return (      
        <div className={styles.marker}>
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