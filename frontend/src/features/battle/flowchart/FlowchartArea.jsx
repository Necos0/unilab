import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  MarkerType,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import SlotNode from './SlotNode';
import StartNode from './StartNode';
import GoalNode from './GoalNode';
import AnimatedProgressEdge from './AnimatedProgressEdge';
import useBattleStore from '../../../stores/battleStore';
import styles from './FlowchartArea.module.css';

const nodeTypes = { slot: SlotNode, start: StartNode, goal: GoalNode };
const edgeTypes = { 'animated-progress': AnimatedProgressEdge };

/**
 * ステージ定義のスロット配列を React Flow のノード配列に変換する。
 *
 * Args:
 *     slots (Array<{id: string, position: {x: number, y: number}}>):
 *         ステージ定義に含まれるスロット配列。
 *
 * Returns:
 *     Array<{id: string, type: string, position: object, data: object}>:
 *         React Flow に渡せるノード配列。
 */
function slotsToNodes(slots) {
  return slots.map((slot) => ({
    id: slot.id,
    type: 'slot',
    position: slot.position,
    data: {},
  }));
}

/**
 * ステージ定義の `start` オブジェクトを React Flow ノードに変換する。
 *
 * `start` が未定義のステージ（マーカー無しのレガシーステージ等）でも
 * 落ちないよう `null` を返す。`null` のときは `nodes` 配列に含めない。
 *
 * Args:
 *     start ({position: {x: number, y: number}} | undefined):
 *         ステージ定義の `start` フィールド。未定義可。
 *
 * Returns:
 *     {id: 'start', type: 'start', position: object, data: object} | null:
 *         React Flow ノード。`start` が未定義なら `null`。
 */
function startToNode(start) {
  if(!start) return null;
  return { id: 'start', type: 'start', position: start.position, data: {} };
}

/**
 * ステージ定義の `goal` オブジェクトを React Flow ノードに変換する。
 *
 * `goal` が未定義のステージでも落ちないよう `null` を返す。
 *
 * Args:
 *     goal ({position: {x: number, y: number}} | undefined):
 *         ステージ定義の `goal` フィールド。未定義可。
 *
 * Returns:
 *     {id: 'goal', type: 'goal', position: object, data: object} | null:
 *         React Flow ノード。`goal` が未定義なら `null`。
 */
function goalToNode(goal) {
  if(!goal) return null;
  return { id: 'goal', type: 'goal', position: goal.position, data: {} };
}

/**
 * ステージ定義のエッジ配列を React Flow のエッジ配列に変換する。
 *
 * `source` または `target` が、有効なノード ID（スロット＋ start / goal）
 * のいずれにも当てはまらないエッジは除外し、開発者が気づけるよう
 * `console.warn` に記録する。描画エラーで画面が落ちることを防ぐための
 * ガードレール。
 *
 * Args:
 *     edges (Array<{id: string, source: string, target: string}>):
 *         ステージ定義に含まれるエッジ配列。
 *     slots (Array<{id: string}>):
 *         参照整合性チェックに使うスロット配列。
 *     hasStart (boolean): スタートマーカーが定義されているか。
 *     hasGoal (boolean): ゴールマーカーが定義されているか。
 *
 * Returns:
 *     Array<object>: React Flow に渡せるエッジ配列。矢印マーカー付き。
 */
function edgesToFlowEdges(edges, slots, hasStart, hasGoal) {
  const validIds = new Set(slots.map((slot) => slot.id));
  if (hasStart) validIds.add('start');
  if (hasGoal) validIds.add('goal');
  return edges
    .filter((edge) => {
      const ok = validIds.has(edge.source) && validIds.has(edge.target);
      if (!ok) {
        console.warn(
          `[FlowchartArea] skip edge "${edge.id}": source or target node not found`,
          edge,
        );
      }
      return ok;
    })
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'animated-progress',
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
}

/**
 * 戦闘画面中段に配置するフローチャート描画領域。
 *
 * ステージ定義（スロット・スタート／ゴールマーカー・エッジ）を受け取り
 * React Flow キャンバス上に描画する。スロットには dnd-kit でカードを
 * ドロップできるが、スタート／ゴールマーカーはドロップ対象外（純粋な
 * 視覚マーカー）。背景には `Background` の `Lines` バリアントで薄い
 * グリッドを敷き、「プログラムを組む場所」である中段の領域性を視覚的に
 * 強調する。
 *
 * 拡大／縮小切替（`battleStore.isExpanded`）に連動して以下をコントロール：
 *   - **縮小状態**：`fitView` に自前の上下限を付けず、React Flow 既定の
 *     自動フィット（0.5〜2.0）に任せる。1 行でエリアが余っているときは
 *     ~2x まで自動拡大、多段で溢れるときは自動縮小する
 *   - **拡大状態**：`fitView` の `minZoom: 1` で「最小でも原寸」を保証した
 *     うえで、React Flow 既定の上限（2.0）まで自動拡大する。スケール 1.0
 *     でもエリアに収まらない場合は `panOnScroll` によるスクロールで
 *     アクセスする
 *
 * コンテナサイズの変化（CSS トランジションによる `flex-grow` 変化）は
 * `ResizeObserver` で検出し、その都度 `fitView()` を呼び直すことで、
 * アニメーション中もスロットのスケールが滑らかに追従する。
 *
 * Args:
 *     stage (object): `stages.json` から読み込んだ 1 ステージ分の定義。
 *         `slots` / `edges` に加えて、任意で `start` / `goal` を持つ。
 *
 * Returns:
 *     JSX.Element: React Flow キャンバスをラップする div 要素。
 */
function FlowchartArea({ stage }) {
  const nodes = useMemo(() => {
    const result = slotsToNodes(stage.slots);
    const startNode = startToNode(stage.start);
    const goalNode = goalToNode(stage.goal);
    if(startNode) result.unshift(startNode);
    if(goalNode) result.push(goalNode);
    return result;
  }, [stage.slots, stage.start, stage.goal]);
  
  const edges = useMemo(
    () => edgesToFlowEdges(stage.edges, stage.slots, !!stage.start, !!stage.goal),
    [stage.edges, stage.slots, stage.start, stage.goal],
  );

  const canvasRef = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const isExpanded = useBattleStore((s) => s.isExpanded);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!reactFlowInstance || !canvas) {
      return undefined;
    }

    const refit = () => {
      reactFlowInstance.fitView({
        padding: 0.1,
        // 拡大時は「1.0 を下限」の自動フィット：小さい図なら自動で拡大し、
        // 大きい図なら 1.0 を維持して overflow を panOnScroll で吸収する。
        // 縮小時は自前の上下限を付けず React Flow 既定の自動フィットに
        // 任せる：1 行でエリアが余っているときは ~2x まで拡大、多段で
        // 溢れるときは自動縮小で全体収容
        minZoom: isExpanded ? 1 : undefined,
        duration: 0,
      });
    };

    refit();

    const observer = new ResizeObserver(refit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [reactFlowInstance, isExpanded]);

  return (
    <div ref={canvasRef} className={styles.canvas}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={isExpanded}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        onInit={setReactFlowInstance}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={24}
          color="#1a1a24"
          size={1}
        />
      </ReactFlow>
    </div>
  );
}

export default FlowchartArea;
