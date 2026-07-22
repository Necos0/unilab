import { useState } from 'react';
import styles from './MapTravelButton.module.css';

/*
 * 初登場（デビュー）演出のアニメーション長（ms）。CSS の
 * `travelButtonDebut` の `animation-duration` と同じ値を共有し、App 側が
 * 「ボタンが現れてからロボの誘導セリフを出す」タイミング合わせに使う。
 */
const TRAVEL_BUTTON_DEBUT_MS = 900;

/**
 * マップ画面の右上にオーバーレイ表示するマップ移動ボタン。
 *
 * クリックで全体マップ（オーバーワールド `map_0`）へ移動するトリガー。本ボタン
 * 自体は遷移ロジックを持たず、`onClick` props として受けたハンドラを呼ぶだけ
 * （実際の遷移は `MapScreen` の `travelToMap` が黒フェードを挟んで行う）。
 * 全体マップ側では各領域の巻物から各バイオームマップへ移動する。
 * アイコン画像は `/icons/map_travel.png`（`frontend/public/icons/map_travel.png`）
 * を参照する。ピクセル風のテイストを保つため CSS で `image-rendering` を
 * `pixelated` に指定する。可視ラベルは持たないため、アクセシビリティと
 * マウスオーバー時のツールチップ用に `aria-label` / `title` を付与する。
 *
 * 配置は CSS の `position: absolute` で SVG マップ上に重ねる。ホバー時は
 * 拡大・ふちの暖色グロー・背景明度アップで「押せる／選べる」感を強める。
 *
 * 表示条件は `MapScreen` 側が持つ（ワールド 2 以降が解放されるまでは
 * マウントされない）。通常のマウントは CSS の軽いフェードインで現れるが、
 * ステージ1クリア → ワールド解放シネマ直後の「初登場」だけは `isDebut` が
 * true で渡され、ポンと弾む目立つ登場アニメ（`.debut`）に差し替わる。
 * 演出を使うかどうかはマウント時の `isDebut` で固定する（アニメ完了後に
 * 親が `isDebut` を下ろしてもクラスを付け替えず、フェードインが再発して
 * ちらつくのを防ぐ）。登場アニメが終わると `onDebutEnd` を呼び、親は
 * デビュー済みフラグを下ろす（以降の再マウントは通常フェードインになる）。
 * ルート要素の `data-cutscene-point="mapButton"` はカットシーンの指差し誘導
 * （「このマップを押して次のステージに進もう！」）の対象目印。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onClick (function): ボタンクリック時に呼び出すハンドラ。引数なし。
 *         isDebut (boolean): 初登場演出（弾む登場アニメ）を使うか。
 *             マウント時の値だけが効く。省略時は false（通常フェードイン）。
 *         onDebutEnd (function): 初登場アニメ完了時に呼ぶハンドラ。引数なし。
 *             `isDebut` が false のマウントでは呼ばれない。省略可。
 *
 * Returns:
 *     JSX.Element: ボタン要素。
 */
function MapTravelButton({ onClick, isDebut = false, onDebutEnd }) {
  /* 初登場演出の採否はマウント時の値で固定する（docstring 参照）。 */
  const [isDebutMount] = useState(isDebut);

  const handleAnimationEnd = (event) => {
    if (event.target === event.currentTarget && isDebutMount) {
      onDebutEnd?.();
    }
  };

  return (
    <button
      type="button"
      className={
        isDebutMount ? `${styles.button} ${styles.debut}` : styles.button
      }
      onClick={onClick}
      onAnimationEnd={handleAnimationEnd}
      aria-label="マップ移動"
      title="マップ移動"
      data-cutscene-point="mapButton"
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

export { TRAVEL_BUTTON_DEBUT_MS };
export default MapTravelButton;
