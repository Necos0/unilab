import { useState, useEffect, useRef } from 'react';
import styles from './BattleDemoButton.module.css';

/**
 * マップ画面の右上にオーバーレイ表示するデバッグ用ドロップダウンボタン。
 *
 * クリックでドロップダウンが開閉し、表示された `demoStageIds` の中から 1 つを
 * 選ぶと `onSelectStage(id)` が呼ばれて戦闘デモ画面（`BattleScreen`）への遷移
 * がトリガーされる。本コンポーネント自体は画面遷移ロジックを持たず、選択値の
 * バブルアップだけを担う。実際の画面切替は `App.jsx` の `screen` / `stageId`
 * 状態管理が担う（一方通行：戦闘 → マップは別ルート）。
 *
 * 開閉状態 `isOpen` はローカル `useState` で管理し、親に通知する必要のない
 * UI 内部ステートとして扱う。ドロップダウンが開いている間だけ `document` に
 * `mousedown` リスナーを登録し、コンテナ要素（`containerRef`）の外側で押下が
 * 発生したらドロップダウンを閉じる。`click` ではなく `mousedown` を使う理由は、
 * ドラッグ操作（外から内へマウスを動かしてからボタンを離す）でも閉じるよう
 * にするため。リスナーは `useEffect` の cleanup で確実に解除し、開閉切替時の
 * 多重登録を防ぐ。
 *
 * 配置は CSS の `position: absolute` を **コンテナ `.container`** に置き、
 * ドロップダウン `.dropdown` はそのコンテナ基点で `top: 100%; right: 0;` の
 * 真下右寄せ位置に展開される。ボタン/メニュー項目とも `rgba(...)` 半透明背景
 * で、SVG マップを覆い隠さない控えめなデバッグ UI 表現を維持する。
 *
 * 各メニュー項目は `<button>` で `<li>` 内にラップし、リスト構造のセマンティクス
 * を保ちつつクリック可能にする。`role="menu"` まで明示しない簡素な実装に
 * とどめている（開発用 UI のため）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         demoStageIds (Array<string>): ドロップダウンに表示するステージ ID
 *             配列。`stagesLoader.js` 経由で `stages.json` の `demoStageIds`
 *             から流れてくる。表示順は配列順そのまま。
 *         onSelectStage (function): メニュー項目クリック時に選択された
 *             ステージ ID を引数として呼び出されるハンドラ（`(id) => void`）。
 *             `App.jsx` の `handleStartBattle` に繋がる。
 *
 * Returns:
 *     JSX.Element: ボタン + ドロップダウンをまとめたラッパー要素。
 */
function BattleDemoButton({ demoStageIds, onSelectStage }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (id) => {
    setIsOpen(false);
    onSelectStage(id);
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        バトルデモ {isOpen ? '▲' : '▼'}
      </button>
      {isOpen && (
        <ul className={styles.dropdown}>
          {demoStageIds.map((id) => (
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

export default BattleDemoButton;