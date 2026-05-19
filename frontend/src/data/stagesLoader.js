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
 * サブフロー（メイン経路 or 分岐経路）を再帰的に展開する内部ヘルパー。
 *
 * `items` 配列の各要素を順に走査し、通常スロット要素なら `ctx.slots` に
 * 連番採番で追加、条件分岐要素なら `ctx.conditions` に追加した上で
 * `true` / `false` の各経路を再帰的に展開する。エッジは「直前の終端
 * （`endings`）から、いま作ったノードへ」の方向で `ctx.edges` に追加する。
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
 *         startColumn (number): このサブフローの開始 column。
 *         yLevel (number): このサブフローの y 座標。
 *         prevNodeId (string): 直前の終端ノード id。
 *         prevSourceHandle (string | undefined): 直前の終端が条件分岐から
 *             の分岐エッジである場合の `sourceHandle`（`'true'` / `'false'`）。
 *         ctx (object): 共有のアキュムレータ。`slotCounter` / `condCounter` /
 *             `slots[]` / `conditions[]` / `edges[]` を持つ。
 *
 * Returns:
 *     {endings: Array<{nodeId, sourceHandle?}>, endColumn: number}:
 *         このサブフロー処理後の終端ノード配列と、使い終わった column 値。
 */
function processSubFlow(items, { startColumn, yLevel, prevNodeId, prevSourceHandle, ctx }) {
  let column = startColumn;
  let endings = [{ nodeId: prevNodeId, sourceHandle: prevSourceHandle }];

  for (const item of items) {
    if (isCondition(item)) {
      ctx.condCounter += 1;
      const condId = `cond-${ctx.condCounter}`;
      ctx.conditions.push({
        id: condId,
        position: { x: 80 + column * 200, y: yLevel },
        expression: item.condition,
        label: item.label,
      });
      for (const ending of endings) {
        ctx.edges.push(buildEdge(ending, condId));
      }
      column += 1;

      const trueItems = item.true ?? [];
      const trueResult = processSubFlow(trueItems, {
        startColumn: column,
        yLevel,
        prevNodeId: condId,
        prevSourceHandle: 'true',
        ctx,
      });

      const falseItems = item.false ?? [];
      const falseResult = processSubFlow(falseItems, {
        startColumn: column,
        yLevel: yLevel + 160,
        prevNodeId: condId,
        prevSourceHandle: 'false',
        ctx,
      });

      const mergeColumn = Math.max(trueResult.endColumn, falseResult.endColumn);
      ctx.mergeCounter += 1;
      const mergeId = `merge-${ctx.mergeCounter}`;
      ctx.mergeNodes.push({
        id: mergeId,
        position: {
          x: SLOT_X_START + mergeColumn * SLOT_X_STEP - SLOT_X_STEP / 2 + SLOT_WIDTH / 2 - MERGE_SIZE / 2,
          y: yLevel + SLOT_HEIGHT / 2 - MERGE_SIZE / 2,
        },
      });

      for (const ending of trueResult.endings) {
        ctx.edges.push(buildEdge(ending, mergeId));
      }
      for (const ending of falseResult.endings) {
        ctx.edges.push(buildEdge({ ...ending, targetHandle: 'bottom' }, mergeId));
      }

      endings = [{ nodeId: mergeId, sourceHandle: undefined }];
      column = mergeColumn;
    } else {
      ctx.slotCounter += 1;
      const slotId = `slot-${ctx.slotCounter}`;
      const slot = {
        id: slotId,
        position: { x: SLOT_X_START + column * SLOT_X_STEP, y: yLevel },
      };
      if (item.lockedCard) {
        slot.lockedCard = item.lockedCard;
      }
      ctx.slots.push(slot);
      for (const ending of endings) {
        ctx.edges.push(buildEdge(ending, slotId));
      }
      endings = [{ nodeId: slotId, sourceHandle: undefined }];
      column += 1;
    }
  }

  return { endings, endColumn: column };
}

/**
 * `flow` 形式のステージ定義を完全形式に展開する公開関数。
 *
 * `stages.json` のステージに `flow` キーがある場合、`expandStage` がこの
 * 関数を呼び出して `{ slots, conditions, edges, start, goal }` の完全形式
 * オブジェクトを得る。`flow` 配列を `processSubFlow` で再帰的に展開し、
 * 最後にメイン経路の終端を `goal` に繋ぐエッジを追加する。`start` は固定
 * 座標（`x: -120, y: 120`）、`goal` はメイン経路の最終 column の次に配置。
 *
 * 不正な入力（`flow` が配列でない場合）は `console.warn` で警告ログを出し、
 * 空のステージ相当の戻り値を返してアプリのクラッシュを防ぐ。
 *
 * Args:
 *     flow (Array<object>): `stage.flow` 配列。階層構造で通常スロット要素と
 *         条件分岐要素を並べる。
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
  });

  for (const ending of result.endings) {
    ctx.edges.push(buildEdge(ending, 'goal'));
  }

  return {
    slots: ctx.slots,
    conditions: ctx.conditions,
    mergeNodes: ctx.mergeNodes,
    edges: ctx.edges,
    start: { position: { x: -120, y: 120 } },
    goal: { position: { x: 80 + result.endColumn * 200, y: 120 } },
  };
}

/**
 * 条件分岐ノード配列を完全形式に展開する。
 *
 * `stage.conditions` は分岐ステージにのみ存在する optional フィールド。
 * 未定義（線形ステージ）の場合は空配列を返し、呼び出し側が「すべての
 * ステージで `stage.conditions` が配列である」前提で扱えるようにする。
 *
 * 各条件オブジェクトからは `id` / `position` / `expression` / `label`
 * の 4 フィールドを抽出してコピーする。`label` は optional で、ConditionNode
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
 *     Array<{id, position, expression, label?}>:
 *         完全形式の条件分岐ノード配列。未定義時は空配列。
 */
function expandConditions(conditions) {
  if (!conditions) return [];
  return conditions.map((raw) => ({
    id: raw.id,
    position: raw.position,
    expression: raw.expression,
    label: raw.label,
  }));
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
 * Args:
 *     raw (object): `stages.json` 内の 1 ステージ分。`enemyId` / `cards` は
 *         必須。`flow` を使う場合は `slots` / `conditions` / `edges` /
 *         `start` / `goal` は不要。`slots` を使う場合は短縮形式（各スロット
 *         の `id` / `position` 省略可能）または完全形式どちらでも可。
 *
 * Returns:
 *     object: 完全形式の 1 ステージ定義。`battleStore.initializeBattle` /
 *         `FlowchartArea` が期待する形。
 */
function expandStage(raw) {
  if (raw.flow) {
    if (raw.slots) {
      console.warn(
        '[stagesLoader] both `flow` and `slots` defined for stage, using `flow`',
      );
    }
    const expanded = expandFlow(raw.flow);
    return {
      enemyId: raw.enemyId,
      cards: raw.cards ?? [],
      ...expanded,
    };
  }
  const slots = expandSlots(raw.slots ?? []);
  return {
    enemyId: raw.enemyId,
    cards: raw.cards ?? [],
    slots,
    conditions: expandConditions(raw.conditions),
    mergeNodes: [],
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
  demoStageIds: rawStagesData.demoStageIds,
  stages: expandedStages,
};

export default stagesData;
