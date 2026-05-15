import styles from './MapTravelButton.module.css';

/**
 * マップ画面の右下にオーバーレイ表示するマップ移動ボタン。
 *
 * クリックで `MapSelectOverlay`（マップ一覧のモーダル）を開くトリガー。本ボタン
 * 自体は遷移ロジックを持たず、`onClick` props として受けたハンドラを呼ぶだけ。
 * アイコン画像は `/icons/map_travel.png`（`frontend/public/icons/map_travel.png`）
 * を参照する。ピクセル風のテイストを保つため CSS で `image-rendering` を
 * `pixelated` に指定する。可視ラベルは持たないため、アクセシビリティと
 * マウスオーバー時のツールチップ用に `aria-label` / `title` を付与する。
 *
 * 配置は CSS の `position: absolute` で SVG マップ上に重ねる。ホバー時は
 * 拡大・ふちの暖色グロー・背景明度アップで「押せる／選べる」感を強める。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onClick (function): ボタンクリック時に呼び出すハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: ボタン要素。
 */
function MapTravelButton({ onClick }) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onClick}
      aria-label="マップ移動"
      title="マップ移動"
    >
      <img
        src="/icons/map_travel.png"
        alt=""
        aria-hidden="true"
        className={styles.icon}
      />
    </button>
  );
}

export default MapTravelButton;
