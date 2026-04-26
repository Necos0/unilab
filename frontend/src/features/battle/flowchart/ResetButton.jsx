import useBattleStore from '../../../stores/battleStore';
import styles from './ResetButton.module.css';

/**                                                                           
  * フローチャート上のカード配置をリセットするボタン。
  *                                                                            
  * クリックするとストアの `initializeBattle(stage)` を再実行し、手札を
  * `stages.json` の初期順序に戻しつつ全スロットを空にする。スロットが         
  * 既に全て空であっても冪等な no-op として成立する（card-placement 要件7-4）。
  *                                                                            
  * 表示は円環状の矢印アイコン（SVG）を使用し、テキストは持たない。隣接する    
  * `ZoomButton`（↑/↓）やフローチャート上のスタート／ゴールマーカーと          
  * 視覚的統一感を保つため（card-placement 要件7-6）。意味は                   
  * `aria-label="リセット"` で支援技術に伝える。                               
  *                                                                            
  * 配置は `BattleScreen` 側で `flowchartArea` を `position: relative` に      
  * したうえで、`.flowchartControls` ラッパー内に `ZoomButton` と並べる        
  * （flowchart-zoom スペック）。                                              
  *                                                                            
  * Args:                                                                      
  *     props (object): React プロパティ。                                     
  *         stage (object): `stages.json` の 1 ステージ分。`cards` と `slots` を                                                                            
  *             持ち、`initializeBattle` の再実行に必要。                      
  *                                                                            
  * Returns:     
  *     JSX.Element: ボタン要素。                                              
  */ 
function ResetButton({ stage }) {
  const initializeBattle = useBattleStore((s) => s.initializeBattle);

  const handleClick = () => {
    initializeBattle(stage);
  };

  return (
    <button type="button" className={styles.button} onClick={handleClick} aria-label="リセット">
      <img className={styles.icon} src="/icons/flowchart/reset.svg" alt="" draggable={false}/>
    </button>
  );
}

export default ResetButton;
