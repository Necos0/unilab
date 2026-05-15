const OPPOSITE = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/**
 * 方向文字列を反対方向に反転する。
 *
 * `maps.json` の各エッジは `direction` を `from → to` の進行方向で
 * 持つため、`to → from` の向き（逆走）で歩くときは符号を反転して
 * スプライトの向きを切り替える必要がある。本関数は up↔down、
 * left↔right の対称マップを保持する純関数で、未知の値を渡された
 * 場合は元の値をそのまま返す（呼び出し側で defensive にラップしなくて
 * 済むようにするため）。
 *
 * Args:
 *     direction (string): 反転前の方向文字列。
 *
 * Returns:
 *     string: 反転後の方向文字列。未知の入力はそのまま返す。
 */
export function reverseDirection(direction) {
  return OPPOSITE[direction] ?? direction;
}
