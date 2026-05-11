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
 *     stagesData (object): `{ demoStageId, stages }` 形式の完全形式ステージ
 *         データ。既存の `stages.json` を直接 import していた箇所は、本
 *         モジュールに import パスを差し替えるだけで動作する（形状が完全互換）。
 */

import rawStagesData from './stages.json';

const SLOT_X_START = 80;
const SLOT_X_STEP = 200;
const SLOT_Y_DEFAULT = 120;
const START_X = -120;

/**
 * スロット配列を完全形式に展開する。
 *
 * 各スロットについて、`id` が未指定なら `slot-${index+1}` を自動採番し、
 * `position` が未指定なら `SLOT_X_START + index * SLOT_X_STEP` を x 座標、
 * `SLOT_Y_DEFAULT` を y 座標として等間隔配置する。`lockedCard` は定義
 * されている場合のみコピーする（未定義のスロットに `lockedCard: undefined`
 * フィールドが付かないように分岐）。
 *
 * Args:
 *     slots (Array<object>): 短縮または完全形式のスロット配列。各要素は
 *         空オブジェクト `{}` から完全指定の `{id, position, lockedCard}`
 *         まで任意の指定度を取れる。
 *
 * Returns:
 *     Array<{id: string, position: {x: number, y: number}, lockedCard?: object}>:
 *         完全形式のスロット配列。`battleStore` / `FlowchartArea` がそのまま
 *         受け取れる形。
 */
function expandSlots(slots) {
  return slots.map((raw, index) => {
    const id = raw.id ?? `slot-${index + 1}`;
    const position = raw.position ?? {
      x: SLOT_X_START + index * SLOT_X_STEP,
      y: SLOT_Y_DEFAULT,
    };
    const expanded = { id, position };
    if (raw.lockedCard) {
      expanded.lockedCard = raw.lockedCard;
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
 * 1 ステージ分の短縮形式定義を完全形式に展開する。
 *
 * 各補完ヘルパー（`expandSlots` / `expandStart` / `expandGoal` /
 * `buildLinearEdges`）を順に呼び出し、`slots` を展開した結果を `start` /
 * `goal` / `edges` の自動補完で参照する。`edges` は `raw.edges` が
 * 明示されていればそれを尊重し、未定義の場合のみ `buildLinearEdges` で
 * 線形生成する。
 *
 * `cards` フィールドは展開を経由せず、`raw.cards` をそのまま渡す（カード
 * 定義自体は短縮の余地が少なく、ステージごとに必須要素のため）。
 *
 * Args:
 *     raw (object): `stages.json` 内の 1 ステージ分。`enemyId` / `cards` /
 *         `slots` は必須、`start` / `goal` / `edges` および各スロットの
 *         `id` / `position` は省略可能。
 *
 * Returns:
 *     object: 完全形式の 1 ステージ定義。`battleStore.initializeBattle` /
 *         `FlowchartArea` が期待する形。
 */
function expandStage(raw) {
  const slots = expandSlots(raw.slots ?? []);
  return {
    enemyId: raw.enemyId,
    cards: raw.cards ?? [],
    slots,
    start: expandStart(raw.start),
    goal: expandGoal(raw.goal, slots.length),
    edges: raw.edges ?? buildLinearEdges(slots),
  };
}

const expandedStages = {};
for (const [key, raw] of Object.entries(rawStagesData.stages)) {
  expandedStages[key] = expandStage(raw);
}

const stagesData = {
  demoStageId: rawStagesData.demoStageId,
  stages: expandedStages,
};

export default stagesData;
