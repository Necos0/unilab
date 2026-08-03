import styles from './BackToTitleButton.module.css';

/**
 * マップ画面の左上にオーバーレイ表示する「タイトルに もどる」ボタン。
 *
 * クリックでタイトル画面へ戻るトリガー。本ボタン自体は遷移ロジックを
 * 持たず、`onClick` props として受けたハンドラを呼ぶだけ（実際の遷移は
 * `App` が `setScreen('title')` で行う）。マップ上の現在位置は
 * `progressStore.lastPosition` として常時保存されているため、タイトルへ
 * 戻ってもスタートで同じ場所から再開でき、進行が失われる心配はない。
 *
 * 意匠はタイトル画面の「エンディングゲームで あそぶ」ボタン
 * （`TitleScreen` の `.endingButton`）と揃えたダーク地＋金枠の控えめな
 * テキストボタン。マップの主要導線（ランドマーク・右上のマップ移動）より
 * 目立たないよう小ぶりにする。配置は CSS の `position: absolute` で
 * SVG マップ上に重ねる（右上の `MapTravelButton` と対になる左上）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onClick (function): ボタンクリック時に呼び出すハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: ボタン要素。
 */
function BackToTitleButton({ onClick }) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onClick}
      aria-label="タイトルに もどる"
      title="タイトルに もどる"
    >
      ◀ タイトル
    </button>
  );
}

export default BackToTitleButton;
