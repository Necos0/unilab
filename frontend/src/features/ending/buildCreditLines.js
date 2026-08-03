import CREDITS_DATA from '../../data/ending_credits.json';
import stagesData from '../../data/stagesLoader.js';

/**
 * エンディングロールに流す全行のリストを組み立てる。
 *
 * 行データは `data/ending_credits.json` の `lines` にすべて静的に持ち、
 * プレイヤーごとに変わる値だけをテキスト中のプレースホルダで差し込む：
 *   - `{playerName}`   : プレイヤー名（未入力なら「きみ」）
 *   - `{clearedCount}` : クリアした本編ステージ数
 *   - `{stageTotal}`   : 本編ステージの総数（デモ用 5-1 は除く）
 *   - `{cardCount}`    : 出会ったカードの種類数
 *
 * 行数と縦位置（配列の順序）はどのプレイヤーでも変わらない。これは
 * コイン配置（`coins`）や配置エディタ（`CreditsEditorScreen`）で決めた
 * レイアウトが、進捗によってズレないようにするための設計。
 *
 * 各行は `{kind, x?, text?, sprite?}` で、`kind` は描画と当たり判定の
 * 両方を決める：
 *   - `tag`     : タグ行。金色・かたい足場
 *   - `text`    : 日本語の中身の行。白色・ふつうの足場
 *   - `comment` : `<!-- -->` 行。グレー・乗れない（すり抜け）
 *   - `blank`   : 空行。何も描画せず、縦の間隔だけ空ける
 * `x` は画面左端からの横位置（px）で、配置エディタで調整する。
 *
 * Args:
 *     progress (object): 進捗のスナップショット。
 *         playerName (string): プレイヤー名。
 *         clearedStageIds (Array<string>): クリア済みステージ ID。
 *         seenCardIds (Array<string>): 出会ったカード ID。
 *     sourceLines (Array<object>, optional): 置換元の行データ。省略時は
 *         `ending_credits.json` の `lines`。配置エディタのテストプレイが
 *         編集中の下書きを渡すために使う。
 *
 * Returns:
 *     Array<object>: 画面上から下（＝流れてくる順）に並んだ行オブジェクト
 *         の配列。プレースホルダは置換済み。
 */
function buildCreditLines(
  { playerName, clearedStageIds, seenCardIds },
  sourceLines = CREDITS_DATA.lines,
) {
  /* デモ用ステージ（5-1）は本編の分母に数えない。 */
  const mainStageIds = Object.keys(stagesData.stages).filter(
    (id) => !stagesData.demoStageIds.includes(id),
  );
  const clearedCount = mainStageIds.filter((id) =>
    clearedStageIds.includes(id),
  ).length;

  const replacements = {
    '{playerName}': playerName && playerName.length > 0 ? playerName : 'きみ',
    '{clearedCount}': String(clearedCount),
    '{stageTotal}': String(mainStageIds.length),
    '{cardCount}': String(seenCardIds.length),
  };

  return sourceLines.map((line) => {
    if (!line.text || !line.text.includes('{')) {
      return line;
    }
    let text = line.text;
    for (const [placeholder, value] of Object.entries(replacements)) {
      text = text.replaceAll(placeholder, value);
    }
    return { ...line, text };
  });
}

export default buildCreditLines;
