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
 * 意匠は薄いダーク背景＋細い半透明枠の控えめなテキストボタンで、
 * マップの主要導線（ランドマーク・右上のマップ移動）の邪魔をしない
 * よう存在感を抑える。ホバー時のみ通常の濃さに浮き上がる。配置は
 * CSS の `position: absolute` で SVG マップ上に重ねる（右上の
 * `MapTravelButton` と対になる左上）。
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
      タイトルに もどる
    </button>
  );
}

export default BackToTitleButton;
