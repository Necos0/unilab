import styles from './GalleryEntryButton.module.css';

/**
 * マップ画面の右下、スプライトシートエディタボタンの上に重ねて表示する、
 * キャラクター一覧画面の起動ボタン。
 *
 * 押すと `onClick`（App 側でキャラクター一覧画面へ切り替えるハンドラ）を
 * 呼ぶだけのプレゼンテーション用ボタン。配置は CSS の `position: absolute`
 * で `.canvas` 基準の右下に固定し、`EditorEntryButton` のひとつ上の段に
 * 並ぶよう `bottom` をずらしてある。閲覧用の開発ツール入口のため、ゲーム内
 * テキストのふりがな規則は適用しない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onClick (function): ボタンクリック時に呼ぶハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: ボタン要素。
 */
function GalleryEntryButton({ onClick }) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onClick}
      title="キャラクター一覧を開く"
    >
      キャラクター一覧
    </button>
  );
}

export default GalleryEntryButton;
