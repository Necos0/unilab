import styles from './BackToMapButton.module.css';

/**
 * バトル画面の右上にオーバーレイ表示するデバッグ用「戻る」ボタン。
 *
 * クリックでマップ画面（`MapScreen`）への遷移をトリガーする。本ボタン
 * 自体は遷移ロジックを持たず、`onClick` props として受けたハンドラを
 * 呼ぶだけで、実際の画面切替は `App.jsx` 側の `screen` 状態管理が担う。
 * 本実装はテスト用途のため、戦闘の進行状況や勝敗には関係なく即座に
 * マップ画面へ戻る。
 *
 * 配置は CSS の `position: absolute` でバトル画面の右上に重ねる。
 * フローチャート領域内の `flowchartControls` とは別レイヤ（`.root`
 * 基準）になるため、Y 座標的にも重ならない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onClick (function): ボタンクリック時に呼び出すハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: ボタン要素。
 */
function BackToMapButton({ onClick }) {
  return (
    <button type="button" className={styles.button} onClick={onClick}>
      ← マップへ戻る
    </button>
  );
}

export default BackToMapButton;
