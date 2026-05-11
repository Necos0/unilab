import { useDraggable } from '@dnd-kit/core';
import Card from './Card';
import useBattleStore from '../../stores/battleStore';
import styles from './DraggableCard.module.css';

/**
 * カードをドラッグ可能にする薄いラッパーコンポーネント。
 *
 * 既存の `Card`（描画専用）を `useDraggable` でラップし、ドラッグ時の
 * `id` として `card.instanceId` を、`data.source` としてドラッグ元の種別
 * （`'hand'` または元スロット ID）を渡す。`source` は `BattleScreen` の
 * `onDragEnd` がストアの `endDrag` に転送する際に必要となる。
 *
 * ドラッグ中は、ストアの `activeInstanceId` が自身の `instanceId` と一致
 * するときに半透明化して「つかんでいる」ことを元位置に示す。実際に
 * ポインタに追従するカードは `BattleScreen` 側の `DragOverlay` が
 * 別途描画する。
 *
 * 勝利演出中（`victoryPhase !== null`）と失敗演出中（`failPhase !== null`）は
 * `useDraggable` に `disabled: true` を渡し、ライブラリ側でドラッグ開始を
 * 抑止する（`victory-clear` 要件 6-1、`battle-fail-retry` 要件 7-4）。戦闘画面
 * ルートに付与される `.root.victory` ／ `.root.failed` の `pointer-events: none`
 * だけでは dnd-kit の pointer 監視を確実に止められない場合があるため、
 * dnd-kit 公式の disabled API でカード側からも明示的に無効化する。とくに
 * `SlotNode` 側で `pointer-events: auto` をローカルに当てているため、ルートの
 * `none` がスロット配下で突き抜けてしまう。両演出とも CSS と dnd-kit API の
 * 二重防御で確実にドラッグ開始を抑止する設計。
 *
 * 同様に、ステージ定義側で固定配置されたロックカード（`card.locked === true`）
 * もドラッグ開始を抑止する（monster-attack 要件 2-3）。モンスターカードの
 * ようにユーザーが動かせないカードは、UI 上で「掴めない」反応をするのが
 * 自然な挙動。`battleStore.computeDropTransition` 側にも同等のガードがあり
 * 二重防御になっている：dnd-kit 側で抑止するのが UX 的に正しいが、万が一
 * そこを抜けても状態遷移層で弾けるためデータが壊れない。
 *
 * 配置先のコンテナに合わせてサイズ計算方法を切り替えるため `variant` を
 * 受け取る：
 *   - `'hand'`（既定）: 手札レイアウトで使用。`height: 100%` + `aspect-ratio: 2/3`
 *     で親の高さに合わせつつ、幅は 2:3 から算出する
 *   - `'fill'`       : スロットなど、親自身がすでに 2:3 のサイズを持つ
 *     箱で使用。`width: 100%` + `height: 100%` でそのまま埋める
 *
 * Args:
 *     props (object): React プロパティ。
 *         card (object): `CardInstance`。`instanceId` / `id` / `power` を持つ。
 *         source (string): ドラッグ元。`'hand'` またはスロット ID。
 *         variant (string): サイズ方式。`'hand'` または `'fill'`。既定は `'hand'`。
 *
 * Returns:
 *     JSX.Element: ドラッグ可能な領域としてカードを包む div 要素。
 */
function DraggableCard({ card, source, variant = 'hand' }) {
  const victoryPhase = useBattleStore((s) => s.victoryPhase);
  const failPhase = useBattleStore((s) => s.failPhase);
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: card.instanceId,
    data: { source },
    disabled: victoryPhase !== null || failPhase !== null || card.locked === true,
  });
  const isDragging = useBattleStore(
    (s) => s.activeInstanceId === card.instanceId,
  );

  const className = [
    styles.root,
    variant === 'fill' ? styles.fill : styles.hand,
    isDragging && styles.dragging,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={setNodeRef}
      className={className}
      {...listeners}
      {...attributes}
    >
      <Card card={card} />
    </div>
  );
}

export default DraggableCard;
