/**
 * 盤面からランダムなマスを 1 つ選ぶ純関数。
 *
 * 「ざひょうたからさがし」の出題に使う。直前の出題マスを `exclude` に渡すと
 * 同じマスの連続出題を避ける(2 回続けて同じ座標だと、正解したのに出題が
 * 変わっていないように見えてしまうため)。
 *
 * Args:
 *     cols (number): よこのマス数。x は 0 〜 cols-1 の範囲で選ばれる。
 *     rows (number): たてのマス数。y は 0 〜 rows-1 の範囲で選ばれる。
 *     exclude ({x: number, y: number} | null): 選択から除外するマス。
 *         null なら除外なし。
 *
 * Returns:
 *     {x: number, y: number}: 選ばれたマスの座標(左下が (0, 0)、たては上向き)。
 */
function pickRandomCell(cols, rows, exclude) {
  while (true) {
    const cell = {
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows),
    };
    if (!exclude || cell.x !== exclude.x || cell.y !== exclude.y) {
      return cell;
    }
  }
}

export default pickRandomCell;
