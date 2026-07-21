import { Handle, Position } from '@xyflow/react';
import useBattleStore from '../../../stores/battleStore';
import styles from './ConditionNode.module.css';

const DIRECTION_TO_POSITION = {
  right: Position.Right,
  left: Position.Left,
  up: Position.Top,
  down: Position.Bottom,
};

/**
 * 方向文字列（`'right'` / `'left'` / `'up'` / `'down'`）を React Flow の
 * `Position` に変換する。
 *
 * `stages.json` の `trueDir` / `falseDir` に書かれた方向を、ConditionNode の
 * true / false ソースハンドルを配置する辺へ対応づける。未指定（`undefined`）
 * のときは「省略＝既定方向」の正常系なので警告せず `fallback` を返す。未知の
 * 文字列（タイポ等）のときだけ `console.warn` を出して `fallback` を返し、
 * 不正なステージ定義でも描画が落ちないようにする。
 *
 * Args:
 *     dir (string | undefined): 方向文字列。未指定可。
 *     fallback (Position): 未指定・不正時に返す既定の `Position`。
 *
 * Returns:
 *     Position: 対応する React Flow の `Position`。
 */
function directionToPosition(dir, fallback) {
  if (dir === undefined) return fallback;
  const position = DIRECTION_TO_POSITION[dir];
  if (position === undefined) {
    console.warn(`[ConditionNode] invalid direction "${dir}", falling back`);
    return fallback;
  }
  return position;
}

/**
 * フローチャート上の条件分岐ノードを表す React Flow カスタムノード。
 *
 * `stages.json` の `conditions[]` から構築されるノードで、菱形の見た目で
 * 描画される。中央に条件式テキスト（例: `playerHp > 50`）を表示し、実行
 * シーケンスがこのノードに到達した時点で `evaluateCondition` の結果に応じて
 * Yes / No の経路が選ばれる（`map-2-stage-1` 要件 1-1〜1-3）。条件式評価
 * 自体は `battleStore` 側の `selectNextEdge` で行い、本コンポーネントは
 * **視覚要素とハンドルの提供** に責務を限定する。
 *
 * Handle 構成（5 つ）：
 *   - Left（target、デフォルト id）：標準的な「左から入ってくるエッジ」用。
 *     rightward 文脈で線形フローの延長として条件ノードに到達する基本ケース。
 *   - Top（target、`id="top"`）：将来「上からエッジが入ってくる」レイアウト
 *     用の予備ハンドル。エッジ側で `targetHandle: 'top'` を指定したときに
 *     接続される（要件 1-5 の拡張性確保）。
 *   - **Right（target、`id="right-in"`、`flowchart-turn` 第 2 弾仕様）**：
 *     leftward 文脈で「右から入ってくるエッジ」（直前 slot の `left-out`、
 *     直前 merge の `left-out`、または直前 cond の `'true'` 出口で trueDir='left'
 *     の場合）を受ける。turn を含まないステージや rightward 文脈では未使用ハンドル
 *     として無害に存在する。`SlotNode` / `GoalNode` / `MergeNode` の `right-in`
 *     と同じ命名規約・同じ意味（左向きエッジを受ける右辺）。
 *   - source（`id="true"`）：条件評価結果が `true`（脱出 / Yes）のとき進む経路。
 *     配置する辺は `data.trueDir`（`'right'` / `'left'` / `'up'` / `'down'`）で
 *     決まり、未指定なら既定 Right（菱形の右頂点）。エッジ側で `sourceHandle: 'true'`。
 *     leftward 文脈ではローダーが `trueDir: 'left'` を既定値として渡すため、自動的に
 *     左辺へ配置され「はい」ラベルも左辺基準で出る（`flowchart-turn` 要件 10-1）。
 *   - source（`id="false"`）：条件評価結果が `false`（継続 / No）のとき進む経路。
 *     配置する辺は `data.falseDir` で決まり、未指定なら既定 Bottom（菱形の下頂点）。
 *     エッジ側で `sourceHandle: 'false'`。向きを変えても **id は不変** なので
 *     分岐ロジック（`battleStore.selectNextEdge`）には一切影響しない。leftward 文脈
 *     でも `falseDir` は方向不問の `'down'` が既定（false 分岐は常に行 3 = 下段に
 *     並ぶため、`flowchart-turn` 要件 10-2）。
 *
 * 視覚演出は既存 `SlotNode` と同じパターンで以下を提供：
 *   - `executionStep` が自身に一致 → `.active` クラスで点滅発光
 *     （`@keyframes conditionHighlight`）
 *   - `traversedNodeIds` に自身の id を含む → `.traversed` クラスで固定発光
 *     （実行終了後の経路振り返り、要件 4-1）
 *
 * 条件分岐ノードは dnd-kit のドロップターゲットではない（`useDroppable` を
 * 呼ばない）。カードを配置する概念がないため。
 *
 * 表示テキストは「子ども（小学生）にも条件が読める」よう、`label`（自然言語
 * の説明文、例: `"playerHpが50より大きい"`）が指定されていればそれを優先表示
 * し、未指定なら `expression`（評価用の式、例: `"playerHp > 50"`）に
 * フォールバックする。判定ロジック側（`battleStore.selectNextEdge` →
 * `evaluateCondition`）には常に `expression` が渡されるため、ラベルは純粋に
 * 視覚表現を差し替えるだけで分岐挙動には影響しない。`??` 演算子による
 * フォールバックなので、`label: ""`（空文字）を意図的に渡せば空表示も可能
 * （ラベル未定義時のみフォールバックされる）。`label` / `expression` が
 * ともに未定義の異常時は最終フォールバックの `?? ''` で空文字になり、
 * `undefined` 表示やフォントサイズ計算（`text.length`）のクラッシュを防ぐ。
 *
 * 表示テキストのフォントサイズは文字数に応じて動的に縮小する（`fontSizePx`）。
 * 菱形は固定サイズ（CSS 側 140×120px）で上下頂点へ近づくほど横幅が狭まるため、
 * 長いラベルが複数行に折り返すと矩形ブロックの角が斜辺をはみ出して clip-path に
 * 削られる。これを防ぐため `fontSizePx = clamp(8, 12, 50 / sqrt(len))` で
 * テキスト面積を菱形の内接矩形（テキスト幅は `.expression` 側で 72px に固定）に
 * 収める。フォント面積 ∝ font²・テキスト量 ∝ 文字数なので `font ∝ 1/sqrt(len)`
 * の形になり、係数 50 と幅 72px は全長 1〜50 文字で内接するよう実測で決めた値。
 * 17 文字以下は上限 12px に張り付くため短いラベル（他の条件ノード）の見た目は
 * 不変で、18 文字以上だけ滑らかに縮小する。下限 8px は可読性の最低ライン。
 *
 * Args:
 *     props (object): React Flow からカスタムノードに渡される props。
 *         id (string): 条件ノード ID（`stages.json` の `conditions[].id` に一致）。
 *         data (object): `{ expression: string, label?: string, trueDir?: string,
 *             falseDir?: string }` を含むデータ。`FlowchartArea` の
 *             `conditionsToNodes` から渡される。`label` / `trueDir` / `falseDir`
 *             は optional。`trueDir` / `falseDir` は true / false ソースハンドルの
 *             配置辺（未指定なら右 / 下）。
 *
 * Returns:
 *     JSX.Element: 菱形ノードを表す div 要素。
 */
function ConditionNode({ id, data }) {
  const isActive = useBattleStore(
    (s) => s.executionStep?.type === 'node' && s.executionStep?.id === id,
  );
  const isTraversed = useBattleStore((s) => s.traversedNodeIds.includes(id));

  const truePosition = directionToPosition(data.trueDir, Position.Right);
  const falsePosition = directionToPosition(data.falseDir, Position.Bottom);

  const className = [
    styles.diamond,
    isActive && styles.active,
    isTraversed && styles.traversed,
  ]
    .filter(Boolean)
    .join(' ');

  const text = data.label ?? data.expression ?? '';
  const fontSizePx = Math.max(8, Math.min(12, 50 / Math.sqrt(text.length)));
  /*
   * `data-cutscene-point={id}`（例: `cond-1`）はカットシーンの指差し誘導
   * （`CutscenePointer`）の対象にするための目印。`SlotNode` の同属性と
   * 同じ仕組みで、step 側の `point` に条件ノード id を書くと枠取りされる。
   */
  return (
    <div className={className} data-cutscene-point={id}>
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
        isConnectable={false}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-in"
        className={styles.handle}
        isConnectable={false}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={styles.handle}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={truePosition}
        id="true"
        className={styles.handle}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={falsePosition}
        id="false"
        className={styles.handle}
        isConnectable={false}
      />
      <div className={styles.expression} style={{ fontSize: `${fontSizePx}px` }}>
        {text}
      </div>
    </div>
  );
}

export default ConditionNode;
