import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * スプライトを表示枠いっぱい（枠に収まる最大サイズ）に拡縮するための
 * ズーム倍率を計算するフック。
 *
 * 表示枠（`containerRef` を付けた要素）の実寸を `ResizeObserver` で監視し、
 * 画像の原寸（`onImageLoad` で取得）と突き合わせて、枠に収まる最大倍率を
 * 求めて返す。これにより、敵ごとの固定スケール値を持たなくても、どの画面
 * サイズでもスプライトが表示枠に常に収まり（HP バーが押し出されず）、かつ
 * 枠いっぱいの最大サイズで表示される。
 *
 * 枠サイズ・画像原寸のどちらかが未確定（マウント直後や画像ロード前）の
 * 間は 1 を返す。画像はロード前に描画されないため、未確定状態で枠を
 * はみ出して見えることはない。
 *
 * Returns:
 *     object: 次のプロパティを持つオブジェクト。
 *         containerRef (React.RefObject): 表示枠要素に付ける ref。この要素の
 *             `clientWidth`/`clientHeight` をフィット計算の基準にする。
 *         onImageLoad (function): スプライト `<img>` の `onLoad` に渡す
 *             ハンドラ。画像の `naturalWidth`/`naturalHeight` を取り込む。
 *         zoom (number): `<img>` の `zoom` に渡すズーム倍率（枠に収まる最大値）。
 */
export function useResponsiveSpriteZoom() {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState(null);
  const [naturalSize, setNaturalSize] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return undefined;
    }
    const update = () => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onImageLoad = useCallback((event) => {
    const img = event.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  let zoom = 1;
  if (
    containerSize &&
    naturalSize &&
    naturalSize.width > 0 &&
    naturalSize.height > 0 &&
    containerSize.width > 0 &&
    containerSize.height > 0
  ) {
    zoom = Math.min(
      containerSize.width / naturalSize.width,
      containerSize.height / naturalSize.height,
    );
  }

  return { containerRef, onImageLoad, zoom };
}
