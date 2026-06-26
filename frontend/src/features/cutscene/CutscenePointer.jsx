import { useEffect, useState } from 'react';
import styles from './CutscenePointer.module.css';

/*
 * 指差し誘導の対象 DOM 要素に付ける目印属性。BattleScreen 側で HP バーの
 * ラッパー（`enemyHpBox` / `playerHpBox`）に `data-cutscene-point="..."` を
 * 付与しており、その値とカットシーン step の `point` が一致する要素を指す。
 */
const POINT_ATTR = 'data-cutscene-point';

/*
 * リングを対象要素の外側へ少し広げる余白（px）。バーぴったりだと囲っている
 * 感が弱いので、上下左右にこの分だけ膨らませて枠取りする。
 */
const RING_PADDING = 10;

/**
 * カットシーン中、ロボの説明に合わせて画面内の特定要素を指し示す演出。
 *
 * `targetId` に対応する `[data-cutscene-point="<targetId>"]` 要素を
 * `getBoundingClientRect` で計測し、その位置にぴったり重なる固定配置の
 * リング（点滅する枠＋グロー）と、真上で上下に弾む下向き矢印を描画する。
 * これにより「ここが {playerName} の HP」「ここが相手の HP」といった
 * 説明と、画面上の HP バーが視覚的に結びつく。
 *
 * 親の `RoboBubble` レイヤー（`position: fixed; inset: 0`）の中に置く前提で、
 * ビューポート座標（`rect.top` / `rect.left`）をそのまま `fixed` 配置に使う。
 * リング・矢印はどちらも `pointer-events: none` で、下の全面クリック受け
 * レイヤー（次の吹き出しへ送る操作）を邪魔しない。
 *
 * 対象要素が存在しない（別画面・まだマウントされていない等）ときは何も
 * 描画しない。`targetId` が変わるたびに測り直し、ウィンドウのリサイズ・
 * スクロールにも追従する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         targetId (string|null): 指し示す対象の `data-cutscene-point` 値。
 *             null のときは何も描画しない。
 *
 * Returns:
 *     JSX.Element | null: 対象が見つかればリング＋矢印、無ければ null。
 */
function CutscenePointer({ targetId }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!targetId) {
      return undefined;
    }
    /*
     * 対象要素を測って state に反映する。レイアウト確定後に呼ぶため初回は
     * requestAnimationFrame 経由で1フレーム遅らせる。リサイズ・スクロール時
     * にも同じ関数で測り直して追従する（capture フェーズでスクロールを拾う）。
     */
    const measure = () => {
      const el = document.querySelector(`[${POINT_ATTR}="${targetId}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const rafId = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [targetId]);

  if (!rect) {
    return null;
  }

  const ringStyle = {
    top: `${rect.top - RING_PADDING}px`,
    left: `${rect.left - RING_PADDING}px`,
    width: `${rect.width + RING_PADDING * 2}px`,
    height: `${rect.height + RING_PADDING * 2}px`,
  };

  return (
    <div className={styles.ring} style={ringStyle} aria-hidden="true">
      <span className={styles.arrow} />
    </div>
  );
}

export default CutscenePointer;
