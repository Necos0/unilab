import styles from './PlazaEntryButton.module.css';

/**
 * マップ画面の右下、デバッグボタン群の最上段に表示する
 * 「あそびのひろば」への遷移ボタン（テスト用）。
 *
 * 押すと `onClick`（App 側でひろば画面へ切り替えるハンドラ）を呼ぶだけの
 * プレゼンテーション用ボタン。配置は CSS の `position: absolute` で
 * `.canvas` 基準の右下に固定し、`CutsceneFlowEntryButton` のひとつ上の段に
 * 並ぶよう `bottom` をずらしてある。
 *
 * 本実装では「ステージ 2（ワールド 2 のボス）クリア」でマップ上に解放される
 * ランドマークから入る想定で、このボタンはそれまでの動作確認用の仮入口。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onClick (function): ボタンクリック時に呼ぶハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: ボタン要素。
 */
function PlazaEntryButton({ onClick }) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onClick}
      title="あそびのひろばを開く（テスト用）"
    >
      あそびのひろば
    </button>
  );
}

export default PlazaEntryButton;
