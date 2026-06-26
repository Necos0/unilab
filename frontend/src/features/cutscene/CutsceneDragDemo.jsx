import { useEffect, useRef, useState } from 'react';
import styles from './CutsceneDragDemo.module.css';
import Card from '../cards/Card';

/*
 * 位置の基準にする対象に付いている目印属性。`DraggableCard`（カード）や
 * `SlotNode`（スロット）が `data-cutscene-point="..."` を付与しており、その値と
 * step 側の `from` / `to` が一致する要素を始点・終点として使う。
 */
const POINT_ATTR = 'data-cutscene-point';

/*
 * ゴーストに描く `Card` の素の寸法（`Card.module.css` の `.root` と一致）。
 * 画面上のカード／スロットの実寸に合わせて `scale()` でこの値から拡大縮小する。
 */
const CARD_BASE_WIDTH = 120;

/**
 * カットシーン中、カードをスロットへドラッグ＆ドロップする操作を見せる
 * 説明アニメーション。
 *
 * `from`（つかむカード）と `to`（置き先スロット）に対応する
 * `[data-cutscene-point="..."]` 要素を `getBoundingClientRect` で計測し、
 * 半透明のカード（ゴースト）と指先カーソルが `from` から `to` まで滑らかに
 * 動いて戻る、を繰り返すループ演出を描画する。置き先スロットには点滅する枠を
 * 重ねて「ここに置く」ことを示す。これにより「攻撃カードをマスに置いてみよう」
 * という吹き出しに合わせて、実際の指の動かし方を目で見て真似できる。
 *
 * 親の `RoboBubble` レイヤー（`position: fixed; inset: 0`）の中に置く前提で、
 * ビューポート座標（`rect.left` / `rect.top`）をそのまま `fixed` 配置に使う。
 * ゴースト・カーソル・枠はすべて `pointer-events: none` で、下の全面クリック
 * 受けレイヤー（次の step へ送る操作）を邪魔しない。
 *
 * 移動の演出は **Web Animations API**（`element.animate`）で行う。始点・終点を
 * JS 側で実ピクセルに確定してから `translate()` のキーフレームを渡すため、CSS
 * 変数を `@keyframes` に流し込む方式より確実に動く。`prefers-reduced-motion` が
 * 有効なときはループを止め、ゴーストを終点に静止表示する。`from` か `to` の要素が
 * 見つからないあいだ（別画面・未マウント等）は何も描画しない。位置はリサイズ・
 * スクロールでも測り直して追従する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         from (string): つかむ側の `data-cutscene-point` 値（例: `attackCard`）。
 *         to (string): 置き先の `data-cutscene-point` 値（例: `slot-1`）。
 *         cardId (string): ゴーストに描くカードの ID。既定は `'attack'`。
 *
 * Returns:
 *     JSX.Element | null: 始点・終点が測れればゴースト＋カーソル＋枠、無ければ null。
 */
function CutsceneDragDemo({ from, to, cardId = 'attack' }) {
  const [geom, setGeom] = useState(null);
  const ghostRef = useRef(null);

  useEffect(() => {
    if (!from || !to) {
      return undefined;
    }
    /*
     * 始点（カード）と終点（スロット）を測り、ゴーストの大きさ・始点座標・終点
     * 座標と、置き先の枠の矩形を求めて state に入れる。両方が揃っているときだけ
     * 描画対象とし、片方でも欠けるなら null にして何も出さない。レイアウト確定後
     * に呼ぶため初回は requestAnimationFrame で1フレーム遅らせ、リサイズ・
     * スクロール時にも同じ関数で測り直して追従する。
     */
    const measure = () => {
      const fromEl = document.querySelector(`[${POINT_ATTR}="${from}"]`);
      const toEl = document.querySelector(`[${POINT_ATTR}="${to}"]`);
      if (!fromEl || !toEl) {
        setGeom(null);
        return;
      }
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      const width = fromRect.width;
      const height = fromRect.height;
      setGeom({
        width,
        height,
        startX: fromRect.left,
        startY: fromRect.top,
        endX: toRect.left + toRect.width / 2 - width / 2,
        endY: toRect.top + toRect.height / 2 - height / 2,
        ringTop: toRect.top,
        ringLeft: toRect.left,
        ringWidth: toRect.width,
        ringHeight: toRect.height,
      });
    };
    const rafId = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [from, to]);

  const startX = geom?.startX;
  const startY = geom?.startY;
  const endX = geom?.endX;
  const endY = geom?.endY;

  useEffect(() => {
    const el = ghostRef.current;
    if (!el || startX == null) {
      return undefined;
    }
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      el.style.transform = `translate(${endX}px, ${endY}px)`;
      el.style.opacity = '0.9';
      return undefined;
    }
    /*
     * つかむ（始点で少し弾む）→ 運ぶ（終点へ移動）→ 置く（終点で沈む）→ フェード、を
     * 1ループにする。フェードで消えてから先頭へ戻るため瞬間移動が目立たない。
     */
    const animation = el.animate(
      [
        { transform: `translate(${startX}px, ${startY}px) scale(0.9)`, opacity: 0, offset: 0 },
        { transform: `translate(${startX}px, ${startY}px) scale(1.08)`, opacity: 0.95, offset: 0.08 },
        { transform: `translate(${startX}px, ${startY}px) scale(1)`, opacity: 0.95, offset: 0.2 },
        { transform: `translate(${endX}px, ${endY}px) scale(1)`, opacity: 0.95, offset: 0.68 },
        { transform: `translate(${endX}px, ${endY}px) scale(0.9)`, opacity: 0.95, offset: 0.8 },
        { transform: `translate(${endX}px, ${endY}px) scale(1)`, opacity: 0.8, offset: 0.92 },
        { transform: `translate(${endX}px, ${endY}px) scale(1)`, opacity: 0, offset: 1 },
      ],
      { duration: 2600, iterations: Infinity, easing: 'ease-in-out' },
    );
    return () => animation.cancel();
  }, [startX, startY, endX, endY]);

  if (!geom) {
    return null;
  }

  const cardScale = geom.width / CARD_BASE_WIDTH;

  return (
    <>
      <div
        className={styles.targetRing}
        style={{
          top: `${geom.ringTop}px`,
          left: `${geom.ringLeft}px`,
          width: `${geom.ringWidth}px`,
          height: `${geom.ringHeight}px`,
        }}
        aria-hidden="true"
      />
      <div
        ref={ghostRef}
        className={styles.ghost}
        style={{
          width: `${geom.width}px`,
          height: `${geom.height}px`,
          transform: `translate(${geom.startX}px, ${geom.startY}px)`,
          opacity: 0,
        }}
        aria-hidden="true"
      >
        <div className={styles.cardScale} style={{ transform: `scale(${cardScale})` }}>
          <Card card={{ id: cardId }} />
        </div>
        <svg
          className={styles.cursor}
          viewBox="0 0 24 24"
          width="30"
          height="30"
          aria-hidden="true"
        >
          <path
            d="M5 2.5 L5 19.5 L9.2 15.3 L12.2 21.5 L15 20.2 L12 14 L18.2 14 Z"
            fill="#ffffff"
            stroke="#2a2320"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  );
}

export default CutsceneDragDemo;
