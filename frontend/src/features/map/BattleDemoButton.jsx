import styles from './BattleDemoButton.module.css';

/**
 * マップ画面の右上にオーバーレイ表示するデバッグ用ボタン。
 *
 * クリックで戦闘デモ画面（`BattleScreen`）への遷移をトリガーする。本ボタン
 * 自体は遷移ロジックを持たず、`onClick` props として受けたハンドラを呼ぶ
 * だけ。実際の画面切替は `App.jsx` 側の `screen` 状態管理が担う（一方通行：
 * 戻るボタンは設けない）。
 *
 * 配置は CSS の `position: absolute` で SVG マップ上に半透明で重ねる。背景に
 * `rgba(...)` を使うことで「画面の絵を覆い隠さず、デバッグ UI として控えめに
 * 主張する」見た目を実現している。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onClick (function): ボタンクリック時に呼び出すハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: ボタン要素。
 */
function BattleDemoButton({ onClick }) {
    return (
        <button
            type="button"
            className={styles.button}
            onClick={onClick}
        >
            バトルデモ
        </button>
    );
}

export default BattleDemoButton;