import { useEffect, useRef } from 'react';

const KEY_PATTERN = /^[a-z0-9-]$/;

/**
 * 隠しコマンド文字列の打鍵を検出して発火するフック（要件1・15）。
 *
 * 本編の `useDebugCommands` と同じ打鍵検出・ガード方針を、ミニゲーム側で
 * 自前に再現したもの（共有フックへ依存せず隔離するため）。`window` の
 * keydown を capture で監視し、直近の打鍵バッファ末尾が `word` に一致した
 * 瞬間に `onFire` を呼ぶ。入力欄（input / textarea / contentEditable）への
 * フォーカス中と、修飾キー（Ctrl / Cmd / Alt）同時押し・リピート入力は
 * 無視する。コマンド文字（英小文字・数字・ハイフン）以外を挟むとバッファ
 * をリセットする。
 *
 * Args:
 *     word (string): 検出したいコマンド文字列。例: `"wqinouelabegg"`。
 *     onFire (function): 一致時に呼ぶコールバック（引数なし）。
 *
 * Returns:
 *     void
 */
export default function useHiddenCommand(word, onFire) {
  const fireRef = useRef(onFire);
  const bufferRef = useRef('');

  useEffect(() => {
    fireRef.current = onFire;
  }, [onFire]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
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
      if (!KEY_PATTERN.test(key)) {
        bufferRef.current = '';
        return;
      }
      const buffer = (bufferRef.current + key).slice(-word.length);
      bufferRef.current = buffer;
      if (buffer === word) {
        bufferRef.current = '';
        fireRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [word]);
}
