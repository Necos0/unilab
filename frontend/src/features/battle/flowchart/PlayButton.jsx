import useBattleStore, { selectAllSlotsFilled } from '../../../stores/battleStore';
import styles from './PlayButton.module.css';

/**                                                                         
 * フローチャートに配置されたカードを順次ハイライトしながら実行するボタン。   
 *                                                                            
 * クリックするとストアの `startExecution(stage)` を呼び、スタートマーカーから
 * ゴールマーカーまでハイライトを進行させる。本スペックではダメージ計算等は   
 * 行わず、ビジュアル進行のみ。                                               
 *                                                          
 * 以下のいずれかが成立するときボタンを `disabled` にする：                   
 *   - 実行中（`isExecuting`）：連打防止                    
 *   -                                                                        
 拡大／縮小切替アニメーション中（`isTransitioning`）：状態の二重遷移を回避     
*   - 全スロットが埋まっていない：要件 2-1（部分配置での実行を許可しない）
*                                                                            
* 表示は `/icons/flowchart/play.svg` の緑色再生アイコンのみで、テキストは    
* 持たない。意味は `aria-label="実行"` で支援技術に伝える。                  
*                                                                            
* Args:                                                                      
*     props (object): React プロパティ。                   
*         stage (object): `stages.json` の 1 ステージ分。`startExecution` に 
*             そのまま渡され、フェーズ列の構築と所要時間の算出に使われる。
*                                                                            
* Returns:                                                 
*     JSX.Element: 実行ボタン要素。                                          
*/
function PlayButton({ stage }) {
    const isExecuting = useBattleStore((s) => s.isExecuting);
    const isTransitioning = useBattleStore((s) => s.isTransitioning);
    const allFilled = useBattleStore(selectAllSlotsFilled);
    const startExecution = useBattleStore((s) => s.startExecution);

    const isDisabled = isExecuting || isTransitioning || !allFilled;

    const handleClick = () => {
        startExecution(stage);
    };

    return (
        <button
            type="button"
            className={styles.button}
            onClick={handleClick}
            disabled={isDisabled}
            aria-label="実行"
        >
            <img
                className={styles.icon}
                src="/icons/flowchart/play.svg"
                alt=""
                draggable={false}
            />
        </button>
    );
}

export default PlayButton;