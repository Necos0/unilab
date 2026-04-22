import { useMemo } from 'react';
import {
  ReactFlow,
  MarkerType,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import SlotNode from './SlotNode';
import styles from './FlowchartArea.module.css';

const nodeTypes = { slot: SlotNode };

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
 * ステージ定義のエッジ配列を React Flow のエッジ配列に変換する。
 *
 * `source` または `target` のスロットが存在しないエッジは除外し、
 * 開発者が気づけるよう console.warn に記録する。描画エラーで画面が
 * 落ちることを防ぐためのガードレール。
 *
 * Args:
 *     edges (Array<{id: string, source: string, target: string}>):
 *         ステージ定義に含まれるエッジ配列。
 *     slots (Array<{id: string}>):
 *         参照整合性チェックに使うスロット配列。
 *
 * Returns:
 *     Array<object>: React Flow に渡せるエッジ配列。矢印マーカー付き。
 */
function edgesToFlowEdges(edges, slots) {
  const slotIds = new Set(slots.map((slot) => slot.id));
  return edges
    .filter((edge) => {
      const ok = slotIds.has(edge.source) && slotIds.has(edge.target);
      if (!ok) {
        console.warn(
          `[FlowchartArea] skip edge "${edge.id}": source or target slot not found`,
          edge,
        );
      }
      return ok;
    })
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
}

/**
 * 戦闘画面中段に配置するフローチャート描画領域。
 *
 * ステージ定義（スロット・エッジ）を受け取り React Flow キャンバス上に
 * 描画する。本スペックでは描画専用のため、パン・ズーム・ノードドラッグ・
 * 選択といったインタラクションは全て無効化し、`fitView` で初期表示時に
 * グラフ全体が領域に収まるようにする。背景には `Background` コンポーネント
 * の `Lines` バリアントで薄いグリッドを敷き、「プログラムを組む場所」
 * である中段の領域性を視覚的に強調する。
 *
 * Args:
 *     stage (object): `stages.json` から読み込んだ 1 ステージ分の定義。
 *         `slots` と `edges` を持つ。
 *
 * Returns:
 *     JSX.Element: React Flow キャンバスをラップする div 要素。
 */
function FlowchartArea({ stage }) {
  const nodes = useMemo(() => slotsToNodes(stage.slots), [stage.slots]);
  const edges = useMemo(
    () => edgesToFlowEdges(stage.edges, stage.slots),
    [stage.edges, stage.slots],
  );

  return (
    <div className={styles.canvas}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        fitView
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
