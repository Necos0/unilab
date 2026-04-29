import useBattleStore from '../../../stores/battleStore';
import styles from './ZoomButton.module.css';

/**
 * フローチャートの拡大／縮小をトグル切替するボタン。
 *
 * `battleStore` の `isExpanded` を購読して、縮小状態では上向き矢印「↑」
 * （＝押すと拡大する）、拡大状態では下向き矢印「↓」（＝押すと縮小する）を
 * 表示する。クリック時は `toggleExpand()` を呼び、`isTransitioning` 中は
 * ストア側で no-op になるため、連打や切替中の再押下は安全に無視される。
 *
 * 配置は親コンポーネント（`BattleScreen`）側の `.flowchartControls` が
 * 担う。本コンポーネント自身は見た目と onClick のみを提供する。見た目は
 * `ResetButton` と同じトーン（背景 `#1f1f28`・文字 `#e5e5ff`・角丸）。
 * 
 * 実行中（`isExecuting`）または拡大／縮小切替アニメ中（`isTransitioning`）                                                          
 * は `disabled` 属性を付与してクリック不可にする。CSS の `.button:disabled`                                                         
 * で半透明＋ `cursor: not-allowed` 表示にし、押せないことを視覚的に伝える                                                          
 * （play-button 要件 3-2）。                                         
 *
 * Returns:
 *     JSX.Element: トグルボタン要素。
 */
function ZoomButton() {
  const isExpanded = useBattleStore((s) => s.isExpanded);
  const toggleExpand = useBattleStore((s) => s.toggleExpand);
  const isExecuting = useBattleStore((s) => s.isExecuting);
  const isTransitioning = useBattleStore((s) => s.isTransitioning);

  const isDisabled = isExecuting || isTransitioning;

  return (
    <button
      type="button"
      className={styles.button}
      onClick={toggleExpand}
      aria-label={isExpanded ? 'フローチャートを縮小' : 'フローチャートを拡大'}
      disabled={isDisabled}
    >
      {isExpanded ? '↓' : '↑'}
    </button>
  );
}

export default ZoomButton;
