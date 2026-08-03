/**
 * 対戦結果のオーバーレイ（要件11・12・13）。
 *
 * 勝敗・今回スコア・自己ベスト・自己ベスト更新の有無を表示し、「もう一度」
 * 「編成しなおす」「もどる」を提供する。
 *
 * Args:
 *     props (object):
 *         result (object): `{ win, score, kills, isNewBest }`。
 *         best (number): 現在の自己ベスト。
 *         onRematch (function): 同じデッキで再戦する。
 *         onRebuild (function): 編成画面へ戻る。
 *         onExit (function): ミニゲームを終了して元の画面へ戻る。
 *
 * Returns:
 *     JSX.Element: 結果オーバーレイ。
 */
export default function ResultOverlay({ result, best, onRematch, onRebuild, onExit }) {
  return (
    <div className="lb-result">
      <div className="lb-result-card">
        <div className={`lb-verdict ${result.win ? 'win' : 'lose'}`}>
          {result.win ? 'かち！' : 'まけ…'}
        </div>
        <div className="lb-result-score">
          スコア <b>{result.score}</b>
        </div>
        {result.win && (
          <div className="lb-result-sub">
            {result.timeSec.toFixed(1)}びょう ・ つかった エナジー {result.energyUsed}
          </div>
        )}
        <div className="lb-result-best">
          {result.isNewBest ? '🎉 ハイスコア こうしん！' : `ハイスコア ${best}`}
        </div>
        <div className="lb-result-btns">
          <button type="button" className="lb-btn primary" onClick={onRematch}>
            もう いちど
          </button>
          <button type="button" className="lb-btn" onClick={onRebuild}>
            デッキを かえる
          </button>
          <button type="button" className="lb-btn" onClick={onExit}>
            もどる
          </button>
        </div>
      </div>
    </div>
  );
}
