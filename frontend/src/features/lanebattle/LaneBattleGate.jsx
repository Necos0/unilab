import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useHiddenCommand from './hooks/useHiddenCommand';
import LaneBattleApp from './LaneBattleApp';
import './lanebattle.css';

const COMMAND = 'wqinouelabegg';

/**
 * ミニゲームの入口ゲート（要件1・15）。
 *
 * 本編アプリと同じ階層に 1 つだけマウントされる（`main.jsx` に
 * `<LaneBattleGate />` を 1 行足すのが共有コードへの唯一の変更）。未起動時は
 * 隠しコマンドの keydown リスナーを張るだけでほぼゼロコスト。`wqinouelabegg`
 * を検出したら、`createPortal` で `document.body` 直下に全画面オーバーレイと
 * して `LaneBattleApp` をマウントする。終了時はアンマウントし、起動前に
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
