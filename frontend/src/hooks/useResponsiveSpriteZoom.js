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
 * **重要な前提：表示枠（`containerRef` を付ける要素）はクロス軸方向に
 * `align-self: stretch` 等で「親の全幅」が保証されていなければならない**
 * （`EnemySprite.module.css` の `.root` 参照）。これは `<img>` に適用する
 * `zoom` CSS プロパティがレイアウト占有ボックスごと拡縮する性質に由来する：
 *   1. 親に `align-items: center`、表示枠に明示的な width がないと、表示枠の幅は
 *      img のコンテンツ幅（natural × zoom）で決まる。
 *   2. フローチャート拡大→縮小の CSS トランジション中、`.enemyArea` の height が
 *      一瞬 0 → 中間値 → 元の値と推移する。中間値が img の `naturalHeight` を
 *      下回る瞬間に zoom が 1 未満になる。
 *   3. zoom 縮小で img が縮む → 表示枠も縮む → 次の ResizeObserver で
 *      `containerSize.width` も縮小 → zoom がさらに縮小、というフィードバック
 *      ループが起動し、敵スプライトが極小（数 px）まで縮んで戻らなくなる。
 * `align-self: stretch` で表示枠の幅をコンテンツ非依存にすることで、この負の
 * フィードバックループの起動を根本的に防ぐ。本フックは `clientWidth`/`clientHeight`
 * を見るだけで連鎖検知は行わないため、呼び出し側 CSS の前提が崩れると挙動が
 * 壊れる。詳細は `EnemySprite.module.css` の `.root` のコメントと README の
 * 「開発者向けノート」を参照。
 *
 * Returns:
 *     object: 次のプロパティを持つオブジェクト。
 *         containerRef (React.RefObject): 表示枠要素に付ける ref。この要素の
 *             `clientWidth`/`clientHeight` をフィット計算の基準にする。**親 flex
 *             コンテナのクロス軸に依存しない幅（`align-self: stretch` 等）が必須**。
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
