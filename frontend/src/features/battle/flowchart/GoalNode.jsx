import { Handle, Position } from '@xyflow/react';                             
import styles from './GoalNode.module.css';      
import useBattleStore from '../../../stores/battleStore';                             

/**                                                                           
 * フローチャートの終点を示すゴールマーカー（モノクロ旗）。
 *                                                                            
 * React Flow のカスタムノードとしてフローチャート最右に配置され、
 * 「処理がここで終わる」ことを視覚的に伝える。`SlotNode` と異なり
 * `useDroppable` を呼ばないため dnd-kit のヒットテストに登録されず、
 * カードのドロップ対象にならない。エッジの終点として左辺（`Left`、既定）と
 * 上辺（`Top`、`id="top"`）に target Handle を持つ。`Top` は cond から真下へ
 * 降りる exit（`flowchart-loop` の `trueDir: 'down'` 等）がゴール上辺へ垂直に
 * 入るための受け口で、横方向の通常フローでは `Left` を使う。
 *
 * さらに右辺に target Handle（`id="right-in"`、`flowchart-turn` 仕様）を持つ。
 * これは折り返し（turn）構文で行 2 が左向きに展開されたあと、最終スロットから
 * ゴールへ左向きに進入するエッジ（`sourceHandle: "left-out"` →
 * `targetHandle: "right-in"`）の受け口。turn を使わないステージでは未使用ハンドル
 * として無害に存在するだけ。
 *
 * 実行中、`executionStep` が自身（`type: 'node', id: 'goal'`）と一致したら
 * `.active` クラスを付与し、CSS の `@keyframes startGoalHighlight` で
 * アイコンを発光・点滅させる（play-button 要件 5-5）。
 *
 * 通過済みの可視化（`battle-fail-retry` 要件 1-3, 1-4, 1-6）：
 * `traversedNodeIds` に `'goal'` が含まれていれば `.traversed` クラスを
 * 付与し、`startGoalHighlight` キーフレーム終端と同一値の `filter` を静的に
 * 当てた固定光を維持する。`.active` の点滅終了から `.traversed` の固定光へ
 * 明度差なく遷移する。ゴールに到達したかどうかが Fail 後にも残り、フロー
 * チャート末端まで処理が進んだか／途中で打ち切られたかをプレイヤーが
 * 振り返れる。中断機構（`applyPlayerDamage` の死亡検知）でゴール到達前に
 * Fail へ遷移した場合、`'goal'` は `traversedNodeIds` に含まれないため
 * 本マーカーは光らない（経路の到達範囲が一目でわかる）。`SlotNode` ／
 * `StartNode` と同一パターン。
 *
 * Returns:
 *     JSX.Element: ゴールマーカーを表す div 要素。
 */
function GoalNode() {               
    const isActive = useBattleStore(
        (s) => s.executionStep?.type === 'node' && s.executionStep?.id === 'goal',
    );
    const isTraversed = useBattleStore((s) => s.traversedNodeIds.includes('goal'));

    const className = [
        styles.marker, 
        isActive && styles.active, 
        isTraversed && styles.traversed
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
          type="target"
          position={Position.Right}
          id="right-in"
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