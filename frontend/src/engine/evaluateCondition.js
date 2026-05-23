/**
 * フローチャートの条件分岐ノードで使う条件式評価関数。
 *
 * `stages.json` の `conditions[].expression` に書かれた文字列を受け取り、
 * 実行時の状態（HP、シールド、スロット配置など）を `context` 経由で参照
 * して `true` / `false` を返す。`eval` や `new Function` を使わず、正規表現
 * ベースのシンプルなパターンマッチで構文を限定的にサポートすることで、
 * 任意コード実行のリスクを排除している（map-2-stage-1 要件 2-4）。
 *
 * 構文は「論理結合層」と「原子式（単一比較）層」の 2 段で扱う。論理結合層は
 * `evaluateCondition` 本体が担い、`&&` / `||` で式を分割して各部分を再帰評価する。
 * 原子式層は `evaluateAtom` が担い、以下の 2 パターンの単一比較を解釈する：
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
 * 論理演算子 `&&` / `||` は文字列分割で対応する。`&&` は `||` より結合が
 * 強いため、先に `||` で分割（優先度が低い＝外側）し、各セグメントを `&&` で
 * 分割する 2 段構成にすることで、括弧なしの混在式
 * （例: `a || b && c` → `a || (b && c)`）でも JS と同じ優先順位になる。
 * `Array.prototype.some` / `every` を使うため短絡評価も JS と一致する。
 *
 * ただし**括弧 `()` による優先順位の上書き**と、**文字列リテラル内に
 * `&&` / `||` を含むケース**（例: `slot('a&&b')`）は単純分割では扱えない。
 * これらや算術演算子の拡張が必要になった時点で、`evaluateCondition` の分割
 * 部分をトークナイザ + 再帰下降パーサーに差し替える。その際も葉の評価器
 * `evaluateAtom` はそのまま再利用できるよう、論理結合と単一比較を関数として
 * 分離してある。
 */

const SLOT_PATTERN = /^slot\(\s*(['"])([^'"]+)\1\s*\)\s*(===|!==)\s*(.+)$/;
const VAR_PATTERN = /^(\w+)\s*(>=|<=|===|!==|>|<)\s*(.+)$/;

/**
 * 条件式を評価して `true` / `false` を返す（論理結合層）。
 *
 * 評価の流れ：
 *   1. `expression` が文字列でなければ `false` を返す（防御的なガード）。
 *   2. `||` を含めば `||` で分割し、各セグメントを再帰評価して
 *      `Array.prototype.some` で OR 結合（短絡評価）。
 *   3. `&&` を含めば `&&` で分割し、各セグメントを再帰評価して
 *      `Array.prototype.every` で AND 結合（短絡評価）。
 *   4. 論理演算子を含まなければ単一比較とみなし、`evaluateAtom` に委譲する。
 *
 * `||` を先に判定することで `&&` より低い優先順位（外側）を表現する。再帰に
 * より、セグメント内に別の論理演算子が現れても同じ流れで処理される。各分割で
 * 演算子が減るため再帰は必ず停止する。括弧と文字列リテラル内の論理演算子は
 * 非対応（モジュール docstring 参照）。
 *
 * Args:
 *     expression (string): 評価する条件式。例: `"playerHp > 50"`、
 *         `"playerHp <= 50 && enemyHp <= 50"`、
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

  if (trimmed.includes('||')) {
    return trimmed.split('||').some((segment) => evaluateCondition(segment, context));
  }
  if (trimmed.includes('&&')) {
    return trimmed.split('&&').every((segment) => evaluateCondition(segment, context));
  }

  return evaluateAtom(trimmed, context);
}

/**
 * 単一比較の原子式を評価して `true` / `false` を返す（原子式層）。
 *
 * `&&` / `||` を含まない単一の比較式を解釈する葉の評価器。`evaluateCondition`
 * の論理結合層から、分割済み・`trim()` 済みのセグメントを受け取って呼ばれる。
 *
 * 評価の流れ：
 *   1. `SLOT_PATTERN` にマッチすれば `context.slot(slotId)` でカード id を
 *      取得し、リテラルと比較（`===` / `!==` のみ）。
 *   2. `VAR_PATTERN` にマッチすれば `context.variables[varName]` から値を
 *      取得し、`compareValues` でリテラルと比較。
 *   3. どちらにもマッチしない・未知の変数・解析不能なリテラルなら
 *      `console.warn` で警告して `false`。
 *
 * 論理結合と単一比較を関数として分離しておくことで、将来 `evaluateCondition`
 * をトークナイザ + 再帰下降パーサーに差し替える際も、本関数を AST の葉の
 * 評価器としてそのまま再利用できる（モジュール docstring 参照）。
 *
 * Args:
 *     expression (string): 評価する単一比較式。`trim()` 済みで論理演算子を
 *         含まない前提（呼び出し元の `evaluateCondition` が保証する）。
 *     context (object): 実行時の評価コンテキスト。`evaluateCondition` と同じ
 *         `{ variables, slot }` 構造。
 *
 * Returns:
 *     boolean: 評価結果。式が不正なら `false`。
 */
function evaluateAtom(expression, context) {
  const slotMatch = expression.match(SLOT_PATTERN);
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

  const varMatch = expression.match(VAR_PATTERN);
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