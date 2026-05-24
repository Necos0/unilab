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
import ConditionNode from './ConditionNode';
import MergeNode from './MergeNode';
import AnimatedProgressEdge from './AnimatedProgressEdge';
import ZoomControls from './ZoomControls';
import useBattleStore from '../../../stores/battleStore';
import styles from './FlowchartArea.module.css';

const nodeTypes = { slot: SlotNode, start: StartNode, goal: GoalNode, condition: ConditionNode, merge: MergeNode };
const edgeTypes = { 'animated-progress': AnimatedProgressEdge };
const EXPANDED_BASELINE_BOUNDS_WIDTH = 720;
const LOOP_TOP_HEADROOM = 80;

/**
 * ステージ定義のスロット配列を React Flow のノード配列に変換する。
 *
 * 各スロットの `acceptOnly`（`restricted-slot` 仕様）と `multiplier`
 * （`multiplier-slot` 仕様）の optional フィールドを React Flow node の `data`
 * に転記する。`SlotNode` 側はこれを受け取って種別アイコン（左上）・倍率
 * インジケータ（右上）の描画やドロップ拒否時の赤ハイライトに使う。どちらも
 * undefined のスロットは `data.xxx === undefined` で SlotNode 側が後方互換の
 * 通常スロットとして扱う（restricted-slot 要件 6-1、multiplier-slot 要件 5-1）。
 *
 * 加えて、空きスロット中央に表示する番号 `displayNumber` を採番して `data` に
 * 渡す。**lockedCard を持たない（プレイヤーが配置できる）スロットだけ** を
 * 配列順に 1, 2, 3... と数え、lockedCard スロットには `null` を割り当てる。
 * これにより「(1) の次が (3)」のような飛びを防ぎ、空きスロットだけが連番に
 * なる（locked スロットはカードが見えるので番号不要）。`fillableCount` の
 * クロージャカウンタで実現。`map` が配列順を保つため採番順は安定。なお
 * この表示番号は condition 式の `slot('slot-N')` グローバル番号とは別物
 * （ステージデザイナーが label を表示番号に手動で合わせる）。
 *
 * Args:
 *     slots (Array<{id, position, acceptOnly?, multiplier?, lockedCard?}>):
 *         ステージ定義に含まれるスロット配列。`acceptOnly` / `multiplier` /
 *         `lockedCard` は任意。
 *
 * Returns:
 *     Array<{id, type, position, data: {acceptOnly?, multiplier?, displayNumber}}>:
 *         React Flow に渡せるノード配列。`displayNumber` は lockedCard なし
 *         スロットの通し番号、lockedCard スロットは `null`。
 */
function slotsToNodes(slots) {
  let fillableCount = 0;
  return slots.map((slot) => {
    let displayNumber = null;
    if (!slot.lockedCard) {
      fillableCount += 1;
      displayNumber = fillableCount;
    }
    return {
      id: slot.id,
      type: 'slot',
      position: slot.position,
      data: {
        acceptOnly: slot.acceptOnly,
        multiplier: slot.multiplier,
        displayNumber
      },
    };
  });
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

function conditionsToNodes(conditions) {
  return conditions.map((c) => ({
    id: c.id,
    type: 'condition',
    position: c.position,
    data: { 
      expression: c.expression, 
      label: c.label,
      trueDir: c.trueDir,
      falseDir: c.falseDir,
    },
  }));
}

function mergeNodesToNodes(mergeNodes) {
  return mergeNodes.map((m) => ({
    id: m.id,
    type: 'merge',
    position: m.position,
    data: {},
  }));
}

/**
 * ステージ定義のエッジ配列を React Flow のエッジ配列に変換する。
 *
 * `source` または `target` が、有効なノード ID（スロット＋ start / goal ＋
 * 条件分岐ノード＋合流ノード）のいずれにも当てはまらないエッジは除外し、
 * 開発者が気づけるよう `console.warn` に記録する。描画エラーで画面が落ちる
 * ことを防ぐためのガードレール。
 *
 * 各エッジには `type: 'animated-progress'` を付与して `AnimatedProgressEdge`
 * 経由で描画する。矢印マーカーは `MarkerType.ArrowClosed` で `color: '#6a6a78'`
 * を渡し、`AnimatedProgressEdge` 側 `.basePath` の `stroke: #6a6a78` と色味を
 * 揃える。両者をまとめて指定することでデフォルト状態のエッジ線と矢印が同じ
 * 暗めグレーとして表示され、通過後の白いネオン光（`.traversed`）とのコントラスト
 * が際立つ設計。
 *
 * 各エッジに `sourceHandle` / `targetHandle` を transparent に渡す。条件分岐
 * ノードからのエッジでは `sourceHandle: 'true' | 'false'` を指定して
 * `ConditionNode` の対応ハンドル（右頂点 / 下頂点）から引く。False 経路から
 * 合流ノードへのエッジでは `targetHandle: 'top'` を指定して合流ノードの top
 * から入る（`AnimatedProgressEdge` 側で smoothstep 経路が選ばれる）。線形
 * ステージのエッジでは両ハンドルとも `undefined` のままで、React Flow が
 * デフォルトハンドルに接続する（map-2-stage-1 要件 1-5、merge-node 要件 5-1〜5-3）。
 *
 * Args:
 *     edges (Array<{id, source, target, sourceHandle?, targetHandle?}>):
 *         ステージ定義に含まれるエッジ配列。
 *     slots (Array<{id: string}>):
 *         参照整合性チェックに使うスロット配列。
 *     conditions (Array<{id: string}>):
 *         参照整合性チェックに使う条件分岐ノード配列。空配列でも OK。
 *     mergeNodes (Array<{id: string}>):
 *         参照整合性チェックに使う合流ノード配列。空配列でも OK。
 *     hasStart (boolean): スタートマーカーが定義されているか。
 *     hasGoal (boolean): ゴールマーカーが定義されているか。
 *
 * Returns:
 *     Array<object>: React Flow に渡せるエッジ配列。矢印マーカー付き。
 */
function edgesToFlowEdges(edges, slots, conditions, mergeNodes, hasStart, hasGoal) {
  const validIds = new Set(slots.map((slot) => slot.id));
  for (const c of conditions) {
    validIds.add(c.id);
  }
  for (const m of mergeNodes) {
    validIds.add(m.id);
  }
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
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: 'animated-progress',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6a6a78' },
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
 *   - **縮小状態**：`getNodesBounds` で求めたノード範囲を `fitBounds`
 *     （`padding: 0.1`）でフィットさせ、全体が収まるよう自動でズームする。
 *     ループの戻りエッジ（`targetHandle === 'top'` のエッジ）があるステージでは、
 *     エッジが行の上を回ってノード上端より上に出るため、`fitView` 系がノード
 *     bbox しか見ず上が見切れる。これを防ぐため、戻りエッジがある場合のみ
 *     bbox 上端を `LOOP_TOP_HEADROOM`（80px）持ち上げた矩形にフィットさせる
 *     （`flowchart-loop` 仕様）。戻りエッジが無いステージは bbox そのままで
 *     従来表示と同じ
 *   - **拡大状態**：`setViewport` でズームを
 *     `(canvasWidth × 0.8) / EXPANDED_BASELINE_BOUNDS_WIDTH` で動的算出し、
 *     `getNodesBounds` で得たノード集合の中心が canvas の中心に重なるよう
 *     viewport の x / y を計算する。`EXPANDED_BASELINE_BOUNDS_WIDTH` は
 *     「1 スロットステージ（start + slot-1 + goal）の bounding box 幅」
 *     に相当する定数で、実機で見え方を調整しながら決めた基準値。これにより
 *     全ステージで「1 スロット分のフローチャートが canvas 幅の 80% に
 *     収まる zoom」が共通の基準として適用される。結果として 1-1 のような
 *     スロットの少ないステージでは縮小状態とほぼ同じ表示、1-2 / 1-4 の
 *     ようなスロットの多いステージでは同じカードサイズを維持したまま横に
 *     はみ出し、`panOnScroll` のホイールスクロールで両端へアクセスできる。
 *     `<ReactFlow>` の `minZoom` / `maxZoom` はデフォルトを広げて
 *     `[0.1, 5]` に設定しており、canvas 幅が大きいときに baselineZoom が
 *     2.0 を超えてもクランプされないようにしている。`fitView` 単体だと
 *     ステージのノード集合が canvas より大きい場合に縮小フィットされて
 *     しまい「拡大ボタンを押した意味がない」見た目になったため、位置と
 *     ズームを `setViewport` で直接制御する方式に切り替えた経緯がある
 *
 * 拡大状態では上記の基準ズームを初期値としつつ、ユーザーが手動でズームを
 * 変更できる：トラックパッドのピンチ（`zoomOnPinch={isExpanded}`）と、マウス
 * 向けの `ZoomControls`（フロー領域右下の +/− ボタン）。`panOnScroll` の 2 本指
 * スクロール（パン）とピンチ（`ctrlKey` 付き wheel）は React Flow が別イベントに
 * 振り分けるため共存する。手動ズームは下記の refit が走らない限り保持される
 * （refit はリサイズ・`isExpanded`/`nodes`/`edges` 変化時のみ基準ズームへ再計算
 * するため、拡大が安定した後のピンチ・ボタン操作は残る）。縮小状態ではピンチ・
 * ボタンとも無効（`zoomOnPinch` は false、`ZoomControls` は非表示）。
 *
 * コンテナサイズの変化（CSS トランジションによる `flex-grow` 変化）は
 * `ResizeObserver` で検出し、その都度 refit ロジックを呼び直すことで、
 * アニメーション中もスロットのスケールが滑らかに追従する。`nodes` 自体の
 * 変化（ステージ切り替え時など）も `useEffect` の依存に含めており、
 * ステージが切り替わった直後に新しいノード集合の bounding box に基づいて
 * viewport が再計算される。
 *
 * Args:
 *     stage (object): `stages.json` から読み込んだ 1 ステージ分の定義。
 *         `slots` / `edges` に加えて、任意で `start` / `goal` / `conditions`
 *         （条件分岐ノード配列、空または未定義可）/ `mergeNodes`
 *         （合流ノード配列、空または未定義可、`stagesLoader` 自動生成）を持つ。
 *
 * Returns:
 *     JSX.Element: React Flow キャンバスをラップする div 要素。
 */
function FlowchartArea({ stage }) {
  const nodes = useMemo(() => {
    const result = slotsToNodes(stage.slots);
    const startNode = startToNode(stage.start);
    const goalNode = goalToNode(stage.goal);
    const conditionNodes = conditionsToNodes(stage.conditions ?? []);
    const mergeNodes = mergeNodesToNodes(stage.mergeNodes ?? []);
    if(startNode) result.unshift(startNode);
    if(goalNode) result.push(goalNode);
    result.push(...conditionNodes);
    result.push(...mergeNodes);
    return result;
  }, [stage.slots, stage.start, stage.goal, stage.conditions, stage.mergeNodes]);
  
  const edges = useMemo(
    () => edgesToFlowEdges(stage.edges, stage.slots, stage.conditions ?? [], stage.mergeNodes ?? [], !!stage.start, !!stage.goal),
    [stage.edges, stage.slots, stage.conditions, stage.mergeNodes, stage.start, stage.goal],
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
      if (isExpanded) {
        const nodesBounds = reactFlowInstance.getNodesBounds(nodes);
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;
        const baselineZoom = (canvasWidth * 0.8) / EXPANDED_BASELINE_BOUNDS_WIDTH;
        const x = canvasWidth / 2 - (nodesBounds.x + nodesBounds.width / 2) * baselineZoom;
        const y = canvasHeight / 2 - (nodesBounds.y + nodesBounds.height / 2) * baselineZoom;
        reactFlowInstance.setViewport(
          { x, y, zoom: baselineZoom },
          { duration: 0 },
        );
      } else {
        const bounds = reactFlowInstance.getNodesBounds(nodes);
        const hasLoopBackEdge = edges.some((e) => e.targetHandle === 'top');
        const top = hasLoopBackEdge ? LOOP_TOP_HEADROOM : 0;
        reactFlowInstance.fitBounds(
          {
            x: bounds.x,
            y: bounds.y - top,
            width: bounds.width,
            height: bounds.height + top,
          },
          { padding: 0.1, duration: 0 },
        );
      }
    };

    refit();

    const observer = new ResizeObserver(refit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [reactFlowInstance, isExpanded, nodes, edges]);

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
        zoomOnPinch={isExpanded}
        zoomOnDoubleClick={false}
        minZoom={0.1}
        maxZoom={5}
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
        <ZoomControls />
      </ReactFlow>
    </div>
  );
}

export default FlowchartArea;
