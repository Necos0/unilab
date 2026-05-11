import styles from './BattleFailOverlay.module.css';

/**
 * 失敗演出時に敵エリアへ重ねて表示するオーバーレイ。
 *
 * `battleStore.failPhase === 'shown'` のとき親（`BattleScreen`）が条件付きで
 * マウントする。レイアウトは `VictoryClearOverlay` と対称な縦 2 分割で、
 * 上半分に「Fail」テキスト、下半分にボタン行（左：マップへ戻る／右：やり直す）
 * を配置する。Fail テキストは `'Press Start 2P'` のドット絵風フォントを
 * `victory-clear` 仕様の CLEAR! と共通化しつつ、色を赤系（`#ff5a5a`）に
 * 変えて「失敗」を視覚的に伝える（`battle-fail-retry` 要件 3-1, 3-2）。
 *
 * Fail テキストは `<div class="failText"><span class="failTextInner">` の
 * 入れ子構造にする。これは Press Start 2P フォント特有の問題（末尾の `l`
 * グリフが advance box 内で左寄りに描画され、CSS レイアウト上は中央なのに
 * 視覚的には左寄りに見える）の補正のため。`failTextInner` に
 * `padding-left: 0.4em` を当てることで glyph の見た目重心を box 中央に
 * 寄せる。フォントサイズ相対（em 単位）にすることで `clamp` で変動する
 * font-size にも追従する（`VictoryClearOverlay` の CLEAR! と同じ補正テク）。
 *
 * 戦闘画面ルートには Fail 演出中に `.root.failed` クラスが付与され
 * `pointer-events: none` で全体がクリック不能になる。本オーバーレイは
 * `.overlay` に `pointer-events: auto` を再付与することで、Fail 中も
 * 唯一クリック可能な領域として 2 つのボタンを成立させる
 * （`battle-fail-retry` 要件 2-7, 7-4）。`z-index: 15` は `DamageFloater` より
 * 上、通常時の右上 `BackToMapButton`（z-index: 20）より下に置くが、Fail
 * 中は親が後者を unmount するので衝突は起きない。
 *
 * ボタンは左右 2 個を `display: flex; justify-content: center; gap: 1.5rem`
 * で中央寄せする。`justify-content: space-between` だと敵エリアの幅依存で
 * 端に寄りすぎるため、中央 + gap 方式で「左右に並ぶ 2 ボタン」を表現する。
 * ボタンの意匠は `VictoryClearOverlay` の `.button` と完全同一にし、勝利／
 * 失敗の対称性を強める（差は色とラベルだけ）。
 *
 * 「マップへ戻る」は親から渡される `onExitToMap` を呼び、既存の `App.jsx`
 * 画面切替ロジックへ橋渡しされる（要件 4-1）。「やり直す」は親から渡される
 * `onRetry` を呼び、`battleStore.retryFromFail()` 経由でカード配置を保った
 * まま A 状態へ戻す（要件 5-1〜5-6）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onExitToMap (function): 「マップへ戻る」クリック時に呼び出す
 *             ハンドラ。引数なし。
 *         onRetry (function): 「やり直す」クリック時に呼び出すハンドラ。
 *             引数なし。`BattleScreen` 側で `retryFromFail` を呼ぶラッパー
 *             として渡される。
 *
 * Returns:
 *     JSX.Element: 敵エリアに絶対配置される Fail オーバーレイ要素。
 */
function BattleFailOverlay({ onExitToMap, onRetry }) {
    return (
        <div className={styles.overlay}>
            <div className={styles.failText}>
                <span className={styles.failTextInner}>Fail</span>
            </div>
            <div className={styles.buttonRow}>
                <button
                    type="button"
                    className={styles.button}
                    onClick={onExitToMap}
                >
                    ← マップへ戻る
                </button>
                <button
                    type="button"
                    className={styles.button}
                    onClick={onRetry}
                >
                    やり直す
                </button>
            </div>
        </div>
    );
}

export default BattleFailOverlay;