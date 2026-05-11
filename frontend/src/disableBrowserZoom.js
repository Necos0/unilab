/**
 * ブラウザの拡大縮小（ズーム）操作を抑制するためのグローバルリスナーを
 * `window` に登録する。
 *
 * 近年のモバイルブラウザは accessibility 配慮から `<meta viewport>` の
 * `user-scalable=no` を無視する場合があるため、JS 側でも防御する。本関数は
 * 以下 4 経路の拡大縮小トリガーを `preventDefault` で抑止する：
 *   - ピンチジェスチャー（iOS Safari の `gesturestart` / `gesturechange` /
 *     `gestureend`）
 *   - Ctrl / Cmd + マウスホイール（デスクトップブラウザのズーム）
 *   - Ctrl / Cmd + キーボードショートカット（`+` / `-` / `=` / `0`）
 *   - マルチタッチ pinch（`touchmove` で 2 本指以上のとき）
 *
 * `passive: false` を明示しているのは、Chrome の Intervention により
 * `wheel` / `touchmove` のデフォルトリスナーは `passive: true` に
 * 解釈されるため。`passive: true` だと `preventDefault()` が無視される。
 *
 * 単発呼び出し前提（`main.jsx` のエントリで 1 度だけ呼ぶ）。複数回呼び出
 * してもリスナーが重複登録されるだけで害は無いが、想定はしていない。
 *
 * Returns:
 *     undefined
 */
function disableBrowserZoom() {
  const preventDefault = (event) => event.preventDefault();

  window.addEventListener('gesturestart', preventDefault);
  window.addEventListener('gesturechange', preventDefault);
  window.addEventListener('gestureend', preventDefault);

  window.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  window.addEventListener('keydown', (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      ['+', '-', '=', '0'].includes(event.key)
    ) {
      event.preventDefault();
    }
  });

  window.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false },
  );
}

export default disableBrowserZoom;
