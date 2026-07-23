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
 * 実行中（`isExecuting`）・拡大／縮小切替アニメ中（`isTransitioning`）・
 * 勝利演出中（`victoryPhase !== null`）は `disabled` 属性を付与して
 * クリック不可にする。CSS の `.button:disabled` で半透明＋
 * `cursor: not-allowed` 表示にし、押せないことを視覚的に伝える
 * （play-button 要件 3-2、victory-clear 要件 6-2）。
 *
 * ルート要素の `data-cutscene-point="zoomButton"` はカットシーンの指差し
 * 誘導（`CutscenePointer`）の対象にするためのアンカー。2-1 入場時の
 * 拡大機能チュートリアル（cutscenes.json の `stage2-1-enter`）が参照する。
 *
 * Returns:
 *     JSX.Element: トグルボタン要素。
 */
function ZoomButton() {
  const isExpanded = useBattleStore((s) => s.isExpanded);
  const toggleExpand = useBattleStore((s) => s.toggleExpand);
  const isExecuting = useBattleStore((s) => s.isExecuting);
  const isTransitioning = useBattleStore((s) => s.isTransitioning);
  const victoryPhase = useBattleStore((s) => s.victoryPhase);

  const isDisabled = isExecuting || isTransitioning || victoryPhase !== null;

  return (
    <button
      type="button"
      className={styles.button}
      onClick={toggleExpand}
      aria-label={isExpanded ? 'フローチャートを縮小' : 'フローチャートを拡大'}
      disabled={isDisabled}
      data-cutscene-point="zoomButton"
    >
      {isExpanded ? '↓' : '↑'}
    </button>
  );
}

export default ZoomButton;
