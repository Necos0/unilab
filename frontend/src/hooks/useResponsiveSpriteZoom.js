import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * スプライトを表示枠に収めつつ、デザイン上の最大スケールを尊重する
 * 実効ズーム倍率を計算するフック。
 *
 * 敵スプライトは `enemies.json` の `scale` を `zoom` に渡して拡縮するが、
 * これは画面サイズに依存しない固定値のため、小さい画面ではスプライトが
 * 表示枠より縦に大きくなり、`overflow: hidden` の敵エリアでスプライト下に
 * 縦並びした HP バーが押し出されて見えなくなる不具合があった。
 *
 * 本フックは表示枠（`containerRef` を付けた要素）の実寸を `ResizeObserver`
 * で監視し、画像の原寸（`onImageLoad` で取得）と突き合わせて、枠に収まる
 * 最大倍率 `fit` を求める。返す `zoom` は `min(designScale, fit)`：
 * 大きい画面では `designScale`（敵同士の相対サイズ＝アートディレクション）
 * がそのまま効き、枠が狭い画面では `fit` 側が効いてスプライトが自動縮小
 * される。これにより HP バーが押し出されず常に表示される。`designScale`
 * を上限にしているため、枠が広くても原寸以上に拡大してドット絵がぼやける
 * ことはない。
 *
 * 枠サイズ・画像原寸のどちらかが未確定（マウント直後や画像ロード前）の
 * 間は `designScale` をそのまま返す。`ResizeObserver` と画像 `onload` は
 * 監視開始直後に発火するため、未確定状態で枠をはみ出して描画され続ける
 * ことはない。
 *
 * Args:
 *     designScale (number): デザイン上の最大スケール（`enemies.json` の
 *         `scale`、省略時 1）。実効ズームの上限になる。
 *
 * Returns:
 *     object: 次のプロパティを持つオブジェクト。
 *         containerRef (React.RefObject): 表示枠要素に付ける ref。この要素の
 *             `clientWidth`/`clientHeight` をフィット計算の基準にする。
 *         onImageLoad (function): スプライト `<img>` の `onLoad` に渡す
 *             ハンドラ。画像の `naturalWidth`/`naturalHeight` を取り込む。
 *         zoom (number): `<img>` の `zoom` に渡す実効ズーム倍率。
 */
export function useResponsiveSpriteZoom(designScale) {
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

  let zoom = designScale;
  if (
    containerSize &&
    naturalSize &&
    naturalSize.width > 0 &&
    naturalSize.height > 0 &&
    containerSize.width > 0 &&
    containerSize.height > 0
  ) {
    const fit = Math.min(
      containerSize.width / naturalSize.width,
      containerSize.height / naturalSize.height,
    );
    zoom = Math.min(designScale, fit);
  }

  return { containerRef, onImageLoad, zoom };
}
