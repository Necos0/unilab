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
 * ラスボス（4-4）をクリア済みのプレイヤーには、スタートの下に
 * 「エンディングゲームで あそぶ」ボタンを出し、エンディングロール
 * （クレジットの上を歩くコイン集め）だけをいつでも遊び直せるようにする。
 *
 * さらにラスボスクリアに加えてエンディングロールも遊び切ったプレイヤーには、
 * その下に「じんとりがっせん で あそぶ」ボタンを出し、おまけミニゲーム
 * （陣取り合戦）へ入れるようにする（本編＋エンディングのさらにおまけ）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onStart (function): スタートボタン押下時に呼ぶ関数（引数なし）。
 *         onPlayEnding (function): 「エンディングゲームで あそぶ」押下時に
 *             呼ぶ関数（引数なし）。エンディングロールへ直行する。
 *         canPlayEnding (boolean): エンディング再プレイボタンを出すか
 *             （ラスボスをクリア済みか）。
 *         onPlayLaneBattle (function): 「じんとりがっせん で あそぶ」押下時に
 *             呼ぶ関数（引数なし）。おまけミニゲーム（陣取り合戦）を開く。
 *         canPlayLaneBattle (boolean): 陣取り合戦ボタンを出すか（ラスボス
 *             クリア済み かつ エンディングロールを遊び切ったか）。
 *
 * Returns:
 *     JSX.Element: タイトル画面全体を表す `<section>` 要素。
 */
function TitleScreen({
  onStart,
  onPlayEnding,
  canPlayEnding = false,
  onPlayLaneBattle,
  canPlayLaneBattle = false,
}) {
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
          {canPlayEnding && (
            <button
              type="button"
              className={styles.endingButton}
              onClick={onPlayEnding}
            >
              エンディングゲームで あそぶ
            </button>
          )}
          {canPlayLaneBattle && (
            <button
              type="button"
              className={styles.laneBattleButton}
              onClick={onPlayLaneBattle}
            >
              ⚔️ じんとりがっせん で あそぶ
            </button>
          )}
          <FullscreenToggleButton className={styles.fullscreenButton} />
        </div>
      </div>
    </section>
  );
}

export default TitleScreen;
