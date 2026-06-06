import styles from './EditorEntryButton.module.css';

/**
 * マップ画面の右下に重ねて表示する、スプライトシートエディタ起動ボタン。
 *
 * 開発用ツールへの入口で、押すと `onClick`（App 側でエディタ画面へ切り替える
 * ハンドラ）を呼ぶだけのプレゼンテーション用ボタン。配置は CSS の
 * `position: absolute` で `.canvas` 基準の右下に固定する。エディタは開発者
 * 向けのため、ゲーム内テキストのふりがな規則は適用しない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onClick (function): ボタンクリック時に呼ぶハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: ボタン要素。
 */
function EditorEntryButton({ onClick }) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onClick}
      title="スプライトシートエディタを開く"
    >
      スプライトシートエディタ
    </button>
  );
}

export default EditorEntryButton;
