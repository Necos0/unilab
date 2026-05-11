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
  * 実行中（`isExecuting`）・拡大／縮小切替アニメ中（`isTransitioning`）・
  * 勝利演出中（`victoryPhase !== null`）・失敗演出中（`failPhase !== null`）は
  * `disabled` 属性を付与してクリック不可にする。CSS の `.button:disabled` で
  * 半透明＋ `cursor: not-allowed` 表示にし、押せないことを視覚的に伝える
  * （play-button 要件 3-2、victory-clear 要件 6-2、`battle-fail-retry` 要件 7-2）。
  * 失敗時に `disabled` を併用するのは、`.root.failed` の `pointer-events: none`
  * による全体ロックではキーボード経由の発火が通ってしまうため、二重防御として
  * disable 属性も加える設計。「やり直す」直後（`failPhase: null`）には通常通り
  * 押せる状態に戻る。
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
  const isExecuting = useBattleStore((s) => s.isExecuting);
  const isTransitioning = useBattleStore((s) => s.isTransitioning);
  const victoryPhase = useBattleStore((s) => s.victoryPhase);
  const failPhase = useBattleStore((s) => s.failPhase);

  const isDisabled = isExecuting || isTransitioning || victoryPhase !== null || failPhase !== null;

  const handleClick = () => {
    initializeBattle(stage);
  };

  return (
    <button type="button" className={styles.button} onClick={handleClick} aria-label="リセット" disabled={isDisabled}>
      <img className={styles.icon} src="/icons/flowchart/reset.svg" alt="" draggable={false}/>
    </button>
  );
}

export default ResetButton;
