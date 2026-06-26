import styles from './HelpButton.module.css';

/**
 * バトル画面の左上にオーバーレイ表示するヘルプ（カード説明）ボタン。
 *
 * クリックでカードの説明ウィンドウ（`CardHelpWindow`）の表示をトリガー
 * する。本ボタン自体は開閉状態を持たず、`onClick` props として受けた
 * ハンドラを呼ぶだけで、実際の表示制御は `BattleScreen` 側のローカル
 * 状態が担う。`BackToMapButton`（右上）と対称になるよう、トーンを揃えて
 * `.root` 基準の絶対配置で左上に重ねる。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onClick (function): ボタンクリック時に呼び出すハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: ボタン要素。
 */
function HelpButton({ onClick }) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onClick}
      aria-label="カードの せつめい"
    >
      ？
    </button>
  );
}

export default HelpButton;
