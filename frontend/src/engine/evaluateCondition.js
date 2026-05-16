/**
 * フローチャートの条件分岐ノードで使う条件式評価関数。
 *
 * `stages.json` の `conditions[].expression` に書かれた文字列を受け取り、
 * 実行時の状態（HP、シールド、スロット配置など）を `context` 経由で参照
 * して `true` / `false` を返す。`eval` や `new Function` を使わず、正規表現
 * ベースのシンプルなパターンマッチで構文を限定的にサポートすることで、
 * 任意コード実行のリスクを排除している（map-2-stage-1 要件 2-4）。
 *
 * サポートする構文は以下の 2 パターン：
 *   - 変数比較: `<variable> <op> <literal>`（例: `playerHp > 50`、
 *     `reflectActive === true`）
 *   - スロット参照: `slot('<slot-id>') <op> <literal>`（例:
 *     `slot('slot-1') === 'attack'`、`slot('slot-3') === null`）
 *
 * 演算子は `>`、`<`、`>=`、`<=`、`===`、`!==` の 6 種類。リテラルは
 * 整数、文字列（シングル/ダブルクォート両対応）、`null`、`true`、`false`。
 * パターンにマッチしない式・未知の変数・解析不能なリテラルは
 * `console.warn` でログを残してデフォルトの `false` を返し、戦闘実行を
 * 落とさない（要件 2-3）。
 *
 * 将来 `&&` / `||` / 算術演算子などの拡張が必要になった時点で、トークナイザ
 * + 再帰下降パーサーへの置き換えを検討する。
 */

const SLOT_PATTERN = /^slot\(\s*(['"])([^'"]+)\1\s*\)\s*(===|!==)\s*(.+)$/;
const VAR_PATTERN = /^(\w+)\s*(>=|<=|===|!==|>|<)\s*(.+)$/;

/**
 * 条件式を評価して `true` / `false` を返す。
 *
 * 評価の流れ：
 *   1. `expression` が文字列でなければ `false` を返す（防御的なガード）。
 *   2. `SLOT_PATTERN` にマッチすれば `context.slot(slotId)` でカード id を
 *      取得し、リテラルと比較。
 *   3. `VAR_PATTERN` にマッチすれば `context.variables[varName]` から値を
 *      取得し、リテラルと比較。
 *   4. どちらにもマッチしなければ `console.warn` で警告して `false`。
 *
 * Args:
 *     expression (string): 評価する条件式。例: `"playerHp > 50"`、
 *         `"slot('slot-1') === 'attack'"`。
 *     context (object): 実行時の評価コンテキスト。
 *         variables (object): 変数名→値のマップ。`playerHp` / `enemyHp` /
 *             `maxPlayerHp` / `maxEnemyHp` / `guardShield` / `reflectActive`
 *             を最低限含む（呼び出し側で `buildEvalContext` 等で組み立てる）。
 *         slot (function): スロット id を受け取り、配置されているカードの
 *             `id` 文字列を返す。空きスロットなら `null`。
 *
 * Returns:
 *     boolean: 評価結果。式が不正なら `false`。
 */
function evaluateCondition(expression, context) {
  if (typeof expression !== 'string') {
    return false;
  }
  const trimmed = expression.trim();

  const slotMatch = trimmed.match(SLOT_PATTERN);
  if (slotMatch) {
    const slotId = slotMatch[2];
    const op = slotMatch[3];
    const rightExpr = slotMatch[4].trim();
    const left = context.slot(slotId);
    const right = parseLiteral(rightExpr);
    if (right === undefined) {
      console.warn(`[evaluateCondition] unparseable literal in "${expression}"`);
      return false;
    }
    return op === '===' ? left === right : left !== right;
  }

  const varMatch = trimmed.match(VAR_PATTERN);
  if (varMatch) {
    const varName = varMatch[1];
    const op = varMatch[2];
    const rightExpr = varMatch[3].trim();
    if (!(varName in context.variables)) {
      console.warn(`[evaluateCondition] unknown variable "${varName}" in "${expression}"`);
      return false;
    }
    const left = context.variables[varName];
    const right = parseLiteral(rightExpr);
    if (right === undefined) {
      console.warn(`[evaluateCondition] unparseable literal in "${expression}"`);
      return false;
    }
    return compareValues(left, op, right);
  }
  console.warn(`[evaluateCondition] unparseable expression: "${expression}"`);
  return false;
}

/**
 * リテラル文字列を JavaScript の値に解析する。
 *
 * サポートするリテラル：
 *   - `null` → `null`
 *   - `true` / `false` → boolean
 *   - 整数（`-` 接頭辞可、例: `50`、`-30`）→ number
 *   - シングル/ダブルクォート文字列（例: `'attack'`、`"heal"`）→ string
 *
 * 解析に失敗した場合は `undefined` を返し、呼び出し側で警告ログを残せる
 * ようにする。`null` を返してしまうと `=== null` の比較で偽陽性になる
 * ため、解析失敗とリテラル `null` を明確に区別している。
 *
 * Args:
 *     str (string): 解析対象の文字列（既に `trim()` 済みである前提）。
 *
 * Returns:
 *     null | boolean | number | string | undefined: 解析した値、または
 *         解析失敗時の `undefined`。
 */
function parseLiteral(str) {
  if (str === 'null') return null;
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  const strMatch = str.match(/^(['"])([^'"]*)\1$/);
  if (strMatch) return strMatch[2];
  return undefined;
}

/**
 * 6 種類の比較演算子で 2 値を比較する。
 *
 * 数値の大小比較（`>` / `<` / `>=` / `<=`）と厳密等価（`===` / `!==`）を
 * サポート。厳密等価は数値だけでなく文字列・`null`・boolean の比較にも
 * 使える（JavaScript の `===` の挙動に従う）。未知の演算子は `false` を
 * 返す（呼び出し側のガードが先に弾く想定だが、防御的にフォールバック）。
 *
 * Args:
 *     left (any): 左辺値。
 *     op (string): 演算子。`>`、`<`、`>=`、`<=`、`===`、`!==` のいずれか。
 *     right (any): 右辺値。
 *
 * Returns:
 *     boolean: 比較結果。
 */
function compareValues(left, op, right) {
  switch (op) {
    case '>':   return left >   right;
    case '<':   return left <   right;
    case '>=':  return left >=  right;
    case '<=':  return left <=  right;
    case '===': return left === right;
    case '!==': return left !== right;
    default:    return false;
  }
}

export default evaluateCondition;