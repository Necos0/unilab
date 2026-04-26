import { Handle, Position } from '@xyflow/react';
import styles from './StartNode.module.css';

/**                                                                           
 * フローチャートの起点を示すスタートマーカー（→）。
 *                                                                            
 * React Flow のカスタムノードとしてフローチャート最左に配置され、
 * 「処理がここから始まる」ことを視覚的に伝える。`SlotNode` と異なり          
 * `useDroppable` を呼ばないため dnd-kit のヒットテストに登録されず、         
 * カードのドロップ対象にならない。エッジの起点として右辺に                   
 * `source` Handle を 1 つだけ持つ。                                          
 *                                                                            
 * Returns:                                                                   
 *     JSX.Element: スタートマーカーを表す div 要素。
 */
function StartNode(){
    return (
        <div className={styles.marker}>
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