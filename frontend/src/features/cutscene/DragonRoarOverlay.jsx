import styles from './DragonRoarOverlay.module.css';

/**
 * 遠くから「ドラゴンの叫び声」が聞こえる演出の背景層（3-4 クリア後にマップへ
 * 戻った直後のカットシーン）。
 *
 * カットシーン `map-stage3-roar` の `dragonRoar` step の間だけ、親
 * （`MapScreen`）がマップの描画矩形（`.canvas`）を覆う層として条件付きで
 * マウントする。叫び声の文字そのものはビットのセリフと同じ吹き出し
 * （`RoboBubble`、名前プレート「???」＝step の `speaker`）に出し、この層は
 * 声が響いたことを表す「赤黒いかげり」だけを受け持つ。マップ自体のゆれは
 * 親が同じ step の間だけ `.svg` にゆれ用クラスを付けて表現する。
 *
 * 吹き出しの step なので、先へ進むのはプレイヤーのクリック／Enter
 * （`RoboBubble` の送り）。この層は時間で勝手に進めない。操作は上に重なる
 * 吹き出しの全面レイヤーが受けるため、この層はクリックを通す。
 *
 * Returns:
 *     JSX.Element: 親の矩形全体を覆う演出層。
 */
function DragonRoarOverlay() {
  return (
    <div className={styles.overlay} aria-hidden="true">
      <div className={styles.veil} />
    </div>
  );
}

export default DragonRoarOverlay;
