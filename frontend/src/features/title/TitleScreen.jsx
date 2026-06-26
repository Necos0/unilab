import styles from './TitleScreen.module.css';
import FullscreenToggleButton from '../map/FullscreenToggleButton';

/* タイトル画像（`public/title.png`、1536×1024 の 3:2 ピクセルアート）。 */
const TITLE_IMAGE_SRC = '/title.png';

/**
 * タイトル画面。アプリ起動直後に最初に表示する画面。
 *
 * タイトル画像（`/title.png`）を画面いっぱいにレターボックス表示し、中央に
 * 「スタート」ボタンを重ねる。ボタンを押すと `onStart` を呼び、親（`App`）が
 * ステージ1の入り口（マップ画面 `map_1`）へ遷移する。
 *
 * `.root`（ダーク背景・中央寄せ）の中にマップ画面と同じ 16:9 の `.canvas` を
 * 置き、`object-fit: contain` で絵全体を見せる（`MapScreen` の `.root` /
 * `.canvas` と同じ構成）。中央の `.controls` に「スタート」ボタンと、その下に
 * 大画面表示トグル（共通の `FullscreenToggleButton` にタイトル用のクラスを
 * 渡したもの）を縦に並べる。レターボックスの黒帯ではなく実際の絵の中央に
 * 重なるよう、`.controls` を `.canvas` 基準の絶対配置で中央に置く。
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
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.startButton}
            onClick={onStart}
          >
            スタート
          </button>
          <FullscreenToggleButton className={styles.fullscreenButton} />
        </div>
      </div>
    </section>
  );
}

export default TitleScreen;
