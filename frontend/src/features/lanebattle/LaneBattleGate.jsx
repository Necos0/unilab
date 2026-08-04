import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useHiddenCommand from './hooks/useHiddenCommand';
import LaneBattleApp from './LaneBattleApp';
import './lanebattle.css';

const COMMAND = 'wqinouelabegg';

/**
 * 本編タイトル画面などから陣取り合戦を開くための DOM イベント名。
 *
 * 本編側は `window.dispatchEvent(new Event('lanebattle:open'))` を投げるだけで
 * よく、この feature の中身（コンポーネント・ストア）を一切 import しなくて
 * 済む。隔離（本編への変更を最小化する）を保ったまま、隠しコマンド以外の
 * 正規の入口（4-4＋エンドロール達成後のタイトルボタン）を追加できる。
 */
const OPEN_EVENT = 'lanebattle:open';

/**
 * ミニゲームの入口ゲート（要件1・15）。
 *
 * 本編アプリと同じ階層に 1 つだけマウントされる（`main.jsx` に
 * `<LaneBattleGate />` を 1 行足すのが共有コードへの唯一の変更）。未起動時は
 * 隠しコマンドの keydown リスナーと `lanebattle:open` イベントリスナーを張る
 * だけでほぼゼロコスト。`wqinouelabegg` の検出、または本編タイトルの
 * 「じんとりがっせん で あそぶ」ボタンが投げる `lanebattle:open` を受け取ると、
 * `createPortal` で `document.body` 直下に全画面オーバーレイとして
 * `LaneBattleApp` をマウントする。終了時はアンマウントし、起動前に
 * フォーカスしていた要素へ戻す。本編の画面遷移・ストア・隠しコマンド機構
 * には一切触れない。
 *
 * Returns:
 *     JSX.Element | null: 起動中はオーバーレイ、未起動時は null。
 */
export default function LaneBattleGate() {
  const [open, setOpen] = useState(false);
  const prevFocusRef = useRef(null);

  const openGame = useCallback(() => {
    prevFocusRef.current = document.activeElement;
    setOpen(true);
  }, []);

  const closeGame = useCallback(() => {
    setOpen(false);
    const prev = prevFocusRef.current;
    if (prev && typeof prev.focus === 'function') prev.focus();
  }, []);

  useHiddenCommand(COMMAND, openGame);

  // 本編タイトルなどからの `lanebattle:open` イベントでも開けるようにする。
  useEffect(() => {
    window.addEventListener(OPEN_EVENT, openGame);
    return () => window.removeEventListener(OPEN_EVENT, openGame);
  }, [openGame]);

  // 起動中は Esc でも閉じられるようにする（オーバーレイ最前面のみで効く）。
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeGame();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, closeGame]);

  if (!open) return null;

  return createPortal(
    <div className="lb-root" role="dialog" aria-label="陣取り合戦 ミニゲーム">
      <LaneBattleApp onClose={closeGame} />
    </div>,
    document.body,
  );
}
