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
 *   - `data.multiplier` が指定されている倍率スロット（`multiplier-slot` /
 *     `loop-counter` 仕様）：**右上** に `<MultiplierIndicator value={displayMultiplier} />`
 *     を常時描画して「x2」等の白テキストを表示する。acceptOnly（左上）と
 *     multiplier（右上）は左右に分離しているため、同一スロットに両方あっても
 *     衝突しない。倍率の効果（`card.power × multiplier`）適用は
 *     `battleStore.scheduleNodePhase` 側が担い、本コンポーネントは表示のみ。
 *     `data.multiplier` は **Sum 型** で、数値リテラル（既存）と `{counterRef}`
 *     オブジェクト（loop-counter 新規）を取り、`displayMultiplier` が型に応じて
 *     値を解決する：数値ならそのまま、オブジェクトなら zustand の
 *     `counterValues[counterRef]` を購読して動的に決まる
 *   - **counter スロット / カウンタ連動 multiplier の金枠**（`loop-counter` 仕様、
 *     要件 5）：`isCounterSlot`（assignedCard が `id: 'counter'` の lockedCard）
 *     と `isCounterLinkedMultiplier`（data.multiplier がオブジェクトかつ
 *     counterRef を持つ）のいずれかが true なら `styles.counterPaired` クラスを
 *     付与し、ペアであることを示す金枠を表示する。両者が同じ counterId を共有
 *     することは IDで保証されており、視覚的にもプレイヤーに「この 2 つはセット」
 *     が伝わる
 *   - **counter 通過時の同期発光**（`loop-counter` 仕様、要件 7）：zustand の
 *     `activeCounterId`（`scheduleNodePhase` が counter ノードフェーズ中だけ立てる
 *     state）を購読し、自分の `counterId`（counter スロット側）または `counterRef`
 *     （multiplier スロット側）と一致する間だけ `styles.counterFlash` クラスを
 *     付与する。これにより counter が通過した瞬間、ペアの counter と multiplier
 *     **両方が同時に金色フラッシュ** する。`scheduleEdgePhase` の冒頭で
 *     `activeCounterId` が `null` に戻るため、発光はノードフェーズ期間中
 *     （`NODE_PHASE_MS`）だけ続き、次のエッジに移った瞬間に消える同期挙動になる
 *
 * 空きスロットの中央には番号「(N)」を表示する。番号 `data.displayNumber` は
 * `FlowchartArea.slotsToNodes` が **lockedCard を持たない（プレイヤーが配置
 * できる）スロットだけを通し番号で採番** した値で、`assignedCard` が無いとき
 * （カード未配置）のみ中央に描画する。これは condition ノードの label を
 * 「(1)が攻撃カード」のように書いて「スロット」という語を避け、画面の番号と
 * 文章をリンクさせるための補助表示（小学生向けの分かりやすさ重視）。
 *
 * 注意：表示番号は condition 式 `slot('slot-N')` が参照するグローバル ID 番号
 * （locked 含む連番）とは **一致しない**。locked スロットを飛ばして空きスロット
 * だけを 1, 2, 3... と数えるため、「(1) の次が (3)」のような飛びを防ぐのが狙い。
 * 例：slot-1（空）= (1) / slot-2（locked）= 番号なし / slot-3（空）= (2)。
 * このため condition の label を書くときは「画面表示の番号」に合わせる必要が
 * あり、式の `slot-N` 番号とは別管理になる（ステージデザイナーが手動で対応付け）。
 *
 * `displayNumber` は静的採番（実行時の空き状態に依存しない）なので、プレイヤー
 * がカードを置いても他スロットの番号はずれない（置いたスロットは番号が隠れて
 * カードが見えるだけ）。lockedCard スロットは `displayNumber: null` かつ
 * `assignedCard` ありで二重に番号非表示。中央配置は `.slot` の flex
 * センタリングに任せ、`Handle`（absolute 配置）や角のインジケータ（左上
 * acceptOnly / 右上 multiplier）とは重ならない。
 *
 * `Handle` はエッジの接続点として必要なため配置するが、ユーザーが手動で
 * エッジを引く用途ではないため CSS で視覚的に非表示にしている。Left（target）/
 * Top（target、`id="top"`）/ Right（source）に加え、前置ループのボディ末尾から
 * 合流ノードへ戻る戻りエッジの出口として Top（source、`id="loop-out"`）を持つ
 * （`flowchart-loop` 仕様）。`loop-out` を参照しないスロットでは未使用ハンドルと
 * して無害に存在するだけ。
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
 *             displayNumber (number | null): 空きスロット中央に表示する番号。
 *                 `FlowchartArea.slotsToNodes` が lockedCard なしスロットだけを
 *                 通し番号で採番した値。lockedCard スロットは `null`。
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

  const isCounterSlot = assignedCard?.id === 'counter' && assignedCard?.locked;
  const isCounterLinkedMultiplier = 
    typeof data?.multiplier === 'object' && 
    data.multiplier !== null &&
    typeof data.multiplier.counterRef === 'string';
  const isCounterPaired = isCounterSlot || isCounterLinkedMultiplier;

  const activeCounterId = useBattleStore((s) => s.activeCounterId);
  const myCounterId = isCounterSlot ? assignedCard?.counterId : null;
  const myCounterRef = isCounterLinkedMultiplier ? data.multiplier.counterRef : null;
  const isCounterFlashing = (myCounterId !== null && activeCounterId === myCounterId) || (myCounterRef !== null && activeCounterId === myCounterRef);

  const counterValue = useBattleStore((s) => isCounterLinkedMultiplier ? (s.counterValues[data.multiplier.counterRef] ?? 0) : undefined);
  const displayMultiplier =
    typeof data?.multiplier === 'number' ? data.multiplier :
    isCounterLinkedMultiplier ? counterValue :
    undefined;

  const displayNumber = data?.displayNumber;

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
    isCounterPaired && styles.counterPaired,
    isCounterFlashing && styles.counterFlash,
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
      {!assignedCard && displayNumber && (
        <div className={styles.slotNumber}>({displayNumber})</div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="loop-out"
        className={styles.handle}
        isConnectable={false}
      />
      {acceptOnly && <RestrictedSlotIcon type={acceptOnly} />}
      {displayMultiplier !== undefined && <MultiplierIndicator value={displayMultiplier} />}
    </div>
  );
}

export default SlotNode;
