import styles from './VictoryClearOverlay.module.css';

/**
 * 勝利演出時に敵エリアへ重ねて表示するオーバーレイ。
 *
 * `battleStore.victoryPhase === 'cleared'` のとき親（`BattleScreen`）が
 * 条件付きでマウントする。レイアウトは敵エリア（`.enemyArea`）に対する
 * `position: absolute; inset: 0` の縦 2 分割で、上半分に「CLEAR!」テキスト、
 * 下半分に「マップへ戻る」ボタンを配置する。CLEAR! テキストは `'Press
 * Start 2P'` のドット絵風フォントを HP バー数値（`.hpText`）と共通化した
 * うえで、3〜4 倍のサイズで強調表示する（`victory-clear` 要件 4-2）。
 *
 * CLEAR! テキストは `<div class="clearText"><span class="clearTextInner">`
 * の入れ子構造にし、外側 `clearText` を `width: 100%; justify-content: center`
 * で overlay 全幅の中央配置レーンとして使い、内側 `clearTextInner` で
 * テキスト本体を描画する。これは Press Start 2P フォント特有の問題
 * （`!` グリフが文字 advance box 内で左寄りに描画され、CSS レイアウト上は
 * 中央なのに視覚的には左寄りに見える）の補正のため。`clearTextInner` に
 * `padding-left: 0.5em` を当てることで、glyph の見た目重心を box 中央に
 * 寄せる。フォントサイズ相対（em 単位）にすることで、`clamp` で変動する
 * font-size にも追従する。
 *
 * 戦闘画面ルートには勝利演出中に `.root.victory` クラスが付与され
 * `pointer-events: none` で全体がクリック不能になる。本オーバーレイは
 * `.overlay` に `pointer-events: auto` を再付与することで、CLEAR! 中も
 * 唯一クリック可能な領域として「マップへ戻る」ボタンを成立させる
 * （`victory-clear` 要件 6）。`z-index: 15` は `DamageFloater` より上、
 * 通常時の右上 `BackToMapButton`（z-index: 20）より下に置くが、CLEAR!
 * 中は親が後者を unmount するので衝突は起きない。
 *
 * 「マップへ戻る」ボタンは右上版 `BackToMapButton` を再利用せず、本
 * コンポーネント内に独自スタイルで描画する。誘導したい主役（CLEAR!
 * 中）と右上のデバッグ用（通常時）でサイズ・トーンの設計目的が異なる
 * ため、コンポーネントを分けて関心を分離する。`onClick` 時の挙動は
 * 同じく親から渡される `onExitToMap` を呼ぶだけ。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onExitToMap (function): 「マップへ戻る」クリック時に呼び出す
 *             ハンドラ。引数なし。`BattleScreen` から `App.jsx` の画面
 *             切替ロジックへ橋渡しされる。
 *
 * Returns:
 *     JSX.Element: 敵エリアに絶対配置される CLEAR! オーバーレイ要素。
 */
function VictoryClearOverlay({ onExitToMap }) {
    return (
        <div className={styles.overlay}>
            <div className={styles.clearText}>
                <span className={styles.clearTextInner}>CLEAR!</span>
            </div>
            <div className={styles.buttonRow}>
                <button
                    type="button"
                    className={styles.button}
                    onClick={onExitToMap}
                >
                    ← マップへ戻る
                </button>
            </div>
        </div>
    );
}

export default VictoryClearOverlay;