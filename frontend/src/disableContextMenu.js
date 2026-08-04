/**
 * 右クリックメニュー（コンテキストメニュー）を抑制するためのグローバル
 * リスナーを `window` に登録する。
 *
 * ゲーム画面での誤操作防止が目的。右クリック・二本指タップ・長押し
 * （モバイルの `contextmenu` 発火）によるブラウザ標準メニューの表示を
 * `preventDefault` で抑止する。テキスト入力欄（`<input>` / `<textarea>`）
 * の上ではコピー・ペースト操作を妨げないよう抑止しない。
 *
 * 単発呼び出し前提（`main.jsx` のエントリで 1 度だけ呼ぶ）。複数回呼び出
 * してもリスナーが重複登録されるだけで害は無いが、想定はしていない。
 *
 * Returns:
 *     undefined
 */
function disableContextMenu() {
  window.addEventListener('contextmenu', (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    event.preventDefault();
  });
}

export default disableContextMenu;
