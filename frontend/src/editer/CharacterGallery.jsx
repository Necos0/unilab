import styles from './CharacterGallery.module.css';
import GalleryCharacterCard from './GalleryCharacterCard';
import enemiesData from '../data/enemies.json';

/**
 * 全キャラクターの idle 状態を一覧できる閲覧画面のルートコンポーネント。
 *
 * `enemies.json` の全エントリをグリッドに並べ、それぞれ `GalleryCharacterCard`
 * で idle アニメーションを再生表示する。スプライトの差し替えや新キャラ追加の
 * 確認用ビューで、戦闘ステートには一切依存しない。ヘッダーの「マップへ戻る」
 * ボタン（`onExit`）でマップ画面へ戻る。本ツールは開発者向けのため、ゲーム内
 * テキストのふりがな規則は適用しない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onExit (function): 「マップへ戻る」押下時に呼ぶ関数。引数なし。
 *
 * Returns:
 *     JSX.Element: キャラクター一覧画面全体を表す要素。
 */
function CharacterGallery({ onExit }) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.heading}>キャラクター一覧</h1>
        <button type="button" className={styles.backButton} onClick={onExit}>
          マップへ戻る
        </button>
      </header>
      <div className={styles.grid}>
        {enemiesData.enemies.map((enemy) => (
          <GalleryCharacterCard key={enemy.id} enemy={enemy} />
        ))}
      </div>
    </div>
  );
}

export default CharacterGallery;
