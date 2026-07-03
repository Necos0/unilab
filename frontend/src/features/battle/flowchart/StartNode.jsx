import { Handle, Position } from '@xyflow/react';
import styles from './StartNode.module.css';
import useBattleStore, { selectAllSlotsFilled } from '../../../stores/battleStore';

/**                                                                           
 * フローチャートの起点を示すスタートマーカー兼「実行」ボタン（▶）。
 *
 * React Flow のカスタムノードとしてフローチャート最左に配置され、
 * 「処理がここから始まる」ことを視覚的に伝えるとともに、クリックで
 * フローチャート実行をトリガーする（`start-node-execution` 仕様）。
 * 旧 `PlayButton`（右上の独立ボタン）は本仕様で廃止され、StartNode が
 * 唯一の実行トリガーとなった。`SlotNode` と異なり `useDroppable` を
 * 呼ばないため dnd-kit のヒットテストに登録されず、カードのドロップ
 * 対象にならない。エッジの起点として右辺に `source` Handle を 1 つだけ
 * 持つ。
 *
 * 実行トリガー：最上位要素は `<button type="button">` で、`onClick` で
 * `battleStore.startExecution(data.stage)` を発火する。`stage` は React
 * Flow の `data` prop 経由で `FlowchartArea` の `startToNode(start, stage)`
 * から渡される。`<button>` ネイティブの `disabled` 属性により、Enter /
 * Space キー経由の発火も含めて無効化される（アクセシビリティ二重防御）。
 *
 * `disabled` 判定は旧 PlayButton から踏襲した 5 条件の OR：
 *   - 実行中（`isExecuting`）：連打防止
 *   - 拡大／縮小切替アニメーション中（`isTransitioning`）：状態の二重遷移を回避
 *   - 全スロットが埋まっていない（`selectAllSlotsFilled` が false）：
 *     部分配置での実行を許可しない
 *   - 勝利演出中（`victoryPhase !== null`）：CLEAR! 後の再実行を抑止し、
 *     プレイヤーをマップへ戻る動線へ誘導する（victory-clear 要件 6-2）
 *   - 失敗演出中（`failPhase !== null`）：Fail オーバーレイ表示中の再実行を
 *     抑止する（`battle-fail-retry` 要件 7-1）。`.root.failed` の
 *     `pointer-events: none` による全体ロックに加え、`disabled` 属性を
 *     併用することでキーボード経由の発火も防ぐ二重防御
 *
 * アイコン素材は旧 PlayButton と同じ `/icons/flowchart/play.svg`（緑色の
 * 再生マーク▶）。「ここを押せば実行が始まる」というメタファをアイコン
 * 形状でも伝える。意味は親 `<button>` の `aria-label="実行"` に集約する。
 *
 * 実行中、`executionStep` が自身（`type: 'node', id: 'start'`）と一致したら
 * `.active` クラスを付与し、CSS の `@keyframes startGoalHighlight` で
 * アイコンを発光・点滅させる（play-button 要件 5-1、本仕様で挙動は不変）。
 *
 * `disabled` 時の視覚は `.marker:disabled { opacity: 0.4; cursor: not-allowed }`
 * で半透明 + カーソル変更を表示。実行中は `.active` / `.traversed` の発光と
 * 半透明が併存して「半透明だが光っている」状態になるが、実行中は注目が
 * 他ノードに移っているため違和感は出にくいと判断（`start-node-execution`
 * 仕様の設計判断）。
 *
 * 通過済みの可視化（`battle-fail-retry` 要件 1-3, 1-4, 1-6）：
 * `traversedNodeIds` に `'start'` が含まれていれば `.traversed` クラスを
 * 付与し、`startGoalHighlight` キーフレーム終端と同一値の `filter` を静的に
 * 当てた固定光を維持する。`.active` の点滅終了から `.traversed` の固定光へ
 * 明度差なく遷移する。実行終了後も `initializeBattle` または `retryFromFail`
 * が呼ばれるまで残るため、失敗時に「実行がここから始まった」ことを白く
 * 光った経路の起点として確認できる。`SlotNode` ／ `GoalNode` と同一パターン。
 *
 * Args:
 *     props (object): React プロパティ。
 *         data (object): React Flow `data` prop。`{ stage }` を持つ。
 *             `stage` は `stages.json` の 1 ステージ分で、クリック時に
 *             `startExecution(data.stage)` でそのまま渡される。
 *
 * Returns:
 *     JSX.Element: スタートマーカーを表す `<button>` 要素。
 */
function StartNode({ data }){
  const isExecuting = useBattleStore((s) => s.isExecuting);
  const isTransitioning = useBattleStore((s) => s.isTransitioning);
  const allFilled = useBattleStore(selectAllSlotsFilled);
  const victoryPhase = useBattleStore((s) => s.victoryPhase);
  const failPhase = useBattleStore((s) => s.failPhase);
  const startExecution = useBattleStore((s) => s.startExecution);
  const isActive = useBattleStore(
    (s) => s.executionStep?.type === 'node' && s.executionStep?.id === 'start',
  );
  const isTraversed = useBattleStore((s) => s.traversedNodeIds.includes('start'));

  const isDisabled = isExecuting || isTransitioning || !allFilled || victoryPhase !== null || failPhase !== null;

  const handleClick = () => {
    startExecution(data.stage);
  }

  const className = [
    styles.marker, 
    isActive && styles.active, 
    isTraversed && styles.traversed
  ]
    .filter(Boolean)
    .join(' ');
  
  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={isDisabled}
      aria-label="実行"
      data-cutscene-point="executeButton"
    >
      <img
        className={styles.icon}
        src="/icons/flowchart/play.svg"
        alt="実行"
        draggable={false}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
        isConnectable={false}
      />
    </button>
  );
}

export default StartNode;