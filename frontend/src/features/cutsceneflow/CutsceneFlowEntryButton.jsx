import styles from './CutsceneFlowEntryButton.module.css';

/**
 * マップ画面の右下、キャラクター一覧ボタンのさらに上に重ねて表示する、
 * カットシーン・フロー画面（開発用）の起動ボタン。
 *
 * 押すと `onClick`（App 側でカットシーン・フロー画面へ切り替えるハンドラ）を
 * 呼ぶだけのプレゼンテーション用ボタン。配置は CSS の `position: absolute`
 * で `.canvas` 基準の右下に固定し、`GalleryEntryButton` のひとつ上の段に
 * 並ぶよう `bottom` をずらしてある。開発ツールの入口のため、ゲーム内
 * テキストのふりがな規則は適用しない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onClick (function): ボタンクリック時に呼ぶハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: ボタン要素。
 */
function CutsceneFlowEntryButton({ onClick }) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onClick}
      title="カットシーンの発生タイミング一覧を開く"
    >
      カットシーン一覧
    </button>
  );
}

export default CutsceneFlowEntryButton;
