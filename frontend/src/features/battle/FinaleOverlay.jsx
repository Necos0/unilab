import styles from './FinaleOverlay.module.css';

/**
 * 最終ボス（第二形態）撃破後の「画面が白く光る」フィナーレ用オーバーレイ。
 *
 * `battleStore.victoryPhase === 'cleared'` かつ第二形態
 * （`battleStore.isSecondPhase`）のとき、親（`BattleScreen`）が通常の
 * `VictoryClearOverlay` の代わりにマウントする。画面全体が白い光で
 * ゆっくり満たされ、白くなり切った後に「つづく」テキストと
 * 「つぎへ」ボタンがフェードインする。
 *
 * ボタンを押すと `onExitToMap` → `App.handleClearedExitToMap` と伝わり、
 * ラスボス（4-4）ではクリア記録のあとマップではなくエンディング紙芝居
 * （`App.jsx` の `screen === 'ending'`）へ遷移する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onExitToMap (function): 「つぎへ」クリック時に呼び出す
 *             ハンドラ。引数なし。`BattleScreen.handleClearedExitToMap`
 *             経由でクリア記録＋画面遷移が行われる。
 *
 * Returns:
 *     JSX.Element: 画面全体を覆うフィナーレ演出オーバーレイ要素。
 */
function FinaleOverlay({ onExitToMap }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <p className={styles.finaleText}>つづく</p>
        <button type="button" className={styles.button} onClick={onExitToMap}>
          つぎへ ▶
        </button>
      </div>
    </div>
  );
}

export default FinaleOverlay;
