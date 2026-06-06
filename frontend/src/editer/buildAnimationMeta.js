/**
 * enemies.json に貼り付け可能なアニメーション設定オブジェクトを作る。
 *
 * フレーム数とプレビューで選んだ FPS から、`enemies.json` の `animations`
 * 配下が要求する `frameCount` / `frameDurationMs` / `loop` を組み立てる。
 * 1 フレームの表示時間はミリ秒に変換して四捨五入する。待機（idle）は
 * ループ再生、やられ（dead）は最後で止めるため、`loop` は `idle` のときのみ
 * true にする。
 *
 * Args:
 *     frameCount (number): フレーム枚数。
 *     fps (number): 1 秒あたりのコマ数。
 *     state (string): 状態（`idle` または `dead`）。
 *
 * Returns:
 *     {frameCount: number, frameDurationMs: number, loop: boolean}:
 *         アニメーション設定オブジェクト。
 */
export default function buildAnimationMeta(frameCount, fps, state) {
  return {
    frameCount,
    frameDurationMs: Math.round(1000 / fps),
    loop: state === 'idle',
  };
}
