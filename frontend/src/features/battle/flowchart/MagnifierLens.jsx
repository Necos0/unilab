import { useCallback, useEffect, useRef, useState } from 'react';
import useBattleStore from '../../../stores/battleStore';
import styles from './MagnifierLens.module.css';

/** レンズの半径（px）。直径 = 2 倍。 */
const LENS_RADIUS = 110;

/** レンズ内の拡大率。画面に見えているものをこの倍率で拡大する。 */
const MAGNIFICATION = 1.6;

/**
 * レンズを出す距離のしきい値（px）。条件ノードの矩形からこの距離以内に
 * カーソルが入ったら表示する。ノードの周囲（はい/いいえ ラベルのあたり）
 * まで含めるための余白。
 */
const SHOW_DISTANCE = 24;

/**
 * レンズを消す距離のしきい値（px）。表示中は SHOW_DISTANCE より大きい
 * この距離まで離れて初めて消す（ヒステリシス）。表示⇔非表示の境界を
 * 跨いだときのちらつきを防ぎ、はい/いいえ ラベルの上へカーソルを
 * 動かしてもレンズが維持されるようにする。
 */
const HIDE_DISTANCE = 72;

/**
 * フローチャート上で条件分岐ノードにカーソルを近づけたときに出る虫眼鏡レンズ。
 *
 * 本物の虫眼鏡のように「画面に見えているものと全く同じ内容」を丸いレンズの
 * 中に拡大表示する。仕組みは DOM クローン方式：React Flow の
 * `.react-flow__viewport`（ノード・エッジ・ラベルを含む描画層全体）を
 * `cloneNode(true)` でコピーしてレンズ内に置き、外側から
 * `translate(R - M·x, R - M·y) scale(M)` を掛ける。クローンは元の viewport の
 * transform（パン・ズーム）を保持しているため、この外側 transform だけで
 * 「カーソル直下の点がレンズ中央に来る M 倍表示」になる（x, y はキャンバス
 * 座標のカーソル位置、R はレンズ半径、M は拡大率）。つまりレンズに映るのは
 * 現在の画面表示そのもの（フローチャートの縮小率にも自動で追従する）。
 *
 * 第二の React Flow インスタンスを描く方式にしない理由：`SlotNode` の
 * `useDroppable` / `DraggableCard` の `useDraggable` が同じ ID で二重登録され、
 * dnd-kit のレジストリを壊す（レンズを閉じた時に元スロットの登録まで消える）
 * ため。静的クローンなら副作用がない。クローン内の SVG マーカー ID
 * （`url(#...)` 参照）は文書内で重複するが、参照解決は文書順で先勝ちのため
 * 見た目は変わらない。`data-cutscene-point` の重複も、`CutscenePointer` の
 * `querySelector` が文書順で先（本物）を返すため実害はない。
 *
 * 表示判定は DOM ホバーではなく **距離判定**：本物の viewport 内の
 * `[data-magnifier-target]`（`ConditionNode` のルート）の矩形とカーソルの
 * 距離を毎 pointermove で測り、`SHOW_DISTANCE` 以内で表示・`HIDE_DISTANCE`
 * より離れたら非表示にする。しきい値を分けるヒステリシスで境界での
 * ちらつきを防ぎつつ、ノードの少し外にある はい/いいえ ラベルへカーソルを
 * 動かしてもレンズが維持される。矩形検索はクローン側の同属性を拾わないよう
 * 本物の viewport（文書順で先勝ち）配下に限定する。
 *
 * 表示中はキャンバス（`containerRef`）に `.magnifying` クラスを付け、
 * 配下全要素の cursor を none にする（レンズ自体がカーソルの役割を果たす）。
 * ノード単位の `cursor: none` にしないのは、境界を跨ぐたびにシステム
 * カーソルが出たり消えたりしてちらつくため。レンズは `pointer-events: none`
 * なので下のノードの操作を一切妨げない。
 *
 * 位置更新は React の再レンダーを避けて ref 経由で style を直接書く
 * （pointermove は毎秒 60 回以上発火するため）。クローンの中身は表示開始時に
 * 作り、以降は `battleStore` の状態変化時（実行の進行など、見た目が変わり得る
 * とき）だけ requestAnimationFrame で間引いて取り直す。定期タイマーで
 * 取り直さないのは、内容が変わっていないのに差し替えるとクローン内の CSS
 * アニメーションが再スタートして点滅して見えるため。
 *
 * Args:
 *     props (object): React プロパティ。
 *         containerRef (object): フローチャートのキャンバス要素
 *             （`FlowchartArea` の `.canvas`）への ref。ポインタ監視と
 *             viewport 検索の起点になる。
 *
 * Returns:
 *     JSX.Element: レンズ要素（非表示中は display: none）。
 */
function MagnifierLens({ containerRef }) {
  const lensRef = useRef(null);
  const contentRef = useRef(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const isVisibleRef = useRef(false);
  const [isVisible, setIsVisible] = useState(false);

  /* カーソル位置に合わせてレンズ本体と中身の transform を ref 経由で更新する。 */
  const applyPosition = useCallback(() => {
    const lens = lensRef.current;
    const content = contentRef.current;
    if (!lens || !content) return;
    const { x, y } = positionRef.current;
    lens.style.left = `${x - LENS_RADIUS}px`;
    lens.style.top = `${y - LENS_RADIUS}px`;
    content.style.transform = `translate(${LENS_RADIUS - MAGNIFICATION * x}px, ${
      LENS_RADIUS - MAGNIFICATION * y
    }px) scale(${MAGNIFICATION})`;
  }, []);

  /* 本物の viewport をクローンしてレンズの中身を差し替える。 */
  const refreshClone = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    const viewport = container?.querySelector('.react-flow__viewport');
    if (!content || !viewport) return;
    content.replaceChildren(viewport.cloneNode(true));
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    /*
     * カーソルから最寄りの条件ノード矩形までの距離（px）。矩形の内側は 0。
     * クローン内の条件ノードを拾わないよう、本物の viewport（querySelector
     * は文書順で先勝ち＝ReactFlow 本体側）配下だけを検索する。
     */
    const distanceToNearestTarget = (clientX, clientY) => {
      const viewport = container.querySelector('.react-flow__viewport');
      if (!viewport) return Infinity;
      let nearest = Infinity;
      viewport.querySelectorAll('[data-magnifier-target]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
        const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
        nearest = Math.min(nearest, Math.hypot(dx, dy));
      });
      return nearest;
    };

    const show = () => {
      if (isVisibleRef.current) return;
      isVisibleRef.current = true;
      container.classList.add(styles.magnifying);
      setIsVisible(true);
    };
    const hide = () => {
      if (!isVisibleRef.current) return;
      isVisibleRef.current = false;
      container.classList.remove(styles.magnifying);
      setIsVisible(false);
    };

    const handlePointerMove = (event) => {
      const threshold = isVisibleRef.current ? HIDE_DISTANCE : SHOW_DISTANCE;
      if (distanceToNearestTarget(event.clientX, event.clientY) > threshold) {
        hide();
        return;
      }
      const rect = container.getBoundingClientRect();
      positionRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      applyPosition();
      show();
    };
    const handlePointerLeave = () => hide();

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
      container.classList.remove(styles.magnifying);
    };
  }, [containerRef, applyPosition]);

  /*
   * 表示中のクローン管理。表示開始時に作り、以降は battleStore の変化
   * （実行進行・発光など見た目が変わり得るとき）だけ rAF で間引いて
   * 取り直す。
   */
  useEffect(() => {
    if (!isVisible) return undefined;
    refreshClone();
    let rafId = null;
    const unsubscribe = useBattleStore.subscribe(() => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        refreshClone();
      });
    });
    return () => {
      unsubscribe();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isVisible, refreshClone]);

  return (
    <div
      ref={lensRef}
      className={isVisible ? styles.lens : `${styles.lens} ${styles.hidden}`}
      aria-hidden="true"
    >
      <div className={styles.glass}>
        <div ref={contentRef} className={styles.content} />
        <div className={styles.glare} />
      </div>
      <div className={styles.handle} />
    </div>
  );
}

export default MagnifierLens;
