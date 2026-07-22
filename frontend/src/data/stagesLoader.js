/**
 * ステージ定義ファイル（`stages.json`）をランタイム用の完全形式に展開する
 * ローダー。
 *
 * `stages.json` は「短縮形式」と「完全形式」の両方を受け付け、本ローダーが
 * 不足フィールドをデフォルト値で自動補完して呼び出し側に提供する。これにより
 * 線形構造のステージ定義は「敵 ID」「手札」「スロットの並びとロックカード」
 * の 3 要素だけ書けばよくなり、座標計算・slot id 採番・edge id 命名といった
 * 機械的な記述から解放される。
 *
 * フォールバック方式（「明示指定があればそれを優先、無ければ自動補完」）を
 * 採用しているため、将来分岐ステージ等の不規則な構造を追加する場合は、その
 * ステージだけ `slots[].id` / `slots[].position` / `edges` を明示すれば
 * ローダーは明示指定をそのまま尊重する。線形ステージのショートカットと
 * 完全自由配置のステージは同じ JSON ファイル内に共存できる。
 *
 * 補完ルール：
 *   - `slot.id` 省略 → `slot-${index+1}` を自動付与
 *   - `slot.position` 省略 → `{ x: SLOT_X_START + index * SLOT_X_STEP, y: SLOT_Y_DEFAULT }`
 *   - `start` 省略 → `{ position: { x: START_X, y: SLOT_Y_DEFAULT } }`
 *   - `goal` 省略 → スロット末尾の次の x 座標に配置
 *   - `edges` 省略 → `start → slot-1 → slot-2 → ... → slot-N → goal` を線形生成
 *
 * 展開処理はモジュールのトップレベルで 1 回だけ実行し、結果を `stagesData`
 * としてキャッシュする。ES Modules のキャッシュ機構により、複数ファイルから
 * import しても展開は 1 度しか走らない。
 *
 * Exports:
 *     stagesData (object): `{ demoStageIds, stages }` 形式の完全形式ステージ
 *         データ。`demoStageIds` は開発用バトルデモボタンから選べるステージ ID
 *         配列で、先頭要素は `BattleScreen` の `stageId` 未指定時のフォールバック
 *         も兼ねる。既存の `stages.json` を直接 import していた箇所は、本
 *         モジュールに import パスを差し替えるだけで動作する（形状が完全互換）。
 */

import rawStagesData from './stages.json';

const SLOT_X_START = 80;
const SLOT_X_STEP = 200;
const SLOT_Y_DEFAULT = 120;
const START_X = -120;
const MERGE_SIZE = 16;
const SLOT_WIDTH = 80;
const SLOT_HEIGHT = 120;
const LOOP_ROW_GAP = 160;
const COND_WIDTH = 140;

/**
 * スロット配列を完全形式に展開する。
 *
 * 各スロットについて、`id` が未指定なら `slot-${index+1}` を自動採番し、
 * `position` が未指定なら `SLOT_X_START + index * SLOT_X_STEP` を x 座標、
 * `SLOT_Y_DEFAULT` を y 座標として等間隔配置する。
 *
 * オプションフィールドの取り込み（`restricted-slot` / `multiplier-slot` /
 * `loop-counter` 仕様）：`lockedCard` / `acceptOnly` / `multiplier` の 3 つは
 * **すべて独立した `if` ブロック** で処理し、クロスフィールドの排他チェックは
 * 行わない。各ブロックは「自分のフィールド値が妥当か」だけを検証する：
 *   - `lockedCard`: 指定されていればコピーする。ただし `lockedCard.id === 'counter'`
 *     の場合は **`counterId` の必須性** を検証する（`loop-counter` 要件 1-1 / 1-3）。
 *     `counterId` が非空文字列なら `expanded.lockedCard = raw.lockedCard` で counterId
 *     込みでコピー、欠けていれば `console.warn` を出して `{ id: 'counter' }` に縮退し、
 *     通常の lockedCard として展開を継続する（クラッシュさせない安全側フォールバック）。
 *     `counter` 以外の `lockedCard.id`（既存の `monster` 等）はそのままコピーで
 *     完全後方互換。
 *   - `acceptOnly`: `isValidAcceptOnly`（`'attack'`/`'guard'`/`'heal'`）を通れば
 *     コピー、不正値なら `console.warn` + 無視
 *   - `multiplier`: `isValidMultiplier`（**2 以上の整数**または **`{ counterRef: 非空
 *     文字列 }`**、`loop-counter` 要件 2-1）を通ればコピー、不正値なら `console.warn`
 *     + 無視。リテラル数値とカウンタ参照オブジェクトは Sum 型として同じスロット
 *     フィールドに同居し、ランタイム側で型分岐して解決する。
 *
 * `lockedCard` と `acceptOnly` を両方書いた場合の排他警告は **撤去** した。
 * 理由：locked スロットは初期化時にカードが埋まり `computeDropTransition` の
 * `destCard?.locked` ガードで全ドロップを拒否するため、`acceptOnly`（ドロップ
 * 種別制限）は実行時に発火しようがなく機能的に無害。「両方書くと acceptOnly
 * アイコンが locked スロットに出る」見た目自体がデザイナーへの視覚的ヒントに
 * なるため、console 警告は不要と判断した。一方 `lockedCard` × `multiplier` は
 * 意味があり（locked attack 20 × 2 = 40 ダメージ、`multiplier-slot` 要件 2-4）、
 * multiplier ブロックがそのまま適用される。
 *
 * 未指定フィールドは付与しない（後段で `slot.acceptOnly === undefined` /
 * `slot.multiplier === undefined` が後方互換の分岐として機能する）。`stageId`
 * 引数は警告メッセージに含めてデザイナーが該当箇所を特定しやすくする用途。
 *
 * Args:
 *     slots (Array<object>): 短縮または完全形式のスロット配列。各要素は
 *         空オブジェクト `{}` から `{id, position, lockedCard, acceptOnly, multiplier}`
 *         まで任意の指定度を取れる。`lockedCard` は `{id, power?}` または
 *         `{id: 'counter', counterId}` を取り、`multiplier` は数値リテラルまたは
 *         `{counterRef}` を取る。
 *     stageId (string): 当該ステージの ID（`stages.json` のキー）。警告ログの
 *         デバッグコンテキストとして使う。
 *
 * Returns:
 *     Array<{id, position, lockedCard?, acceptOnly?, multiplier?}>:
 *         完全形式のスロット配列。`battleStore` / `FlowchartArea` がそのまま
 *         受け取れる形。`lockedCard` / `multiplier` の中身の型は Sum 型として
 *         そのまま運ばれる。
 */
function expandSlots(slots, stageId) {
  return slots.map((raw, index) => {
    const id = raw.id ?? `slot-${index + 1}`;
    const position = raw.position ?? {
      x: SLOT_X_START + index * SLOT_X_STEP,
      y: SLOT_Y_DEFAULT,
    };
    const expanded = { id, position };
    if (raw.lockedCard) {
      if (raw.lockedCard.id === 'counter') {
        if (typeof raw.lockedCard.counterId === 'string' && raw.lockedCard.counterId.length > 0) {
          expanded.lockedCard = raw.lockedCard;
        } else {
          console.warn(`[stagesLoader] stage "${stageId}" slot "${id}": counter lockedCard requires a non-empty "counterId". Treating as plain lockedCard.`);
          expanded.lockedCard = { id: 'counter' };
        }
      } else {
        expanded.lockedCard = raw.lockedCard;
      }
    }
    if (raw.acceptOnly) {
      if (isValidAcceptOnly(raw.acceptOnly)) {
        expanded.acceptOnly = raw.acceptOnly;
      } else {
        console.warn(`[stagesLoader] stage "${stageId}" slot "${id}": invalid acceptOnly "${raw.acceptOnly}". Ignoring.`);
      }
    }
    if (raw.multiplier !== undefined) {
      if (isValidMultiplier(raw.multiplier)) {
        expanded.multiplier = raw.multiplier;
      } else {
        console.warn(`[stagesLoader] stage "${stageId}" slot "${id}": invalid multiplier "${JSON.stringify(raw.multiplier)}". Must be integer >= 2 or { counterRef: "<id>" }. Ignoring.`);
      }
    }
    return expanded;
  });
}

/**
 * スタートマーカー定義を完全形式に展開する。
 *
 * `raw` が定義されていればそのまま返し、未定義なら標準位置
 * （`x: START_X`, `y: SLOT_Y_DEFAULT`）にフォールバックする。スタート
 * マーカーは線形ステージでは常に最初のスロットの左隣に置かれる前提なので、
 * 省略した場合のデフォルト位置を 1 箇所に集約する。
 *
 * Args:
 *     raw ({position: {x: number, y: number}} | undefined):
 *         ステージ定義の `start` フィールド。未定義可。
 *
 * Returns:
 *     {position: {x: number, y: number}}: 完全形式のスタート定義。
 */
function expandStart(raw) {
  if (raw) return raw;
  return { position: { x: START_X, y: SLOT_Y_DEFAULT } };
}

/**
 * ゴールマーカー定義を完全形式に展開する。
 *
 * `raw` が定義されていればそのまま返し、未定義ならスロット末尾の次の
 * x 座標（`SLOT_X_START + slotCount * SLOT_X_STEP`）に自動配置する。
 * スロット数に応じてゴール位置が連動するため、ステージにスロットを追加
 * しただけでゴール座標は自動的に右へずれる。
 *
 * Args:
 *     raw ({position: {x: number, y: number}} | undefined):
 *         ステージ定義の `goal` フィールド。未定義可。
 *     slotCount (number): 当該ステージのスロット数。自動配置の x 座標
 *         算出に使う。
 *
 * Returns:
 *     {position: {x: number, y: number}}: 完全形式のゴール定義。
 */
function expandGoal(raw, slotCount) {
  if (raw) return raw;
  return {
    position: {
      x: SLOT_X_START + slotCount * SLOT_X_STEP,
      y: SLOT_Y_DEFAULT,
    },
  };
}

/**
 * スロット配列から線形構造のエッジ配列を自動生成する。
 *
 * `start → slot-1 → slot-2 → ... → slot-N → goal` の一本道を `edges` 配列
 * として組み立てる。各エッジの id は `e-${source}-${target}` 形式で命名
 * （例: `e-start-slot-1`、`e-slot-1-slot-2`、`e-slot-8-goal`）。エッジ id
 * は React Flow 内で一意であれば動作上の意味は持たないため、source/target
 * を含む冗長な命名でデバッグ時の可読性を優先している。
 *
 * スロットが 0 個のステージ（理論上のエッジケース）では `start → goal` の
 * 直結エッジ 1 本を返し、上流コードが空配列を期待しなくて済むようにする。
 *
 * Args:
 *     slots (Array<{id: string}>): 展開済みスロット配列。`id` が必要。
 *
 * Returns:
 *     Array<{id: string, source: string, target: string}>: 線形エッジ配列。
 *         React Flow に渡せる形（`type` / `markerEnd` 等は `FlowchartArea`
 *         側で付与される）。
 */
function buildLinearEdges(slots) {
  if (slots.length === 0) {
    return [{ id: 'e-start-goal', source: 'start', target: 'goal' }];
  }
  const edges = [
    { id: `e-start-${slots[0].id}`, source: 'start', target: slots[0].id },
  ];
  for (let i = 0; i < slots.length - 1; i += 1) {
    edges.push({
      id: `e-${slots[i].id}-${slots[i + 1].id}`,
      source: slots[i].id,
      target: slots[i + 1].id,
    });
  }
  edges.push({
    id: `e-${slots[slots.length - 1].id}-goal`,
    source: slots[slots.length - 1].id,
    target: 'goal',
  });
  return edges;
}

/**
 * `flow` 配列の要素が条件分岐ノードかどうかを判定する。
 *
 * `condition` キーに文字列がセットされていれば条件分岐、それ以外（空オブ
 * ジェクト、`lockedCard` 持ちなど）は通常スロットとして扱う。`typeof` で
 * 厳密に文字列をチェックすることで、`condition: true` のような誤記が
 * 「条件分岐」として誤分類されないようガードしている。
 *
 * Args:
 *     item (object): `flow` 配列の 1 要素。
 *
 * Returns:
 *     boolean: 条件分岐要素なら `true`。
 */
function isCondition(item) {
  return typeof item?.condition === 'string';
}

/**
 * `flow` 配列の要素がループ構文かどうかを判定する。
 *
 * `loop` キーにオブジェクトがセットされていればループ要素とみなす。`isCondition`
 * と同様に `typeof` で厳密に判定し、`loop: true` のような誤記を「ループ」と誤分類
 * しないようガードしている。
 *
 * Args:
 *     item (object): `flow` 配列の 1 要素。
 *
 * Returns:
 *     boolean: ループ要素なら `true`。
 */
function isLoop(item) {
  return typeof item?.loop === 'object' && item.loop !== null;
}

/**
 * `flow` 配列の要素が折り返し（turn）構文かどうかを判定する（`flowchart-turn` 仕様）。
 *
 * `turn` キーにオブジェクトがセットされていれば turn 要素とみなす。`isCondition` /
 * `isLoop` と同様に `typeof` で厳密に判定し、`turn: true` や `turn: "down"` のような
 * 誤記を「turn」と誤分類しないようガードしている。turn は視覚ノードを生成せず、
 * `processSubFlow` 側で行 2 への折り返し（yLevel ジャンプ + direction 反転 + column 巻き
 * 戻し）として処理される（要件 1-1）。将来 `{"turn": {"direction": ...}}` のように
 * オブジェクト内に追加プロパティが入る拡張に備えて、値の型は object に固定する
 * （要件 5-1）。
 *
 * Args:
 *     item (object): `flow` 配列の 1 要素。
 *
 * Returns:
 *     boolean: turn 要素なら `true`。
 */
function isTurn(item) {
  return typeof item?.turn === 'object' && item.turn !== null;
}

/**
 * `acceptOnly` フィールドの値がサポートされた種別かを判定する。
 *
 * `restricted-slot` 仕様で許可される値は `'attack'` / `'guard'` / `'heal'` の
 * 3 種類のみ。他の値（タイポ・空文字・未対応の id）はすべて `false` を返し、
 * ローダー側が `console.warn` を出して当該 acceptOnly を破棄する。3 種類だけ
 * のシンプルな許容判定なので Set ではなく直接の `===` 比較にしている（追加
 * 時もこの 1 行を伸ばすだけ）。
 *
 * Args:
 *     value (any): スロット定義の `acceptOnly` フィールド値。
 *
 * Returns:
 *     boolean: 許容された値なら `true`。
 */
function isValidAcceptOnly(value) {
  return value === 'attack' || value === 'guard' || value === 'heal';
}

/**
 * `multiplier` フィールドの値がサポートされた倍率かを判定する。
 *
 * 2 系統の Sum 型を受け入れる：
 *   1. **数値リテラル**（`multiplier-slot` 仕様）：**2 以上の整数**。`Number.isInteger`
 *      で小数（`1.5`）・文字列（`"2"`）・`null` / `undefined` / `boolean` / `NaN` /
 *      `Infinity` をすべて拒否し、`>= 2` で `0` / `1` / 負数を弾く。`multiplier: 1`
 *      は明示指定でも「倍率なし」と同義のため無効扱い（multiplier-slot 要件 1-5）。
 *   2. **カウンタ参照オブジェクト**（`loop-counter` 仕様）：`{ counterRef: 非空文字列 }`。
 *      `typeof value === 'object' && value !== null` でオブジェクト性を先に
 *      ガードしてから、`counterRef` が文字列かつ `length > 0` であることを確認する。
 *      これにより `null` / 配列（`[].counterRef === undefined`）/ `{ counterRef: 0 }` /
 *      `{ counterRef: "" }` などの不正値を自然に拒否する。倍率の実体（数値）は
 *      ランタイムで `counterValues[counterRef]` から動的に解決される（loop-counter
 *      要件 2-2 / 2-3）。
 *
 * 不正値はローダー側（`expandSlots` / `buildBodySlot`）が `console.warn` を出して
 * 当該 `multiplier` を破棄する。両系統の判定をひとつの関数に集約することで、線形
 * ステージと flow / loop body の両ルートが同じスキーマ拡張を 1 か所の修正で享受できる。
 *
 * Args:
 *     value (any): スロット定義の `multiplier` フィールド値。
 *
 * Returns:
 *     boolean: 2 以上の整数、または `{ counterRef: 非空文字列 }` 形式なら `true`。
 */
function isValidMultiplier(value) {
  if (Number.isInteger(value) && value >= 2) return true;
  if (typeof value === 'object' && value !== null) {
    return typeof value.counterRef === 'string' && value.counterRef.length > 0;
  }
  return false;
}

/**
 * 1 本のエッジオブジェクトを `{ id, source, target, sourceHandle? }` 形式で
 * 組み立てる。
 *
 * `ending` は「直前の終端ノード」を表す `{ nodeId, sourceHandle }` の形式。
 * `sourceHandle` が undefined の場合はキー自体を含めないことで、線形ステージ
 * の既存エッジ形式（`sourceHandle` フィールドなし）と完全に一致させる。
 * これにより `FlowchartArea` の `edgesToFlowEdges` で `sourceHandle:
 * undefined` を渡したときに React Flow がデフォルトハンドルに接続する挙動
 * との整合が取れる。
 *
 * Args:
 *     ending (object): `{ nodeId: string, sourceHandle?: string }`。
 *     targetId (string): エッジの target ノード id。
 *
 * Returns:
 *     {id, source, target, sourceHandle?}: 完全形式のエッジオブジェクト。
 */
function buildEdge(ending, targetId) {
  const edge = {
    id: `e-${ending.nodeId}-${targetId}`,
    source: ending.nodeId,
    target: targetId,
  };
  if (ending.sourceHandle) {
    edge.sourceHandle = ending.sourceHandle;
  }
  if (ending.targetHandle) {
    edge.targetHandle = ending.targetHandle;
  }
  return edge;
}

/**
 * 通常スロット要素 1 個を完全形式に展開して `ctx` に積む共通ヘルパー。
 *
 * `ctx.slotCounter` を進めて `slot-${n}` を採番し、`lockedCard` / `acceptOnly` /
 * `multiplier` の各オプションを（`isValidAcceptOnly` / `isValidMultiplier` で
 * 検証しつつ）取り込んで `ctx.slots` に push する。`processSubFlow` の通常スロット
 * 分岐と `expandLoop` のループボディの両方から呼ばれ、スロット生成ロジックを
 * 1 箇所に集約する。
 *
 * `lockedCard` の取り込み（`loop-counter` 仕様）：`raw.lockedCard.id === 'counter'`
 * の場合は **`counterId` の必須性** を検証する（要件 1-1 / 1-3）。`counterId` が
 * 非空文字列なら counterId 込みでコピー、欠けていれば `console.warn` を出して
 * `{ id: 'counter' }` に縮退する（通常の lockedCard として展開を継続）。`counter`
 * 以外の `lockedCard.id` は既存どおり単純コピー。flow ルートでは `stageId` を持たない
 * ため警告は `slot "${slotId}"` のみで構成するが、`slot-N` 通し番号で十分に特定可能。
 *
 * `multiplier` の取り込み（`loop-counter` 仕様）：`isValidMultiplier` は **2 以上の
 * 整数**または **`{ counterRef: 非空文字列 }`** の Sum 型を受け入れる（要件 2-1）。
 * 中身の型はそのままスロットに運ばれ、ランタイム側で型分岐して解決される。
 *
 * Args:
 *     ctx (object): 共有アキュムレータ。`slotCounter` / `slots` を持つ。
 *     raw (object): スロットの短縮定義（`{lockedCard?, acceptOnly?, multiplier?}`）。
 *         `lockedCard` は `{id, power?}` または `{id: 'counter', counterId}`、
 *         `multiplier` は数値リテラルまたは `{counterRef}` を受け付ける。
 *     position ({x: number, y: number}): スロットの配置座標。
 *
 * Returns:
 *     string: 採番したスロット id（`slot-${n}`）。呼び出し側がエッジ結線に使う。
 */
function buildBodySlot(ctx, raw, position) {
  ctx.slotCounter += 1;
  const slotId = `slot-${ctx.slotCounter}`;
  const slot = { id: slotId, position };
  if (raw.lockedCard) {
    if (raw.lockedCard.id === 'counter') {
      if (typeof raw.lockedCard.counterId === 'string' && raw.lockedCard.counterId.length > 0) {
        slot.lockedCard = raw.lockedCard;
      } else {
        console.warn(`[stagesLoader] slot "${slotId}": counter lockedCard requires a non-empty "counterId". Treating as plain lockedCard.`);
        slot.lockedCard = { id: 'counter' };
      }
    } else {
      slot.lockedCard = raw.lockedCard;
    }
  }
  if (raw.acceptOnly) {
    if (isValidAcceptOnly(raw.acceptOnly)) {
      slot.acceptOnly = raw.acceptOnly;
    } else {
      console.warn(`[stagesLoader] slot "${slotId}": invalid acceptOnly "${raw.acceptOnly}". Ignoring.`);
    }
  }
  if (raw.multiplier !== undefined) {
    if (isValidMultiplier(raw.multiplier)) {
      slot.multiplier = raw.multiplier;
    } else {
      console.warn(`[stagesLoader] slot "${slotId}": invalid multiplier "${JSON.stringify(raw.multiplier)}". Must be integer >= 2 or { counterRef: "<id>"}. Ignoring.`);
    }
  }
  ctx.slots.push(slot);
  return slotId;
}

/**
 * サブフロー（メイン経路 or 分岐経路）を再帰的に展開する内部ヘルパー。
 *
 * `items` 配列の各要素を順に走査し、通常スロット要素なら `ctx.slots` に
 * 連番採番で追加、条件分岐要素なら `ctx.conditions` に追加した上で
 * `true` / `false` の各経路を再帰的に展開する。ループ要素（`loop` キー）なら
 * `expandLoop` に委譲し、合流ノード・条件ノード・ボディ・戻りエッジを生成する。
 * エッジは「直前の終端（`endings`）から、いま作ったノードへ」の方向で
 * `ctx.edges` に追加する。
 *
 * 条件分岐要素の `label` フィールド（optional、自然言語の説明文）も
 * `ctx.conditions[]` の各要素にそのまま転記する。例: `{ condition:
 * "playerHp > 50", label: "playerHpが50より大きい", ... }` という flow 要素
 * からは `ctx.conditions.push({ id, position, expression: "playerHp > 50",
 * label: "playerHpが50より大きい" })` が作られる。`label` は ConditionNode の
 * 表示テキストとして `expression` より優先される（小学生向けに評価式の代わりに
 * 自然言語の文を見せるための仕組み）。`label` 未指定なら `undefined` のまま
 * 流れ、ConditionNode 側で `expression` にフォールバックされる。
 *
 * 通常スロット要素の `lockedCard` / `acceptOnly` / `multiplier` の取り込み
 * （`restricted-slot` / `multiplier-slot` 仕様）：`expandSlots` と同じく 3 つを
 * **すべて独立した `if` ブロック** で処理し、クロスフィールドの排他チェックは
 * 行わない。各ブロックは自フィールドの値妥当性のみ検証する（`acceptOnly` は
 * `isValidAcceptOnly`、`multiplier` は `isValidMultiplier`、不正値は warning +
 * 無視）。`lockedCard` × `acceptOnly` の排他警告は撤去済み（locked スロットは
 * ドロップを全拒否するため acceptOnly が無害に無視されるだけで、警告不要）。
 * flow ルートでは stageId を持っていないため警告メッセージは slotId のみで
 * 構成するが、`slot-N` 通し番号で十分に特定可能。
 *
 * `endings` 配列の役割：
 *   通常の線形ステージでは「直前のノード 1 個」だけが直後ノードへ繋がる
 *   出発点となる。条件分岐の中では True / False 両経路を再帰展開した後、
 *   合流ノード（merge ノード）を介してそれぞれの終端を 1 つにまとめるため、
 *   親に返される `endings` は条件分岐後でも常に 1 要素（merge ノード）になる。
 *   入れ子の分岐でも同様で、各レベルで個別の合流ノードが生成される。
 *
 * 再帰呼び出し：
 *   条件分岐要素に遭遇した瞬間、`item.true` と `item.false` の **配列全体**
 *   をそれぞれ別のサブフローとして `processSubFlow` に渡す。`true` 経路は
 *   親と同じ `yLevel`（メイン経路の延長として右に並ぶ）、`false` 経路は
 *   `yLevel + 160`（下にずらして並行に描く）。入れ子の分岐（`true` 配列の
 *   中にさらに condition 要素）も同じ再帰呼び出しで自然に対応できる。
 *   再帰呼び出しでは `isTopLevel: false`、`direction: currentDirection` を
 *   明示的に伝播し、turn が分岐内で誤って効かないようにする（`flowchart-turn`
 *   要件 6）。
 *
 * 折り返し対応（`flowchart-turn` 仕様）：
 *   `direction` パラメータ（`'right'` / `'left'`）と `isTopLevel`（boolean）を
 *   受け取り、引数の `yLevel` / `direction` をローカル変数 `currentYLevel` /
 *   `currentDirection` に複製してから走査する。これにより turn ハンドラが
 *   「行を変える（`currentYLevel` を書き換え）」「方向を反転する（`currentDirection`
 *   を `'left'` に書き換え）」操作を 1 イテレーション内で完結させられる。通常
 *   スロット展開時の column 更新は `column += currentDirection === 'right' ? 1 : -1`
 *   で方向対応する。`direction` が `'right'`（既定）のときは従来の `column += 1`
 *   と同一挙動。
 *
 *   turn 要素のハンドリング：if/else チェーンの先頭 `isTurn(item)` で検出する。
 *   3 層バリデーションを順に通す：(1) `!isTopLevel` なら warn + skip（要件 6、loop
 *   body / condition 内に書かれた turn を弾く）、(2) `ctx.turnCount >= 1` なら
 *   warn + skip（要件 5-4、複数 turn は今回スコープ外）、(3) `endings[0]?.nodeId
 *   === 'start'` なら warn + skip（要件 2-4 の安全側、flow 先頭 turn を弾く）。
 *   3 層を通過したら行 2 の y を **動的に計算**：`Math.max(SLOT_Y_DEFAULT,
 *   ...ctx.slots.map(...), ...ctx.conditions.map(...))` で配置済み全ノードの max
 *   y を求め、`currentYLevel = maxY + LOOP_ROW_GAP` で行 2 にジャンプする
 *   （要件 2-5、行 1 に condition の false 分岐があると max_y = 280 → 行 2 = 440 に
 *   ずれる）。`lastSlotColumn = column - (currentDirection === 'right' ? 1 : -1)`
 *   で直前スロットの column を逆算し、`column = lastSlotColumn` で post-turn の
 *   最初のスロットを直前と同じ x に置く。`currentDirection = 'left'` で以降の
 *   column 増減を反転、`ctx.turnCount += 1` / `ctx.afterTurn = true` の状態を
 *   立て、`continue` で次の item へ進む（turn 自体はノードを生成しない）。
 *
 *   通常スロット展開時のエッジ生成は 3 分岐：(a) `ctx.afterTurn` が true →
 *   `sourceHandle: 'down-out'` / `targetHandle: 'top'` で垂直下エッジを生成し、
 *   `ctx.afterTurn` を false にリセット（一回消費）。(b) `currentDirection ===
 *   'left'`（turn 後の通常エッジ）→ `sourceHandle: ending.sourceHandle ?? 'left-out'`
 *   / `targetHandle: 'right-in'` の **一律パターン** で左向きエッジを生成。
 *   `ending.sourceHandle` を `??` で保持することで、cond の true / false 出口
 *   （`'true'` / `'false'`）が `'left-out'` で誤って上書きされる事故を防ぐ
 *   （cond には `'left-out'` source ハンドルが存在しないため、上書きすると
 *   React Flow がエッジを描画できない）。cond の `'false'` 出口（Position.Bottom）→
 *   slot の `'right-in'`（Position.Right）の組み合わせでも、`AnimatedProgressEdge.
 *   shouldUseStep` が `sourceHandleId === 'false'` を検知して smoothstep を選び、
 *   cond の bottom から下→左へ slot の右辺へ進入する自然な L 字を描く（rightward
 *   の cond.bottom → slot.left の完全 mirror）。(c) それ以外（既定の右向き）→
 *   ハンドル指定なしの `buildEdge(ending, slotId)` で既存挙動を維持。これにより
 *   turn を含まないステージは (c) のみを通り、本機能導入前と完全に同一の出力に
 *   なる（要件 7）。
 *
 *   condition 入口エッジ生成も同じ一律パターン：(b) `currentDirection === 'left'`
 *   なら `sourceHandle: ending.sourceHandle ?? 'left-out'` / `targetHandle: 'right-in'`
 *   で左向き直線、それ以外は従来どおりハンドル指定なし。cond → cond 連鎖
 *   （first cond の true / false 出口から second cond への直接接続）でも
 *   `ending.sourceHandle` が `??` で正しく保持される。cond の `right-in` ターゲット
 *   ハンドルは `ConditionNode.jsx` に追加済み（`flowchart-turn` 第 2 弾仕様）。
 *
 *   leftward 文脈での edge 生成の規約は「source は ending を保持（未設定なら
 *   `'left-out'`）、target は接続先に応じて選ぶ」の一律パターン。具体的には：
 *     - 通常スロットへ: target は `'right-in'`
 *     - condition へ: target は `'right-in'`
 *     - merge へ（true 分岐から）: target は `'right-in'`
 *     - merge へ（false 分岐から）: target は方向不問の `'bottom'`
 *   source 側は **すべての箇所で同じパターン**：`ending.sourceHandle ?? 'left-out'`。
 *   これにより `cond.true` / `cond.false` 出口の sourceHandle が誤って上書きされず、
 *   通常スロット / merge から出るときも自動的に `'left-out'` が選ばれる。例外なし。
 *   新規ノード種別を追加したときも同じパターンが使え、設計の予測可能性と一貫性が
 *   確保される。
 *
 *   merge エッジ生成で leftward source 対応が特に重要：false body の最終 slot
 *   は merge の **右側** に配置されるため、default Right source（東側）で出ると
 *   エッジが右に出てから戻ってきて cond → slot エッジと視覚的に絡む。`'left-out'`
 *   で出ることで slot の左辺から merge の下辺（または右辺）へ自然な L 字 / 直線を
 *   描く。これは leftward の column 減少と false 分岐の下方拡張による「slot が
 *   merge の右側」という配置の必然的な帰結。
 *
 *   leftward 文脈での condition 展開（`flowchart-turn` 第 2 弾、要件 9〜16）：
 *   condition ブランチも `currentDirection` を見て 6 か所が direction-aware に
 *   切り替わる：(1) `trueDir` 既定値（leftward なら `'left'`、rightward なら
 *   `undefined` で ConditionNode 側 `'right'` フォールバック）、(2) 入口エッジ
 *   （leftward なら `left-out` / `right-in`、rightward は無指定）、(3) column
 *   増減（`column += currentDirection === 'right' ? 1 : -1`）、(4) mergeColumn
 *   集約（leftward は `Math.min(...)`、rightward は `Math.max(...)`、要件 9-4 /
 *   14-4）、(5) merge x の anchor offset（leftward は `+SLOT_X_STEP / 2`、
 *   rightward は `-SLOT_X_STEP / 2` で次スロット側にミラー配置、要件 13-1）、
 *   (6) true → merge エッジ（leftward なら merge 側 `right-in` で受ける、要件
 *   11-5）。`falseDir` 既定値は方向不問で `undefined`（ConditionNode 側で
 *   `'down'` フォールバック、要件 10-2）。false → merge エッジも方向不問で
 *   merge 側 `'bottom'` で受ける（false 分岐は常に行 3 = 下段なので、要件 11-6）。
 *   すべての変更が `currentDirection === 'left'` 分岐の中に局所化されており、
 *   rightward 文脈の既存ステージは else 側を通って完全同一の出力になる（要件 16）。
 *
 * 合流ノードの自動挿入（`merge-node` 仕様）：
 *   True / False の再帰展開後、両経路の `endColumn` の最大値を `mergeColumn`
 *   として、`ctx.mergeNodes` に新しい合流ノード（id: `merge-K`）を追加する。
 *   座標は merge ノードの **視覚中心** を slot[mergeColumn-1] と
 *   slot[mergeColumn] の視覚中心の中間（横）、かつ slot の縦中心（縦）に
 *   一致させる方針で計算し、最後に React Flow が要求する **左上座標**
 *   に変換する（`- MERGE_SIZE / 2` を 2 軸とも引く）。slot 80×120 と
 *   merge 16×16 でサイズが大きく異なるため、左上座標どうしを単純に揃えると
 *   縦に約 52px、横に約 40px ズレるため、サイズの違いを吸収する中心アンカー
 *   方式が必須。True 経路の各終端から合流ノードの left target へ直線エッジ、
 *   False 経路の各終端から合流ノードの **bottom** target へ smoothstep エッジ
 *   （`targetHandle: 'bottom'` 付与）を引く。False 経路は `yLevel + 160` の
 *   下段を通って合流ノードに **下から上向きに** 進入する自然な U 字経路に
 *   なるよう、合流先ハンドルを `Position.Bottom` に置いている（過去に
 *   `Position.Top` を使っていた版は、source が target より下にあるため
 *   smoothstep が「target を一度上方へ越えて上から進入」する不自然な
 *   経路を生成し、途中で slot を裏切るように貫通する見た目になっていた）。
 *   その後 `endings` を合流ノード 1 つ
 *   に統一し、`column` を `mergeColumn` に進める。これにより、次のループ周回で
 *   通常スロット要素が来たとき、合流ノードから直線でその要素に繋がる自然な
 *   フローが生成される。
 *
 * 戻り値の `endColumn` は呼び出し元での「合流先の column 位置決定」に使う。
 *
 * Args:
 *     items (Array<object>): 走査対象のサブフロー配列。空配列も受け付ける
 *         （空のときは何もループせず `prevNodeId` を `endings` として返す）。
 *     options (object): 再帰呼び出しの状態。
 *         startColumn (number): このサブフローの開始 column。turn 後は符号付きで
 *             負の値もとり得る（`flowchart-turn` 仕様、左方向展開）。
 *         yLevel (number): このサブフローの y 座標。
 *         prevNodeId (string): 直前の終端ノード id。
 *         prevSourceHandle (string | undefined): 直前の終端が条件分岐から
 *             の分岐エッジである場合の `sourceHandle`（`'true'` / `'false'`）。
 *         ctx (object): 共有のアキュムレータ。`slotCounter` / `condCounter` /
 *             `slots[]` / `conditions[]` / `edges[]` / `turnCount` / `afterTurn`
 *             を持つ。後者 2 つは `flowchart-turn` 仕様の状態フラグ。
 *         isTopLevel (boolean, optional): `expandFlow` から呼ばれた最上位のサブ
 *             フローなら `true`、condition の true/false 分岐や loop 内の再帰
 *             呼び出しなら `false`（既定 `false`）。turn 要素のバリデーションで
 *             使う（top-level 以外で turn が出現したら warn + skip、要件 6）。
 *         direction (string, optional): 走査の方向。`'right'`（既定、x が増える
 *             方向）または `'left'`（turn 後、x が減る方向）。再帰呼び出しでは
 *             親の `currentDirection` をそのまま伝播する。
 *
 * Returns:
 *     {endings: Array<{nodeId, sourceHandle?}>, endColumn: number,
 *      direction: string, yLevel: number}:
 *         このサブフロー処理後の終端ノード配列、使い終わった column 値、
 *         処理終了時点の方向（turn が走ったあとなら `'left'`）と、最終的な
 *         y 座標（turn が走ったあとなら行 2 の y）。後者 2 つは `expandFlow` 側で
 *         `resolveGoalPlacement` に渡し、goal の配置とハンドル指定を決めるのに使う
 *         （`flowchart-turn` 仕様）。
 */
function processSubFlow(items, { 
  startColumn, 
  yLevel, 
  prevNodeId, 
  prevSourceHandle, 
  ctx,
  isTopLevel = false,
  direction = 'right',
}) {
  let column = startColumn;
  let currentYLevel = yLevel;
  let currentDirection = direction;
  let endings = [{ nodeId: prevNodeId, sourceHandle: prevSourceHandle }];

  for (const item of items) {
    if (isTurn(item)) {
      // バリデーション1：top-level でない場合は warn + skip
      if (!isTopLevel) {
        console.warn('[stagesLoader] turn must be at flow top level (not inside loop body or condition branch). Ignoring.');
        continue;
      }
      // バリデーション2：既に turn を1個処理済みの場合は warn + skip
      if (ctx.turnCount >= 1) {
        console.warn('[stagesLoader] multiple turns in flow are not yet supported. Ignoring extra turn(s).');
        continue;
      }
      // バリデーション3：turn より前にスロットが無い場合は warn + skip
      if (endings[0]?.nodeId === 'start'){
        console.warn('[stagesLoader] turn must follow at least one slot/loop/condition. Ignoring.');
        continue;
      }
      // 行2のy座標を動的計算
      const maxY = Math.max(
        SLOT_Y_DEFAULT,
        ...ctx.slots.map((s) => s.position.y),
        ...ctx.conditions.map((c) => c.position.y),
      );
      // 折り返し実施
      const lastSlotColumn = column - (currentDirection === 'right' ? 1 : -1);
      currentYLevel = maxY + LOOP_ROW_GAP;
      currentDirection = 'left';
      column = lastSlotColumn;
      ctx.turnCount += 1;
      ctx.afterTurn = true;
      continue;
    } else if (isLoop(item)) {
      const loopResult = expandLoop(item.loop, { column, yLevel, endings, ctx });
      endings = loopResult.endings;
      column = loopResult.column;
    } else if (isCondition(item)) {
      ctx.condCounter += 1;
      const condId = `cond-${ctx.condCounter}`;
      ctx.conditions.push({
        id: condId,
        position: { x: 80 + column * 200, y: currentYLevel },
        expression: item.condition,
        label: item.label,
        // leftward なら trueDir を left に指定
        trueDir: item.trueDir ?? (currentDirection === 'left' ? 'left' : undefined),
        falseDir: item.falseDir,
      });
      for (const ending of endings) {
        if (currentDirection === 'left') {
          // source は 'left-out'（未設定時）または 'true / false'(cond), target は 'right-in'
          const sourceHandle = ending.sourceHandle ?? 'left-out';
          ctx.edges.push(buildEdge({ ...ending, sourceHandle, targetHandle: 'right-in' }, condId));
        } else {
          ctx.edges.push(buildEdge(ending, condId));
        }
      }
      column += currentDirection === 'right' ? 1 : -1;

      const trueItems = item.true ?? [];
      const trueResult = processSubFlow(trueItems, {
        startColumn: column,
        yLevel: currentYLevel,
        prevNodeId: condId,
        prevSourceHandle: 'true',
        ctx,
        isTopLevel: false,
        direction: currentDirection,
      });

      const falseItems = item.false ?? [];
      const falseResult = processSubFlow(falseItems, {
        startColumn: column,
        yLevel: currentYLevel + 160,
        prevNodeId: condId,
        prevSourceHandle: 'false',
        ctx,
        isTopLevel: false,
        direction: currentDirection,
      });

      const mergeColumn = currentDirection === 'right'
        ? Math.max(trueResult.endColumn, falseResult.endColumn)
        : Math.min(trueResult.endColumn, falseResult.endColumn);
      ctx.mergeCounter += 1;
      const mergeId = `merge-${ctx.mergeCounter}`;
      const mergeAnchorOffset = currentDirection === 'right' ? -SLOT_X_STEP / 2 : SLOT_X_STEP / 2;
      ctx.mergeNodes.push({
        id: mergeId,
        position: {
          x: SLOT_X_START + mergeColumn * SLOT_X_STEP + mergeAnchorOffset + SLOT_WIDTH / 2 - MERGE_SIZE / 2,
          y: currentYLevel + SLOT_HEIGHT / 2 - MERGE_SIZE / 2,
        },
      });

      for (const ending of trueResult.endings) {
        if (currentDirection === 'left') {
          const sourceHandle = ending.sourceHandle ?? 'left-out';
          ctx.edges.push(buildEdge({ ...ending, sourceHandle, targetHandle: 'right-in' }, mergeId));
        } else {
          ctx.edges.push(buildEdge(ending, mergeId));
        }
      }
      // false → merge エッジは方向不問で bottom で受け取る
      for (const ending of falseResult.endings) {
        if (currentDirection === 'left') {
          const sourceHandle = ending.sourceHandle ?? 'left-out';
          ctx.edges.push(buildEdge({ ...ending, sourceHandle, targetHandle: 'bottom' }, mergeId));
        } else {
          ctx.edges.push(buildEdge({ ...ending, targetHandle: 'bottom' }, mergeId));
        }
      }

      endings = [{ nodeId: mergeId, sourceHandle: undefined }];
      column = mergeColumn;
    } else {
      const slotId = buildBodySlot(ctx, item, {
        x: SLOT_X_START + column * SLOT_X_STEP,
        y: currentYLevel,
      });
      for (const ending of endings) {
        if (ctx.afterTurn) {
          ctx.edges.push(buildEdge({ ...ending, sourceHandle: 'down-out', targetHandle: 'top' }, slotId));
        } else if (currentDirection === 'left') {
          // source は 'left-out'（未設定時）または 'true'(cond), target は 'right-in'
          const sourceHandle = ending.sourceHandle ?? 'left-out';
          ctx.edges.push(buildEdge({ ...ending, sourceHandle, targetHandle: 'right-in' }, slotId));
        } else {
          ctx.edges.push(buildEdge(ending, slotId));
        }
      }
      ctx.afterTurn = false;
      endings = [{ nodeId: slotId, sourceHandle: undefined }];
      column += currentDirection === 'right' ? 1 : -1;
    }
  }

  return { endings, endColumn: column, direction: currentDirection, yLevel: currentYLevel };
}

/**
 * ループ構文（while / do-while）を完全形式に展開する内部ヘルパー。
 *
 * `flow` 要素の `loop` 定義を受け取り、合流ノード（merge）・条件ノード（cond）・
 * ループボディのスロット列・戻りエッジを `ctx` に積む。前置 / 後置は同じ部品で
 * **エッジの結線だけが異なる**：
 *   - `mode: 'pre'`（前置 while、既定）：`prev → merge → cond`、`cond -(false)→
 *     body[0]…body[last]`、`body[last] -(loop-out → merge.top)→ merge`（戻り）。
 *     ボディが空なら `cond -(false → merge.top)→ merge`。脱出は cond の `true`。
 *   - `mode: 'post'`（後置 do-while）：`prev → merge → body[0]…body[last] → cond`、
 *     `cond -(false → merge.top)→ merge`（戻り）。脱出は cond の `true`。
 *
 * `condition` は「脱出条件」として扱い、`true` でループを抜け `false` で継続する。
 * cond には `trueDir` / `falseDir`（出口方向）を転記し、`ConditionNode` がハンドル
 * 位置に反映する。`mode` が不正値なら `console.warn` して `pre` にフォールバック、
 * `condition` が非文字列・`body` が非配列ならループ自体を `console.warn` して
 * スキップ（`endings` / `column` を素通しで返す）。
 *
 * 座標は merge を自列の slot 中心にアンカーし、cond・body は列方式で右に並べる。
 * 戻りエッジは `targetHandle: 'top'`（merge 上辺）を指定し、描画側
 * （`AnimatedProgressEdge`）が smoothstep で上側を回す経路にする。
 *
 * Args:
 *     loopDef (object): `loop` 定義（`{mode?, condition, label?, trueDir?,
 *         falseDir?, body}`）。
 *     options (object): `processSubFlow` から渡る状態。
 *         column (number): ループ開始 column（merge を置く列）。
 *         yLevel (number): ループの y 座標。
 *         endings (Array<{nodeId, sourceHandle?}>): 直前の終端配列（merge へ繋ぐ）。
 *         ctx (object): 共有アキュムレータ。
 *
 * Returns:
 *     {endings: Array<{nodeId, sourceHandle}>, column: number}:
 *         脱出側の終端（cond の `true`）と、ループ後の次 column。
 */
function expandLoop(loopDef, { column, yLevel, endings, ctx }) {
  if (loopDef.mode !== undefined && loopDef.mode !== 'pre' && loopDef.mode !== 'post') {
    console.warn(`[stagesLoader] invalid loop mode "${loopDef.mode}", falling back to "pre"`);
  }
  const mode = loopDef.mode === 'post' ? 'post' : 'pre';

  if (typeof loopDef.condition !== 'string' || !Array.isArray(loopDef.body)) {
    console.warn('[stagesLoader] invalid loop: `condition` must be a string and `body` must be an array. Skipping.');
    return { endings, column };
  }

  ctx.condCounter += 1;
  const condId = `cond-${ctx.condCounter}`;
  ctx.mergeCounter += 1;
  const mergeId = `merge-${ctx.mergeCounter}`;
  const mergeColumn = column;

  ctx.mergeNodes.push({
    id: mergeId,
    position: {
      x: SLOT_X_START + mergeColumn * SLOT_X_STEP + SLOT_WIDTH / 2 - MERGE_SIZE / 2,
      y: yLevel + SLOT_HEIGHT / 2 - MERGE_SIZE / 2,
    },
  });

  for (const ending of endings) {
    ctx.edges.push(buildEdge(ending, mergeId));
  }

  const pushCond = (condColumn) => {
    ctx.conditions.push({
      id: condId,
      position: { x: SLOT_X_START + condColumn * SLOT_X_STEP, y: yLevel },
      expression: loopDef.condition,
      label: loopDef.label,
      trueDir: loopDef.trueDir,
      falseDir: loopDef.falseDir,
    });
  };

  if (mode === 'pre') {
    const condColumn = mergeColumn + 1;
    pushCond(condColumn);
    ctx.edges.push(buildEdge({ nodeId: mergeId }, condId));

    let bodyColumn = condColumn + 1;
    let prevId = condId;
    let prevHandle = 'false';
    let lastBodyId = null;
    for (const raw of loopDef.body) {
      const slotId = buildBodySlot(ctx, raw, {
        x: SLOT_X_START + bodyColumn * SLOT_X_STEP,
        y: yLevel,
      });
      ctx.edges.push(buildEdge({ nodeId: prevId, sourceHandle: prevHandle }, slotId));
      prevId = slotId;
      prevHandle = undefined;
      lastBodyId = slotId;
      bodyColumn += 1;
    }

    if (lastBodyId) {
      ctx.edges.push(buildEdge({ nodeId: lastBodyId, sourceHandle: 'loop-out', targetHandle: 'top' }, mergeId));
    } else {
      ctx.edges.push(buildEdge({ nodeId: condId, sourceHandle: 'false', targetHandle: 'top' }, mergeId));
    }

    return {
      endings: [{ nodeId: condId, sourceHandle: 'true' }],
      column: bodyColumn,
    };
  }

  let bodyColumn = mergeColumn + 1;
  let prevId = mergeId;
  let prevHandle = undefined;
  let lastBodyId = null;
  for (const raw of loopDef.body) {
    const slotId = buildBodySlot(ctx, raw, {
      x: SLOT_X_START + bodyColumn * SLOT_X_STEP,
      y: yLevel,
    });
    ctx.edges.push(buildEdge({ nodeId: prevId, sourceHandle: prevHandle }, slotId));
    prevId = slotId;
    prevHandle = undefined;
    lastBodyId = slotId;
    bodyColumn += 1;
  }

  const condColumn = bodyColumn;
  pushCond(condColumn);
  ctx.edges.push(buildEdge({ nodeId: lastBodyId ?? mergeId }, condId));
  ctx.edges.push(buildEdge({ nodeId: condId, sourceHandle: 'false', targetHandle: 'top' }, mergeId));

  return {
    endings: [{ nodeId: condId, sourceHandle: 'true' }],
    column: condColumn + 1,
  };
}

const GOAL_ENTRY_HANDLE = { down: 'top', up: 'bottom', left: 'right', right: undefined };

/**
 * 条件ノードの出口方向に応じて goal マーカーの配置座標を返す（純関数）。
 *
 * down / up（縦方向）は cond の中心 x に goal の中心が揃うよう
 * `(COND_WIDTH - SLOT_WIDTH) / 2` だけ右へずらし、cond の真下/真上に `LOOP_ROW_GAP`
 * 離して置く。これにより cond の下頂点と goal の上ハンドルの x が一致し、エッジが
 * 垂直になる（`flowchart-loop` 仕様の縦 exit）。right / left（横方向）は cond と同じ y
 * （同じ高さなので中心も揃う）で左右に 1 列ずらす。
 *
 * Args:
 *     condPosition ({x: number, y: number}): 条件ノードの左上座標。
 *     dir (string): 出口方向（`'down'` / `'up'` / `'left'` / `'right'`）。
 *
 * Returns:
 *     {x: number, y: number}: goal の左上座標。
 */
function goalPositionFromCond(condPosition, dir) {
  const centerX = condPosition.x + (COND_WIDTH - SLOT_WIDTH) / 2;
  switch (dir) {
    case 'down': return { x: centerX, y: condPosition.y + LOOP_ROW_GAP };
    case 'up':   return { x: centerX, y: condPosition.y - LOOP_ROW_GAP };
    case 'left': return { x: condPosition.x - SLOT_X_STEP, y: condPosition.y };
    case 'right':
    default:     return { x: condPosition.x + SLOT_X_STEP, y: condPosition.y };
  }
}

/**
 * goal の配置座標と goal 側の接続ハンドルを、最終終端から解決する（純関数）。
 *
 * 3 経路の判定順序：
 *   1. **最終終端が条件ノードの true / false 出口**（`flowchart-loop` 仕様）：
 *      その出口方向（`trueDir` / `falseDir`、未指定なら right / down）に応じて
 *      `goalPositionFromCond` で配置し、goal の入口ハンドルを `GOAL_ENTRY_HANDLE`
 *      （down→`'top'` / up→`'bottom'` / left→`'right'` / right→既定の Left）に
 *      決める。縦方向 exit で cond の直下 / 直上へ垂直なエッジを作るための仕組み。
 *   2. **`result.direction === 'left'`**（`flowchart-turn` 仕様）：折り返し後に
 *      左方向に進んできた最終終端の場合、goal を行 2 の左端
 *      （x = `SLOT_X_START + result.endColumn * SLOT_X_STEP`、
 *      y = `result.yLevel`）に置き、`targetHandle: 'right-in'`（goal の右辺入口）と
 *      `sourceHandle: 'left-out'`（最終スロットの左辺出口）を返す。`expandFlow` 側で
 *      最終エッジに両ハンドルを付与することで、左向きエッジが正しく描画される。
 *   3. **それ以外**（従来の右向き線形 / 分岐ステージで最終終端が merge のケース）：
 *      従来どおりメイン経路の最終 column の次に置き、ハンドルは既定（Left）。
 *
 * cond 出口判定を最優先する理由：将来 turn と cond の組み合わせ（turn 後に cond
 * が来るケース）が出てきた場合、cond の出口方向の方がプレイヤーに与える視覚情報量
 * が多いため。今回スコープでは cond が turn 後に来るケースはないので実害なし。
 *
 * Args:
 *     result ({endings: Array, endColumn: number, direction: string,
 *             yLevel: number}): `processSubFlow` の戻り値。`direction` と
 *         `yLevel` は `flowchart-turn` 仕様の左向き判定で使う。
 *     ctx (object): 共有アキュムレータ。`conditions` を参照する。
 *
 * Returns:
 *     {position: {x: number, y: number}, targetHandle: string | undefined,
 *      sourceHandle?: string}:
 *         goal の左上座標、goal 側の接続ハンドル id（既定接続は undefined）、
 *         および `flowchart-turn` 左向きケースで最終エッジに付ける `sourceHandle`
 *         （それ以外は undefined）。
 */
function resolveGoalPlacement(result, ctx) {
  const lastEnding = result.endings[0];
  if (lastEnding) {
    const cond = ctx.conditions.find((c) => c.id === lastEnding.nodeId);
    if (cond && (lastEnding.sourceHandle === 'true' || lastEnding.sourceHandle === 'false')) {
      const dir = lastEnding.sourceHandle === 'true'
        ? (cond.trueDir ?? 'right')
        : (cond.falseDir ?? 'down');
      return {
        position: goalPositionFromCond(cond.position, dir),
        targetHandle: GOAL_ENTRY_HANDLE[dir],
      };
    }
  }
  if (result.direction === 'left') {
    return {
      position: {
        x: SLOT_X_START + result.endColumn * SLOT_X_STEP, 
        y: result.yLevel,
      },
      targetHandle: 'right-in',
      sourceHandle: 'left-out',
    };
  }
  return {
    position: { x: SLOT_X_START + result.endColumn * SLOT_X_STEP, y: 120 },
    targetHandle: undefined,
  };
}

/**
 * `flow` 形式のステージ定義を完全形式に展開する公開関数。
 *
 * `stages.json` のステージに `flow` キーがある場合、`expandStage` がこの
 * 関数を呼び出して `{ slots, conditions, edges, start, goal }` の完全形式
 * オブジェクトを得る。`flow` 配列を `processSubFlow` で再帰的に展開し、
 * 最後にメイン経路の終端を `goal` に繋ぐエッジを追加する。`start` は固定
 * 座標（`x: -120, y: 120`）、`goal` は `resolveGoalPlacement` で配置する（最終
 * 終端が条件ノードの出口ならその出口方向へ 1 ステップ、そうでなければ従来どおり
 * メイン経路の最終 column の次）。
 *
 * 不正な入力（`flow` が配列でない場合）は `console.warn` で警告ログを出し、
 * 空のステージ相当の戻り値を返してアプリのクラッシュを防ぐ。
 *
 * `ctx` 初期化（`flowchart-turn` 仕様）：`processSubFlow` が共有するアキュムレータ
 * `ctx` に、既存の `slotCounter` / `condCounter` / `mergeCounter` / `slots[]` /
 * `conditions[]` / `mergeNodes[]` / `edges[]` に加えて `turnCount: 0`（同一 flow
 * 内で turn が出現した回数を数え、2 個目以降を warn + skip するため、要件 5-4）と
 * `afterTurn: false`（turn 直後の 1 エッジに `down-out` / `top` ハンドルを付与する
 * 一時フラグ、タスク 2 で実装）を持たせる。turn を含まないステージでは両フィールドは
 * 初期値のままで他フィールドに影響を与えない。
 *
 * `processSubFlow` の最初の呼び出しでは `isTopLevel: true` / `direction: 'right'` を
 * 明示的に渡す（既定値ではなく明示することで「ここが最上位」という設計意図がコードで
 * 伝わる）。`isTopLevel` は turn のバリデーション（top-level 以外なら warn + skip、
 * 要件 6）で使われ、`direction` は通常スロットの x 座標増減と turn 後の左方向展開の
 * 判定で使われる。
 *
 * 最終 goal エッジ生成（`flowchart-turn` 仕様）：`resolveGoalPlacement` が返す
 * `goalPlacement.sourceHandle`（左向きケースで `'left-out'`、それ以外は undefined）を
 * `buildEdge` に渡すとき、`goalPlacement.sourceHandle ?? ending.sourceHandle` の
 * フォールバックで決定する。これにより、既存パス（cond 出口の `true` / `false` を
 * sourceHandle として持つ ending）は `goalPlacement.sourceHandle === undefined` の
 * ためそのまま `ending.sourceHandle` を採用し、turn 由来の左向きケースのみ
 * `goalPlacement.sourceHandle === 'left-out'` を優先採用する。既存ステージへの
 * 非破壊性を担保する（要件 7）。
 *
 * Args:
 *     flow (Array<object>): `stage.flow` 配列。階層構造で通常スロット要素と
 *         条件分岐要素、ループ要素、turn 要素を並べる。
 *
 * Returns:
 *     {slots, conditions, edges, start, goal}: 完全形式のステージ要素。
 *         `expandStage` でこれを `enemyId` / `cards` と合わせて返す。
 */
function expandFlow(flow) {
  const ctx = {
    slotCounter: 0,
    condCounter: 0,
    mergeCounter: 0,
    slots: [],
    conditions: [],
    mergeNodes: [],
    edges: [],
    turnCount: 0,
    afterTurn: false,
  };

  if (!Array.isArray(flow)) {
    console.warn('[stagesLoader] `flow` must be an array');
    return {
      slots: [],
      conditions: [],
      mergeNodes: [],
      edges: [],
      start: { position: { x: -120, y: 120 } },
      goal: { position: { x: 80, y: 120 } },
    };
  }

  const result = processSubFlow(flow, {
    startColumn: 0,
    yLevel: 120,
    prevNodeId: 'start',
    prevSourceHandle: undefined,
    ctx,
    isTopLevel: true,
    direction: 'right',
  });

  const goalPlacement = resolveGoalPlacement(result, ctx);
  for (const ending of result.endings) {
    ctx.edges.push(buildEdge({ 
      ...ending, 
      sourceHandle: goalPlacement.sourceHandle ?? ending.sourceHandle,
      targetHandle: goalPlacement.targetHandle,
    }, 'goal'));
  }

  return {
    slots: ctx.slots,
    conditions: ctx.conditions,
    mergeNodes: ctx.mergeNodes,
    edges: ctx.edges,
    start: { position: { x: -120, y: 120 } },
    goal: { position: goalPlacement.position },
  };
}

/**
 * 条件分岐ノード配列を完全形式に展開する。
 *
 * `stage.conditions` は分岐ステージにのみ存在する optional フィールド。
 * 未定義（線形ステージ）の場合は空配列を返し、呼び出し側が「すべての
 * ステージで `stage.conditions` が配列である」前提で扱えるようにする。
 *
 * 各条件オブジェクトからは `id` / `position` / `expression` / `label` /
 * `trueDir` / `falseDir` の 6 フィールドを抽出してコピーする。`trueDir` /
 * `falseDir` は true / false ソースハンドルの出口方向（optional、ConditionNode で
 * 既定 right / down にフォールバック）。`label` は optional で、ConditionNode
 * の表示テキストとして `expression` より優先される（小学生向けに自然言語の
 * 説明文を別途与えるための仕組み、例: `expression="playerHp > 50"` に対して
 * `label="playerHpが50より大きい"`）。判定ロジックは常に `expression` を
 * 使うので、`label` の有無で分岐挙動は変わらない。将来 `condition` に追加
 * フィールド（アニメーションオプション等）が増えても、ここで明示的に列挙
 * することで後方互換性を保つ。
 *
 * Args:
 *     conditions (Array<{id, position, expression, label?}> | undefined):
 *         ステージ定義の `conditions` フィールド。未定義可。
 *
 * Returns:
 *     Array<{id, position, expression, label?, trueDir?, falseDir?}>:
 *         完全形式の条件分岐ノード配列。未定義時は空配列。
 */
function expandConditions(conditions) {
  if (!conditions) return [];
  return conditions.map((raw) => ({
    id: raw.id,
    position: raw.position,
    expression: raw.expression,
    label: raw.label,
    trueDir: raw.trueDir,
    falseDir: raw.falseDir,
  }));
}

/**
 * ステージ単位で counter / counterRef のペア整合性を検証する
 * （`loop-counter` 仕様）。
 *
 * `expandStage` の両ルート（flow / slots）の最終ステップで呼ばれ、`stage.slots` を
 * 2 度走査して以下の不正状態を検出・無害化する：
 *   1. **重複 counterId**（要件 11-2）：同じ `counterId` を持つ counter スロットが
 *      複数存在する場合、最初に出現したものだけを有効とし、2 つ目以降は
 *      `slot.lockedCard = { id: 'counter' }` に縮退（counterId を剥がして通常 lockedCard
 *      扱い）して `console.warn` を出す。ランタイム側は剥がされた counter を「カウンタ
 *      機能のない locked スロット」として処理するため、ステージは描画・実行が継続する。
 *   2. **浮遊 counterRef**（要件 2-5 / 11-1）：`multiplier` がオブジェクト形式の場合に、
 *      参照先 `counterRef` が同ステージ内のいずれの有効な `counterId` とも一致しない
 *      場合、`delete slot.multiplier` で multiplier キーを削除して `console.warn`
 *      を出す。`slot.multiplier === undefined` となるため、後段の
 *      `buildSlotMetadataFromStage` が「倍率未指定 = 1 倍」と扱い、既存の未指定
 *      スロットと同じ後方互換パスで実行される。
 *
 * **二段ループの順序が必須**：第 1 ループで「有効な counterId 集合」を確定してから、
 * 第 2 ループで multiplier 側の参照を照合する。1 ループで同時にやると、後に出現する
 * counter を先に出現する multiplier が参照できないため誤検出する。
 *
 * **既に縮退済みの counter の二重警告を防ぐ**：タスク 3 のフォールバックで counterId が
 * 剥がされた `{ id: 'counter' }` は `typeof slot.lockedCard.counterId === 'string'` の
 * 型ガードで第 1 ループからスキップされる。これにより、同一エラーで二重に警告が出ない。
 *
 * **mutation の安全性**：`stage.slots` の各要素は `expandSlots` / `expandFlow` で
 * 新たに作られたオブジェクトなので、`slot.lockedCard = {...}` や `delete slot.multiplier`
 * で原 JSON（`raw.lockedCard`）を汚染しない。
 *
 * Args:
 *     stage (object): 完全形式に展開済みのステージ。`slots[]` を持ち、各スロットは
 *         `{id, position, lockedCard?, acceptOnly?, multiplier?}` の形。本関数の副作用で
 *         不正状態のスロットの `lockedCard` / `multiplier` が無害化されることがある。
 *     stageId (string): 当該ステージの ID。警告ログに含めて該当箇所を特定しやすくする。
 *
 * Returns:
 *     undefined: 戻り値は使わない。`stage` を in-place で書き換えるだけ。
 */
function validateCounterPairs(stage, stageId) {
  const seenCounterIds = new Set();
  for (const slot of stage.slots) {
    if (slot.lockedCard?.id === 'counter' && typeof slot.lockedCard.counterId === 'string') {
      const cid = slot.lockedCard.counterId;
      if (seenCounterIds.has(cid)) {
        console.warn(`[stagesLoader] stage "${stageId}" slot "${slot.id}": duplicate counterId "${cid}". Treating as plain lockedCard.`);
        slot.lockedCard = { id: 'counter' };
      } else {
        seenCounterIds.add(cid);
      }
    }
  }
  for (const slot of stage.slots) {
    if (typeof slot.multiplier === 'object' && slot.multiplier !== null) {
      const ref = slot.multiplier.counterRef;
      if (!seenCounterIds.has(ref)) {
        console.warn(`[stagesLoader] stage "${stageId}" slot "${slot.id}": counterRef "${ref}" not found in stage. Ignoring multiplier.`);
        delete slot.multiplier;
      }
    }
  }
}

/**
 * ステージ定義から「登場する特殊マスの種別 ID」を収集する（ヘルプ用）。
 *
 * マス説明ヘルプ（`HelpWindow` のマスカテゴリ）は、まだ出会っていない
 * 種別のマスの説明を「？？？マス」と伏せる。その既出判定のために、
 * 各ステージにどの特殊マスが登場するかを展開時に洗い出し、展開後ステージの
 * `slotTypeIds` フィールドとして持たせる。`BattleScreen` がバトル入場時に
 * これを `progressStore.markSlotTypesSeen` へ渡す。
 *
 * 収集は **raw（短縮形式）のステージ定義** に対して行う。ループは展開後には
 * 条件ノード＋合流ノード＋戻りエッジに分解されてしまい、展開後データからは
 * 「条件分岐」と「ループ」を区別できないため、展開前の `flow` 構造を再帰的に
 * 歩いて判定する。収集する種別 ID は `slot_help.json` の `id` と一致させる：
 *   - `condition`  : 条件分岐要素（`{condition, true, false}`）
 *   - `loop`       : ループ要素（`{loop: {...}}`）。body 内も再帰する
 *   - `multiplier` : 数値リテラルの倍率スロット（`multiplier: 2` 等）
 *   - `acceptOnly` : カード種別制限スロット（`acceptOnly: 'attack'` 等）
 *   - `counter`    : パワーアップ（カウンタ）マス。カウンタ本体
 *     （`lockedCard.id === 'counter'`）と、カウンタ連動倍率
 *     （`multiplier: {counterRef}`）はペアで同じ仕組みなので同一種別に寄せる
 * `turn`（折り返し）はマスではなく配置の折り返し指示なので収集しない。
 *
 * Args:
 *     raw (object): `stages.json` 内の 1 ステージ分（短縮形式）。`flow` または
 *         `slots` を持つ。
 *
 * Returns:
 *     string[]: 登場する特殊マス種別 ID の配列（重複なし）。特殊マスの無い
 *         ステージでは空配列。
 */
function collectSlotTypeIds(raw) {
  const ids = new Set();
  const visitSlot = (item) => {
    if (item.lockedCard?.id === 'counter') {
      ids.add('counter');
    }
    if (item.acceptOnly) {
      ids.add('acceptOnly');
    }
    if (Number.isInteger(item.multiplier)) {
      ids.add('multiplier');
    }
    if (typeof item.multiplier === 'object' && item.multiplier !== null) {
      ids.add('counter');
    }
  };
  const visitFlow = (items) => {
    if (!Array.isArray(items)) {
      return;
    }
    for (const item of items) {
      if (isLoop(item)) {
        ids.add('loop');
        visitFlow(item.loop.body);
      } else if (isCondition(item)) {
        ids.add('condition');
        visitFlow(item.true);
        visitFlow(item.false);
      } else if (!isTurn(item)) {
        visitSlot(item);
      }
    }
  };
  if (raw.flow) {
    visitFlow(raw.flow);
  } else {
    (raw.slots ?? []).forEach(visitSlot);
  }
  return Array.from(ids);
}

/**
 * 1 ステージ分の定義を完全形式に展開する。
 *
 * ステージ定義の形式によって 2 つのルートに分岐する：
 *   - `raw.flow` が存在する場合：`expandFlow` を呼び出して階層構造の
 *     `flow` 配列から `slots` / `conditions` / `edges` / `start` / `goal` を
 *     自動生成する（条件分岐を含む短縮形式、`loader-branching-shortcut` 仕様）。
 *     両方のキーが定義されていた場合は `console.warn` で警告を残し、
 *     `flow` を優先する。
 *   - そうでない場合：従来の `slots` ベースのルート。`expandSlots` /
 *     `expandStart` / `expandGoal` / `buildLinearEdges` を順に呼び出し、
 *     `raw.slots` の短縮形式から完全形式を組み立てる。`edges` は `raw.edges`
 *     が明示されていればそれを尊重し、未定義の場合のみ線形生成する。
 *
 * `cards` フィールドはどちらのルートでも展開を経由せず、`raw.cards` を
 * そのまま渡す（カード定義自体は短縮の余地が少なく、ステージごとに必須
 * 要素のため）。両ルートの戻り値オブジェクトは同じ形状
 * （`{ enemyId, cards, slots, conditions, start, goal, edges }`）なので、
 * 後段の `battleStore` / `FlowchartArea` は形式の違いを意識せず動作する。
 *
 * **`validateCounterPairs` の呼び出し**（`loop-counter` 仕様）：両ルートとも、
 * `stage` オブジェクトを組み立てた **直後** に `validateCounterPairs(stage, stageId)`
 * を呼び、counter / counterRef のペア整合性（重複 counterId・浮遊 counterRef）を
 * 検証する。検証で不整合があれば該当スロットの `lockedCard` / `multiplier` が
 * in-place で無害化され、ランタイムには常に整合した state が渡される。flow ルート
 * でも slots ルートでも同一の検証規則を適用するため、将来 slots ルートのステージで
 * counter / counterRef を使っても同じガードが効く。
 *
 * Args:
 *     raw (object): `stages.json` 内の 1 ステージ分。`enemyId` / `cards` は
 *         必須。`flow` を使う場合は `slots` / `conditions` / `edges` /
 *         `start` / `goal` は不要。`slots` を使う場合は短縮形式（各スロット
 *         の `id` / `position` 省略可能、`lockedCard` / `acceptOnly` も任意）
 *         または完全形式どちらでも可。
 *     stageId (string): 当該ステージの ID（`stages.json` のキー）。`expandSlots`
 *         および `validateCounterPairs` に渡して警告ログに含めるためのもの。
 *
 * Returns:
 *     object: 完全形式の 1 ステージ定義。`battleStore.initializeBattle` /
 *         `FlowchartArea` が期待する形。`validateCounterPairs` の副作用で
 *         不正な counter / counterRef は無害化済み。
 */
function expandStage(raw, stageId) {
  if (raw.flow) {
    if (raw.slots) {
      console.warn(
        '[stagesLoader] both `flow` and `slots` defined for stage, using `flow`',
      );
    }
    const expanded = expandFlow(raw.flow);
    const stage = {
      enemyId: raw.enemyId,
      maxEnemyHp: raw.maxEnemyHp,
      cards: raw.cards ?? [],
      slotTypeIds: collectSlotTypeIds(raw),
      ...expanded,
    };
    validateCounterPairs(stage, stageId);
    return stage;
  }
  const slots = expandSlots(raw.slots ?? [], stageId);
  const stage = {
    enemyId: raw.enemyId,
    maxEnemyHp: raw.maxEnemyHp,
    cards: raw.cards ?? [],
    slotTypeIds: collectSlotTypeIds(raw),
    slots,
    conditions: expandConditions(raw.conditions),
    mergeNodes: [],
    start: expandStart(raw.start),
    goal: expandGoal(raw.goal, slots.length),
    edges: raw.edges ?? buildLinearEdges(slots),
  };
  validateCounterPairs(stage, stageId);
  return stage;
}

/**
 * 1 ステージ分の定義を、第二形態（`secondPhase`）込みで完全形式に展開する。
 *
 * 本体は `expandStage` に委譲し、raw 定義に `secondPhase`（ボスの第二形態。
 * 最終ボス 4-4 で使用）があれば、それも同じ `expandStage` で展開して
 * `stage.secondPhase` に取り付ける。第二形態側には以下の 2 フィールドを付与する：
 *   - `isSecondPhase: true`  : `battleStore.initializeBattle` が「今は第二形態」
 *     フラグを立てるための印。`startExecution` の加速実行（ループのたびに
 *     フェーズ時間が短くなる演出）の有効化判定にも使う
 *   - `enemyId` の継承       : `secondPhase.enemyId` が未指定なら親ステージの
 *     `enemyId` を引き継ぐ（第二形態は同じ敵の見た目を使い回す想定のため）
 *
 * 第二形態の入れ子（`secondPhase.secondPhase`）は展開しない（1 段のみ）。
 *
 * Args:
 *     raw (object): `stages.json` 内の 1 ステージ分（短縮形式）。任意で
 *         `secondPhase`（同じ短縮形式のステージ定義）を持つ。
 *     stageId (string): 当該ステージの ID。警告ログ用。
 *
 * Returns:
 *     object: 完全形式の 1 ステージ定義。`secondPhase` があれば展開済みの
 *         第二形態ステージ（`isSecondPhase: true` 付き）を同名フィールドに持つ。
 */
function expandStageWithPhases(raw, stageId) {
  const stage = expandStage(raw, stageId);
  if (typeof raw.secondPhase === 'object' && raw.secondPhase !== null) {
    const secondRaw = { enemyId: raw.enemyId, ...raw.secondPhase };
    const second = expandStage(secondRaw, `${stageId} (secondPhase)`);
    second.isSecondPhase = true;
    stage.secondPhase = second;
  }
  return stage;
}

const expandedStages = {};
for (const [key, raw] of Object.entries(rawStagesData.stages)) {
  expandedStages[key] = expandStageWithPhases(raw, key);
}

const stagesData = {
  demoStageIds: rawStagesData.demoStageIds,
  stages: expandedStages,
};

export default stagesData;
