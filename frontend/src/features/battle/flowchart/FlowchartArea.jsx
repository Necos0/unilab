import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  MarkerType,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import SlotNode from './SlotNode';
import useBattleStore from '../../../stores/battleStore';
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
 * 描画する。パン・ズーム・ノードドラッグ・選択といった React Flow 側の
 * インタラクションは基本的に無効化し、スロット配置は dnd-kit が担う。
 * 背景は `Background` の `Lines` バリアントで薄いグリッドを敷く。
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
