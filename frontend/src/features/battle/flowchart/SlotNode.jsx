import { Handle, Position } from '@xyflow/react';
import { useDroppable } from '@dnd-kit/core';
import DraggableCard from '../../cards/DraggableCard';
import RestrictedSlotIcon from './RestrictedSlotIcon';
import MultiplierIndicator from './MultiplierIndicator';
import useBattleStore from '../../../stores/battleStore';
import styles from './SlotNode.module.css';

/**
 * フローチャート上のスロットを表す React Flow カスタムノード。
 *
 * `useDroppable` で dnd-kit のドロップターゲットとして登録し、
 * `battleStore` の `slotAssignments` を購読してこのスロット（`props.id`）
 * に割当られたカードがあれば内側に `DraggableCard` を描画する。
 * 割当がないときは従来の点線枠の空きスロットとして描画する。
 *
 * ドラッグ中の視覚フィードバックとして、以下の分岐でクラスを付け替える：
 *   - `activeInstanceId !== null` のとき：ドロップ候補として控えめなハイライト
 *   - `isOver === true` のとき：ポインタ直下のスロットとして強いハイライト
 *   - スロットに置かれたカード自身がドラッグ中のとき：見た目を空きスロット
 *     表示に戻す（元のカードは `DraggableCard` 側の半透明表現で「つかんで
 *     いる」ことを示しているが、スロット自体は「空」の見た目にする）
 *   - 実行中（`isExecuting`）または拡大／縮小切替中（`isTransitioning`）：
 *     `.locked` クラスで `pointer-events: none` を再付与し、ベース CSS の
 *     `pointer-events: auto`（React Flow ラッパーの `none` を上書きするため）
 *     を一時的に無効化することで、配置済みカードのドラッグもロックする
 *   - `executionStep` が自身（`type: 'node', id: props.id`）と一致したとき：
 *     `.active` クラスで `@keyframes slotHighlight` を起動し、内側のカードを
 *     発光・点滅させる（play-button 要件 5-3）
 *   - `traversedNodeIds` に自身の id が含まれているとき：`.traversed` クラス
 *     で固定の発光（`@keyframes slotHighlight` の終端と同じ filter 値を静的に
 *     当てた光り方）を維持する（`battle-fail-retry` 要件 1-3, 1-4, 1-6）。
 *     `.active` のキーフレーム終端と `.traversed` の固定値を一致させているので、
 *     フェーズ突入時の点滅 → 終了 → 固定光 の遷移が明度差なくシームレスに
 *     繋がる。`initializeBattle` または `retryFromFail` が呼ばれるまで残るため、
 *     失敗時にプレイヤーが「どのスロットを通ったか」を後から振り返れる
 *   - 配置済みカードがロックカード（monster 等、`assignedCard.locked === true`）の
 *     とき：`.lockedCard` クラスを付与し、CSS 側で `.dropTarget` / `.isOver`
 *     による outline ハイライトと背景色変化を抑制する。`computeDropTransition`
 *     で `destCard?.locked` のドロップが既に拒否されているため、視覚的に
 *     「ここに置けそう」と誤解させる演出を消して、実装ロジックと表示の食い違い
 *     をなくす（monster-attack 要件 2-2 の視覚補強）
 *   - `data.acceptOnly` が指定されているカード種別制限スロット（`restricted-slot`
 *     仕様）：**左上** に `<RestrictedSlotIcon type={acceptOnly} />` を常時描画
 *     （要件 3-1, 3-5, 3-6。`multiplier-slot` 導入に伴い右上 → 左上へ移設）。
 *     さらにドラッグ中カードの `id` を派生計算し、`id !== acceptOnly` のとき
 *     ホバー時に `.rejectHover` クラス（赤系の枠 + 薄赤背景）を付与する。
 *     `isOver` と `showReject` は排他で、一致カードは既存の青系 `.isOver`、
 *     不一致カードは赤系 `.rejectHover` に切り替わる。ドロップ拒否の判定自体は
 *     `battleStore.computeDropTransition` のガードで行われるため、本コンポーネント
 *     は視覚フィードバックだけを担う
 *   - `data.multiplier` が指定されている倍率スロット（`multiplier-slot` 仕様）：
 *     **右上** に `<MultiplierIndicator value={multiplier} />` を常時描画して
 *     「x2」等の白テキストを表示する。acceptOnly（左上）と multiplier（右上）は
 *     左右に分離しているため、同一スロットに両方あっても衝突しない。倍率の効果
 *     （`card.power × multiplier`）適用は `battleStore.scheduleNodePhase` 側が
 *     担い、本コンポーネントは表示のみ
 *
 * `Handle` はエッジの接続点として必要なため配置するが、ユーザーが手動で
 * エッジを引く用途ではないため CSS で視覚的に非表示にしている。
 *
 * Args:
 *     props (object): React Flow からカスタムノードに渡される props。
 *         id (string): スロット ID（`stages.json` の `slots[].id` に一致）。
 *         data (object): React Flow node data。
 *             acceptOnly (string, optional): `'attack'` / `'guard'` / `'heal'`
 *                 のいずれか。指定時はカード種別制限スロットとして描画する。
 *                 `FlowchartArea.slotsToNodes` から `slot.acceptOnly` が転記される。
 *             multiplier (number, optional): 2 以上の整数。指定時は右上に倍率
 *                 インジケータを表示する。`FlowchartArea.slotsToNodes` から
 *                 `slot.multiplier` が転記される。
 *
 * Returns:
 *     JSX.Element: スロットを表す div 要素。
 */
function SlotNode({ id, data }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const assignedCard = useBattleStore((s) => s.slotAssignments[id] ?? null);
  const activeInstanceId = useBattleStore((s) => s.activeInstanceId);
  const isExecuting = useBattleStore((s) => s.isExecuting);
  const isTransitioning = useBattleStore((s) => s.isTransitioning);
  const isActive = useBattleStore(
    (s) => s.executionStep?.type === 'node' && s.executionStep?.id === id,
  );
  const isTraversed = useBattleStore((s) => s.traversedNodeIds.includes(id));
  const isLockedCard = !!assignedCard?.locked;

  const isDragActive = activeInstanceId !== null;
  const isDraggingThisCard =
    isDragActive && assignedCard?.instanceId === activeInstanceId;
  const showAsFilled = !!assignedCard && !isDraggingThisCard;

  const acceptOnly = data?.acceptOnly;
  const acceptClass = 
    acceptOnly === 'attack' ? styles.acceptAttack :
    acceptOnly === 'guard' ? styles.acceptGuard :
    acceptOnly === 'heal' ? styles.acceptHeal :
    null;
  const activeCardId = useBattleStore((s) => {
    const aid = s.activeInstanceId;
    if (!aid) return null;
    const fromHand = s.handCards.find((c) => c.instanceId === aid);
    if (fromHand) return fromHand.id;
    for (const card of Object.values(s.slotAssignments)) {
      if (card && card.instanceId === aid) return card.id;
    }
    return null;
  });
  const showReject = isOver && !!acceptOnly && activeCardId !== null && activeCardId !== acceptOnly;

  const multiplier = data?.multiplier;

  const className = [
    styles.slot,
    acceptClass,
    showAsFilled && styles.filled,
    isDragActive && styles.dropTarget,
    isOver && !showReject && styles.isOver,
    showReject && styles.rejectHover,
    (isExecuting || isTransitioning) && styles.locked,
    isActive && styles.active,
    isTraversed && styles.traversed,
    isLockedCard && styles.lockedCard,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={setNodeRef} className={className}>
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
      {assignedCard && (
        <DraggableCard card={assignedCard} source={id} variant="fill" />
      )}
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
        isConnectable={false}
      />
      {acceptOnly && <RestrictedSlotIcon type={acceptOnly} />}
      {multiplier && <MultiplierIndicator value={multiplier} />}
    </div>
  );
}

export default SlotNode;
