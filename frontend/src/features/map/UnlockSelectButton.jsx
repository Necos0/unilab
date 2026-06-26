import { useState, useEffect, useRef } from 'react';
import styles from './UnlockSelectButton.module.css';
import stagesData from '../../data/stages.json';
import useProgressStore from '../../stores/progressStore';
import useCutsceneStore from '../../stores/cutsceneStore';

/* ドロップダウンに並べるステージ ID。`stages.json` の定義順（1-1〜5-1）。 */
const STAGE_IDS = Object.keys(stagesData.stages);

/**
 * マップ画面にオーバーレイ表示する、開発用の「到達ステージ選択」ドロップダウン。
 *
 * 以前は Space キーで全ステージ・全カットシーンを一括解放していたが、これを
 * 「どこまで解放するか」を選べる UI に置き換える。ボタンクリック、または
 * **Space キー** でドロップダウンが開閉し（`BattleDemoButton` と同じ半透明
 * トーン）、一覧から 1 つステージを選ぶと「そのステージに到達した」状態に
 * 一括設定する：
 *   - `progressStore.setProgressUpToStage`：選んだステージより前を全クリア＆
 *     到達ワールドまで解放（選んだステージ自身は未クリアのまま）。
 *   - `cutsceneStore.markSeenBeforeStage`：そこまでに出るカットシーンを視聴済み
 *     にし、選んだステージ以降は未視聴のまま残す（テストで再生される）。
 *
 * 開閉状態 `isOpen` はローカル `useState` で持つ。Space キーのリスナーは
 * `window` に登録し、`input`/`textarea`/編集可能要素にフォーカス中と修飾キー
 * 同時押しは無視する（従来の Space ハンドラと同じガード方針）。ページスクロール
 * を防ぐため `preventDefault` する。開いている間だけ `document` に `mousedown`
 * リスナーを張り、コンテナ外の押下で閉じる（`BattleDemoButton` と同方式）。
 * すべてのリスナーは `useEffect` の cleanup で解除する。
 *
 * 本コンポーネントはマップ画面のデバッグ UI 群（`!isEditing` のとき）に置く。
 * マップ座標エディタ中はアンマウントされ、Space は何もしない。
 *
 * Returns:
 *     JSX.Element: ボタン + ドロップダウンをまとめたラッパー要素。
 */
function UnlockSelectButton() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code !== 'Space') {
        return;
      }
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
      event.preventDefault();
      setIsOpen((prev) => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (stageId) => {
    setIsOpen(false);
    useProgressStore.getState().setProgressUpToStage(stageId);
    useCutsceneStore.getState().markSeenBeforeStage(stageId);
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        解放レベル {isOpen ? '▲' : '▼'}
      </button>
      {isOpen && (
        <ul className={styles.dropdown}>
          <li className={styles.header}>ここまで到達済みにする</li>
          {STAGE_IDS.map((id) => (
            <li key={id}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => handleSelect(id)}
              >
                {id}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default UnlockSelectButton;
