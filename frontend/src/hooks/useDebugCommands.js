import { useEffect, useRef } from 'react';

/* コマンドの一部として受け付ける 1 文字キー（英小文字・数字・ハイフン）。 */
const COMMAND_KEY_PATTERN = /^[a-z0-9-]$/;

/* 打鍵バッファの最大長。最長コマンド（wqgo1-1 = 7 文字）より十分大きい。 */
const BUFFER_MAX_LENGTH = 16;

/*
 * 到達レベル設定コマンド。`wqgo2-3` / `wqgo23` のように、`wqgo` に続けて
 * ワールド番号とステージ番号をタイプする（ハイフンは省略可）。
 */
const UNLOCK_COMMAND_PATTERN = /wqgo(\d)-?(\d)$/;

/* 固定文字列コマンドと、対応するハンドラ名の一覧。 */
const SIMPLE_COMMANDS = [
  ['wqreset', 'onReset'],
  ['wqtitle', 'onTitle'],
  ['wqflow', 'onCutsceneFlow'],
  ['wqend', 'onEnding'],
  ['wqedit', 'onCreditsEditor'],
  ['wqfull', 'onFullscreen'],
];

/**
 * 開発用の「隠しコマンド」を打鍵列から検出するカスタムフック。
 *
 * 以前は R / T / C / Space の単キーショートカットだったが、プレイヤーが
 * 偶然押して発動してしまうため、知っている人だけが使える文字列コマンドに
 * 置き換えたもの。`window` の keydown を監視して直近の打鍵をバッファに
 * 貯め、末尾が以下のコマンドに一致した瞬間に対応するハンドラを呼ぶ：
 *   - `wqreset`          : `onReset`（ゲーム状態の全リセット）
 *   - `wqtitle`          : `onTitle`（タイトル画面へ戻る）
 *   - `wqflow`           : `onCutsceneFlow`（カットシーン・フロー画面の開閉）
 *   - `wqend`            : `onEnding`（エンディング紙芝居の再生。演出確認用）
 *   - `wqedit`           : `onCreditsEditor`（エンディング配置エディタの開閉）
 *   - `wqfull`           : `onFullscreen`（ブラウザ全画面表示の切り替え）
 *   - `wqgo<w>-<n>`      : `onUnlock('<w>-<n>')`（到達レベルの一括設定。
 *                          `wqgo2-3` のほかハイフン省略の `wqgo23` も可）
 *
 * リスナーは capture フェーズで登録する。会話中（`RoboBubble`）や紙芝居中
 * （`StoryScreen`）は window の capture で `stopImmediatePropagation` により
 * キーを遮断するが、本フックは App マウント時（＝それらより先）に同じ
 * window へ登録されるため、遮断より前に打鍵を観測でき、会話・紙芝居の
 * 途中でもコマンドが効く。観測するだけで `preventDefault` はしないので、
 * 各画面のキー操作（紙芝居の送りなど）は妨げない。
 *
 * ガード方針は従来のショートカットと同じ：input / textarea / contentEditable
 * へのフォーカス中と、修飾キー（Ctrl / Cmd / Alt）同時押し・リピート入力は
 * 無視する。コマンド文字以外のキー（Enter・矢印など）を挟むとバッファを
 * リセットし、途切れた打鍵では発動しないようにする。
 *
 * Args:
 *     handlers (object): コマンド検出時に呼ぶハンドラ群。
 *         onReset (function): `wqreset` 検出時に呼ぶ（引数なし）。
 *         onTitle (function): `wqtitle` 検出時に呼ぶ（引数なし）。
 *         onCutsceneFlow (function): `wqflow` 検出時に呼ぶ（引数なし）。
 *         onEnding (function): `wqend` 検出時に呼ぶ（引数なし）。
 *         onCreditsEditor (function): `wqedit` 検出時に呼ぶ（引数なし）。
 *         onFullscreen (function): `wqfull` 検出時に呼ぶ（引数なし）。
 *         onUnlock (function): `wqgo〜` 検出時にステージ ID（例 `'2-3'`）を
 *             渡して呼ぶ。ID の実在チェックは呼び出し側で行う。
 *
 * Returns:
 *     void: 返り値なし。リスナーの登録・解除だけを担う。
 */
function useDebugCommands(handlers) {
  /*
   * ハンドラは ref 経由で常に最新を参照する。リスナー自体は空依存配列で
   * 一度だけ登録し、再登録で window のリスナー順が変わって会話中の遮断
   * （`stopImmediatePropagation`）より後ろに回ってしまうのを防ぐ。
   */
  const handlersRef = useRef(handlers);
  const bufferRef = useRef('');

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (!COMMAND_KEY_PATTERN.test(key)) {
        bufferRef.current = '';
        return;
      }
      const buffer = (bufferRef.current + key).slice(-BUFFER_MAX_LENGTH);
      bufferRef.current = buffer;
      for (const [word, handlerName] of SIMPLE_COMMANDS) {
        if (buffer.endsWith(word)) {
          bufferRef.current = '';
          handlersRef.current[handlerName]?.();
          return;
        }
      }
      const unlockMatch = buffer.match(UNLOCK_COMMAND_PATTERN);
      if (unlockMatch) {
        bufferRef.current = '';
        handlersRef.current.onUnlock?.(`${unlockMatch[1]}-${unlockMatch[2]}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);
}

export default useDebugCommands;
