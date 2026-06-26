import styles from './TitleScreen.module.css';

/* タイトル画像（`public/title.png`、1536×1024 の 3:2 ピクセルアート）。 */
const TITLE_IMAGE_SRC = '/title.png';

/**
 * タイトル画面。アプリ起動直後に最初に表示する画面。
 *
 * タイトル画像（`/title.png`）を画面いっぱいにレターボックス表示し、中央に
 * 「スタート」ボタンを重ねる。ボタンを押すと `onStart` を呼び、親（`App`）が
 * ステージ1の入り口（マップ画面 `map_1`）へ遷移する。
 *
 * 画像は 3:2 のため、`.root`（ダーク背景・中央寄せ）の中に画像比に合わせた
 * `.canvas` を置き、`object-fit: contain` で絵全体を見せる。スタートボタンは
 * `.canvas` 基準の絶対配置で中央に置くため、レターボックスの黒帯ではなく
 * 実際の絵の中央に重なる（`MapScreen` の `.root` / `.canvas` と同じ構成）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onStart (function): スタートボタン押下時に呼ぶ関数（引数なし）。
 *
 * Returns:
 *     JSX.Element: タイトル画面全体を表す `<section>` 要素。
 */
function TitleScreen({ onStart }) {
  return (
    <section className={styles.root}>
      <div className={styles.canvas}>
        <img
          className={styles.image}
          src={TITLE_IMAGE_SRC}
          alt="わせだクエスト"
        />
        <button type="button" className={styles.startButton} onClick={onStart}>
          スタート
        </button>
      </div>
    </section>
  );
}

export default TitleScreen;
