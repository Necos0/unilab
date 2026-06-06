import { useState } from 'react';
import styles from './CharacterGallery.module.css';
import GalleryCharacterCard from './GalleryCharacterCard';
import enemiesData from '../data/enemies.json';

/*
 * 一覧で切り替えられるアニメーション状態。`enemies.json` の
 * `animations` キーおよびスプライトのディレクトリ名と一致させる。
 */
const VIEW_STATES = [
  { value: 'idle', label: '通常' },
  { value: 'dead', label: 'やられ' },
];

/**
 * 全キャラクターのアニメーションを一覧できる閲覧画面のルートコンポーネント。
 *
 * `enemies.json` の全エントリをグリッドに並べ、それぞれ `GalleryCharacterCard`
 * でアニメーションを再生表示する。ヘッダーの切り替えボタンで idle（通常）と
 * dead（やられ）を一括で切り替え、全カードが同じ状態を再生する。スプライトの
 * 差し替えや新キャラ追加の確認用ビューで、戦闘ステートには一切依存しない。
 * ヘッダーの「マップへ戻る」ボタン（`onExit`）でマップ画面へ戻る。本ツールは
 * 開発者向けのため、ゲーム内テキストのふりがな規則は適用しない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onExit (function): 「マップへ戻る」押下時に呼ぶ関数。引数なし。
 *
 * Returns:
 *     JSX.Element: キャラクター一覧画面全体を表す要素。
 */
function CharacterGallery({ onExit }) {
  const [viewState, setViewState] = useState('idle');

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.heading}>キャラクター一覧</h1>
        <div className={styles.stateToggle} role="group" aria-label="表示する状態">
          {VIEW_STATES.map((state) => (
            <button
              key={state.value}
              type="button"
              className={`${styles.stateButton} ${
                viewState === state.value ? styles.stateButtonActive : ''
              }`}
              aria-pressed={viewState === state.value}
              onClick={() => setViewState(state.value)}
            >
              {state.label}
            </button>
          ))}
        </div>
        <button type="button" className={styles.backButton} onClick={onExit}>
          マップへ戻る
        </button>
      </header>
      <div className={styles.grid}>
        {enemiesData.enemies.map((enemy) => (
          <GalleryCharacterCard key={enemy.id} enemy={enemy} state={viewState} />
        ))}
      </div>
    </div>
  );
}

export default CharacterGallery;
