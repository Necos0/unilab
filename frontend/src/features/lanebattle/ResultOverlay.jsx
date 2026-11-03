/**
 * 対戦結果のオーバーレイ（要件3・11・12・13）。
 *
 * クリア可否・今回スコア・自己ベスト・ベスト更新の有無を表示する。クリア時は
 * 「◯秒・使ったエナジー」を、未クリア（時間切れ／自本陣陥落）時は「相手に
 * 与えたダメージ」を補足行に出す（クリアできなくても削った分が見える）。
 * 操作は「もう いちど」が常設、「デッキを かえる」「もどる」は対応する
 * ハンドラが渡されたときだけ出す（プレビュー単体では戻り先が無いため省ける）。
 *
 * Args:
 *     props (object):
 *         result (object): `{ win, score, timeSec, energyUsed, damage, isNewBest }`。
 *         best (number): 現在の自己ベスト。
 *         onRematch (function): 同じデッキで再戦する。
 *         onRebuild (function): 編成画面へ戻る（任意）。
 *         onExit (function): ミニゲームを終了して元の画面へ戻る（任意）。
 *
 * Returns:
 *     JSX.Element: 結果オーバーレイ。
 */
export default function ResultOverlay({ result, best, onRematch, onRebuild, onExit }) {
  return (
    <div className="lb-result">
      <div className="lb-result-card">
        <div className={`lb-verdict ${result.win ? 'win' : 'lose'}`}>
          {result.win ? 'クリア！' : 'クリアならず…'}
        </div>
        <div className="lb-result-score">
          スコア <b>{result.score}</b>
        </div>
        <div className="lb-result-sub">
          {result.win
            ? `${result.timeSec.toFixed(1)}びょう ・ つかった エナジー ${result.energyUsed}`
            : `あいてに あたえた ダメージ ${result.damage}`}
        </div>
        <div className="lb-result-best">
          {result.isNewBest ? '🎉 ハイスコア こうしん！' : `ハイスコア ${best}`}
        </div>
        <div className="lb-result-btns">
          <button type="button" className="lb-btn primary" onClick={onRematch}>
            もう いちど
          </button>
          {onRebuild && (
            <button type="button" className="lb-btn" onClick={onRebuild}>
              デッキを かえる
            </button>
          )}
          {onExit && (
            <button type="button" className="lb-btn" onClick={onExit}>
              もどる
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
