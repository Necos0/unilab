import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './ImageStage.module.css';
import cropRegion from './cropRegion';

const MIN_SCALE = 0.05;
const MAX_SCALE = 40;
/*
 * ホイール 1 イベントあたりのズーム感度。小さいほどゆっくり拡大縮小する。
 * deltaY に比例させた指数で倍率を決めるため、トラックパッドの細かい連続
 * イベントでも滑らかに効く。1 イベントで効きすぎないよう deltaY は上限で
 * クランプする。
 */
const ZOOM_SENSITIVITY = 0.0012;
const MAX_WHEEL_DELTA = 60;
/* 切り取り枠の最小サイズ（元画像ピクセル）。これ以下には縮められない。 */
const MIN_FRAME_SIZE = 1;
/* リサイズハンドルの画面上の一辺（px）。表示倍率に関わらず一定サイズに見せる。 */
const HANDLE_SCREEN_SIZE = 12;

/*
 * 切り取り枠のリサイズハンドル定義。四隅と四辺の計 8 個。
 *   - fx / fy: 枠内での位置（0=左/上, 0.5=中央, 1=右/下）。
 *   - hx: 横方向にどの辺を動かすか（'w'=左辺, 'e'=右辺, null=横は固定）。
 *   - vy: 縦方向にどの辺を動かすか（'n'=上辺, 's'=下辺, null=縦は固定）。
 *   - cursor: ドラッグ方向を示すカーソル。
 */
const FRAME_HANDLES = [
  { key: 'nw', fx: 0, fy: 0, hx: 'w', vy: 'n', cursor: 'nwse-resize' },
  { key: 'n', fx: 0.5, fy: 0, hx: null, vy: 'n', cursor: 'ns-resize' },
  { key: 'ne', fx: 1, fy: 0, hx: 'e', vy: 'n', cursor: 'nesw-resize' },
  { key: 'e', fx: 1, fy: 0.5, hx: 'e', vy: null, cursor: 'ew-resize' },
  { key: 'se', fx: 1, fy: 1, hx: 'e', vy: 's', cursor: 'nwse-resize' },
  { key: 's', fx: 0.5, fy: 1, hx: null, vy: 's', cursor: 'ns-resize' },
  { key: 'sw', fx: 0, fy: 1, hx: 'w', vy: 's', cursor: 'nesw-resize' },
  { key: 'w', fx: 0, fy: 0.5, hx: 'w', vy: null, cursor: 'ew-resize' },
];

/**
 * アップロードした画像を拡大・縮小・移動して閲覧し、切り取り枠を重ねる表示領域。
 *
 * ここでの拡大縮小は「表示（ビュー）」の操作であり、画像そのものの解像度は
 * 変えない。内部は元画像と同じ実ピクセルサイズを持つステージ div を
 * `translate + scale` で変形して表示する：
 *   - マウスホイール: カーソル位置を中心にビューを拡大／縮小する。
 *   - 背景ドラッグ: ビュー全体を平行移動（パン）する。
 *   - 枠ドラッグ: 切り取り枠を元画像ピクセル単位で移動する。
 *   - 枠の角・辺のハンドルドラッグ: 切り取り枠のサイズを変更し、新しいサイズを
 *     `onFrameSizeChange` で親へ通知する（ヘッダーの数値入力と同期する）。
 * 画像ファイルをこの領域へドラッグ＆ドロップしても読み込める（既定の
 * ブラウザ動作を抑止し、`onDropFile` で親へファイルを渡す）。
 * 切り取り枠のサイズ（`frameWidth` / `frameHeight`）は元画像ピクセルで親から
 * 与えられ、AI 生成スプライトのように間隔がバラバラな絵でも、枠を狙った位置へ
 * 動かして 1 コマずつ切り出せる。「この枠を切り取る」を押すと、表示倍率に
 * 関係なく枠が覆う元画像の実ピクセル領域を `cropRegion` で切り出し、`onCrop`
 * で親へ渡す。
 *
 * Args:
 *     props (object): React プロパティ。
 *         image (HTMLImageElement|null): 表示・切り出し対象の画像。未選択時は null。
 *         frameWidth (number): 切り取り枠の幅（元画像ピクセル）。
 *         frameHeight (number): 切り取り枠の高さ（元画像ピクセル）。
 *         onCrop (function): 切り取り実行時に `(dataUrl, width, height)` で呼ぶ関数。
 *         onDropFile (function): 画像ファイルがドロップされたとき、その File を
 *             渡して呼ぶ関数。
 *         onFrameSizeChange (function): リサイズハンドル操作で枠サイズが変わった
 *             とき、`(width, height)` を渡して呼ぶ関数。
 *
 * Returns:
 *     JSX.Element: 表示領域全体を表す要素。
 */
function ImageStage({
  image,
  frameWidth,
  frameHeight,
  onCrop,
  onDropFile,
  onFrameSizeChange,
}) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [box, setBox] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);

  /*
   * ネイティブの wheel リスナーやポインタ移動中の計算から最新値を参照する
   * ために、state を ref へ同期させる（クロージャの値が古くならないように）。
   * レンダー中に ref を書くと警告になるため、commit 後の layout effect で
   * 反映する（イベントハンドラが読むのはレンダー確定後なので問題ない）。
   */
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const boxRef = useRef(box);
  const frameRef = useRef({ w: frameWidth, h: frameHeight });
  useLayoutEffect(() => {
    scaleRef.current = scale;
    offsetRef.current = offset;
    boxRef.current = box;
    frameRef.current = { w: frameWidth, h: frameHeight };
  }, [scale, offset, box, frameWidth, frameHeight]);

  const drag = useRef(null);

  /*
   * 画像が差し替わったら、表示領域に収まる倍率へフィットさせ、枠を画像中央に
   * 置き直す。枠サイズ（frameWidth/Height）変更時に再センタリングすると操作中
   * の位置が飛んでしまうため、依存は image のみに限定する。
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!image || !container) {
      return;
    }
    const fitScale = Math.min(
      container.clientWidth / image.naturalWidth,
      container.clientHeight / image.naturalHeight,
    );
    const nextScale = fitScale > 0 ? fitScale : 1;
    setScale(nextScale);
    setOffset({
      x: (container.clientWidth - image.naturalWidth * nextScale) / 2,
      y: (container.clientHeight - image.naturalHeight * nextScale) / 2,
    });
    setBox({
      x: Math.max(0, Math.round((image.naturalWidth - frameWidth) / 2)),
      y: Math.max(0, Math.round((image.naturalHeight - frameHeight) / 2)),
    });
    // frameWidth/Height はフィット時の初期配置だけに使う（再センタリング抑止）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  /*
   * ホイールでのズーム。React の onWheel は passive 扱いで preventDefault でき
   * ないことがあるため、{ passive: false } のネイティブリスナーで登録する。
   * カーソル下の画像座標が固定されるよう offset を補正する。
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const handleWheel = (event) => {
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const currentScale = scaleRef.current;
      const currentOffset = offsetRef.current;
      const clampedDelta = Math.max(
        -MAX_WHEEL_DELTA,
        Math.min(MAX_WHEEL_DELTA, event.deltaY),
      );
      const factor = Math.exp(-clampedDelta * ZOOM_SENSITIVITY);
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, currentScale * factor),
      );
      const imageX = (pointerX - currentOffset.x) / currentScale;
      const imageY = (pointerY - currentOffset.y) / currentScale;
      setOffset({
        x: pointerX - imageX * nextScale,
        y: pointerY - imageY * nextScale,
      });
      setScale(nextScale);
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handlePointerDown = useCallback((event, mode, handle = null) => {
    const container = containerRef.current;
    if (container) {
      container.setPointerCapture(event.pointerId);
    }
    drag.current = {
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      offset: offsetRef.current,
      box: boxRef.current,
      frame: frameRef.current,
    };
  }, []);

  const handlePointerMove = useCallback(
    (event) => {
      if (!drag.current) {
        return;
      }
      const dx = event.clientX - drag.current.startX;
      const dy = event.clientY - drag.current.startY;
      const s = scaleRef.current;
      if (drag.current.mode === 'pan') {
        setOffset({
          x: drag.current.offset.x + dx,
          y: drag.current.offset.y + dy,
        });
      } else if (drag.current.mode === 'resize') {
        // ハンドルが受け持つ辺だけを動かす。左辺・上辺を動かすときは、反対側の
        // 辺（右端・下端）を固定したまま位置とサイズを同時に更新する。
        const { handle, box: startBox, frame } = drag.current;
        const dxImg = dx / s;
        const dyImg = dy / s;
        let x = startBox.x;
        let y = startBox.y;
        let w = frame.w;
        let h = frame.h;
        if (handle.hx === 'e') {
          w = Math.max(MIN_FRAME_SIZE, frame.w + dxImg);
        } else if (handle.hx === 'w') {
          const right = startBox.x + frame.w;
          w = Math.max(MIN_FRAME_SIZE, frame.w - dxImg);
          x = right - w;
        }
        if (handle.vy === 's') {
          h = Math.max(MIN_FRAME_SIZE, frame.h + dyImg);
        } else if (handle.vy === 'n') {
          const bottom = startBox.y + frame.h;
          h = Math.max(MIN_FRAME_SIZE, frame.h - dyImg);
          y = bottom - h;
        }
        setBox({ x: Math.round(x), y: Math.round(y) });
        onFrameSizeChange(Math.round(w), Math.round(h));
      } else {
        setBox({
          x: Math.round(drag.current.box.x + dx / s),
          y: Math.round(drag.current.box.y + dy / s),
        });
      }
    },
    [onFrameSizeChange],
  );

  const handlePointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  const handleDragOver = useCallback((event) => {
    // ブラウザ既定の「ファイルを開く」動作を止めないとドロップで画面遷移して
    // しまうため、dragover と drop の両方で preventDefault する。
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setIsDragOver(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        onDropFile(file);
      }
    },
    [onDropFile],
  );

  const handleCropClick = useCallback(() => {
    if (!image) {
      return;
    }
    const x = Math.round(boxRef.current.x);
    const y = Math.round(boxRef.current.y);
    const width = Math.round(frameWidth);
    const height = Math.round(frameHeight);
    const dataUrl = cropRegion(image, x, y, width, height);
    onCrop(dataUrl, width, height);
  }, [image, frameWidth, frameHeight, onCrop]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.hint}>
        ホイール: 拡大・縮小 / 背景ドラッグ: 移動 / 赤い枠ドラッグ: 位置調整 /
        枠の角・辺ドラッグ: サイズ変更
      </div>
      <div
        ref={containerRef}
        className={`${styles.viewport} ${isDragOver ? styles.dragOver : ''}`}
        onPointerDown={(event) => image && handlePointerDown(event, 'pan')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {image ? (
          <div
            className={styles.stage}
            style={{
              width: `${image.naturalWidth}px`,
              height: `${image.naturalHeight}px`,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            }}
          >
            <img
              src={image.src}
              alt=""
              className={styles.image}
              draggable={false}
            />
            <div
              className={styles.frameBox}
              style={{
                left: `${box.x}px`,
                top: `${box.y}px`,
                width: `${frameWidth}px`,
                height: `${frameHeight}px`,
                borderWidth: `${Math.max(1, 2 / scale)}px`,
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                handlePointerDown(event, 'box');
              }}
            >
              {FRAME_HANDLES.map((handle) => {
                const sizeImg = HANDLE_SCREEN_SIZE / scale;
                return (
                  <div
                    key={handle.key}
                    className={styles.resizeHandle}
                    style={{
                      left: `${handle.fx * frameWidth - sizeImg / 2}px`,
                      top: `${handle.fy * frameHeight - sizeImg / 2}px`,
                      width: `${sizeImg}px`,
                      height: `${sizeImg}px`,
                      borderWidth: `${Math.max(0.5, 1.5 / scale)}px`,
                      cursor: handle.cursor,
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      handlePointerDown(event, 'resize', handle);
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className={styles.placeholder}>
            画像をここにドラッグ＆ドロップ、または上の「画像をアップロード」から選択
          </div>
        )}
      </div>
      <div className={styles.actions}>
        <span className={styles.coords}>
          X:{Math.round(box.x)} Y:{Math.round(box.y)} / W:{frameWidth} H:
          {frameHeight} / 表示倍率:{scale.toFixed(2)}x
        </span>
        <button
          type="button"
          className={styles.cropButton}
          onClick={handleCropClick}
          disabled={!image}
        >
          この枠を切り取る
        </button>
      </div>
    </div>
  );
}

export default ImageStage;
