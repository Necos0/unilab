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
 * Handle 構成（4 つ）：
 *   - Left（target、デフォルト id）：標準的な「左から入ってくるエッジ」用。
 *     線形フローの延長として条件ノードに到達する基本ケース。
 *   - Top（target、`id="top"`）：将来「上からエッジが入ってくる」レイアウト
 *     用の予備ハンドル。エッジ側で `targetHandle: 'top'` を指定したときに
 *     接続される（要件 1-5 の拡張性確保）。
 *   - source（`id="true"`）：条件評価結果が `true`（脱出 / Yes）のとき進む経路。
 *     配置する辺は `data.trueDir`（`'right'` / `'left'` / `'up'` / `'down'`）で
 *     決まり、未指定なら既定 Right（菱形の右頂点）。エッジ側で `sourceHandle: 'true'`。
 *   - source（`id="false"`）：条件評価結果が `false`（継続 / No）のとき進む経路。
 *     配置する辺は `data.falseDir` で決まり、未指定なら既定 Bottom（菱形の下頂点）。
 *     エッジ側で `sourceHandle: 'false'`。向きを変えても **id は不変** なので
 *     分岐ロジック（`battleStore.selectNextEdge`）には一切影響しない。
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
 * （ラベル未定義時のみフォールバックされる）。
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

  return (
    <div className={className}>
      <Handle
        type="target"
        position={Position.Left}
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
      <div className={styles.expression}>{data.label ?? data.expression}</div>
    </div>
  );
}

export default ConditionNode;
