import styles from './Landmark.module.css';
import LandmarkScroll from './LandmarkScroll';
import LandmarkDetail from './LandmarkDetail';
import useProgressStore, {
  isStageClearedSelector,
  isStageUnlockedSelector,
} from '../../stores/progressStore';

/**
 * 1 個分のランドマークを SVG 上に描画し、クリック・到着判定を受け付ける
 * コンポーネント。
 *
 * 全てのランドマークに対し、中心の上方に矩形のラベルバナー
 * （`LandmarkScroll`）を常時表示する。`stageId` を持つランドマーク
 * （戦闘可能な場所）には詳細パネル（`LandmarkDetail`）も常時マウントし、
 * **プレイヤーがそのランドマークに到着して静止している間だけ** CSS の
 * data-arrived 属性で opacity を切り替えてフェード表示する。ホバーは
 * 表示の引き金にしない（旧仕様の hover 表示は廃止）。
 *
 * `stageId` を持つランドマークは `progressStore` を購読して、ロック状態
 * （未解放）とクリア状態を反映する：
 *   - `isUnlocked === false`（未解放） → `LandmarkScroll` にロック
 *     オーバーレイ（鎖＋南京錠）を重ね、クリックを抑止する（要件 1-2, 2-1）
 *   - `pendingUnlockStageId === stageId` → 直近のクリアで新たに解放された
 *     対象。アニメ中は `isFading` でロックをフェードアウトさせる（要件 5-1）
 *   - `isUnlockAnimating === true` → アニメ中は全マップクリックを抑止
 *     （要件 5-3, 5-4）
 *   - `isCleared === true` → 詳細パネルに「クリア済み」を表示（要件 6-1）
 *
 * `stageId` を持たないランドマーク（村の門等の経由地）は解放判定の
 * 対象外。ロック表示も「クリア済み」表示も行わず、`isUnlockAnimating`
 * 中だけクリック抑止に従う（要件 1-3, 5-3）。
 *
 * クリックには 2 通りある：
 *   - ラベル（巻物）クリック → `onClick(id)` で移動要求（`isMoving===true`
 *     のあいだは移動要求を発火しない）
 *   - 詳細パネル内「たたかう」ボタン → `onStartBattle(stageId)` で戦闘
 *     画面へ遷移（イベント伝搬を止めて移動要求とは別経路にする）。
 *     パネル自体が到着中しか表示されないので、押した時点で必ず到着済み。
 *
 * Args:
 *     props (object): React プロパティ。
 *         landmark (object): `id` / `label` / `position` / `stageId?` /
 *             `difficulty?` を持つランドマーク定義。
 *         isMoving (boolean): 現在キャラクターが移動中かどうか。
 *         currentLocation (string): プレイヤーが現在立っているノード ID。
 *             `landmark.id` と一致しているときに到着扱い。
 *         onClick (function): クリック時に `landmark.id` を渡して呼ぶ関数。
 *         onStartBattle (function): 「たたかう」ボタン押下時に
 *             `landmark.stageId` を渡して呼ぶ関数。
 *
 * Returns:
 *     JSX.Element: ランドマーク 1 個分の `<g>` 要素。
 */
function Landmark({
  landmark,
  isMoving,
  currentLocation,
  onClick,
  onStartBattle,
}) {
  const { id, label, position, stageId, difficulty } = landmark;
  const hasStage = Boolean(stageId);
  const isArrived = !isMoving && currentLocation === id;

  const isUnlocked = useProgressStore(
    hasStage ? isStageUnlockedSelector(stageId) : () => true,
  );
  const isCleared = useProgressStore(
    hasStage ? isStageClearedSelector(stageId) : () => false,
  );
  const pendingUnlockStageId = useProgressStore(
    (state) => state.pendingUnlockStageId,
  );
  const isUnlockAnimating = useProgressStore(
    (state) => state.isUnlockAnimating,
  );

  const isPendingUnlockTarget = hasStage && pendingUnlockStageId === stageId;
  const shouldShowLock = hasStage && (!isUnlocked || isPendingUnlockTarget);
  const isFading = isPendingUnlockTarget && isUnlockAnimating;
  const isLockedFromClick = hasStage && !isUnlocked;
  const isDisabled = isMoving || isUnlockAnimating || isLockedFromClick;

  const groupClassName = [styles.landmark, isDisabled && styles.disabled]
    .filter(Boolean)
    .join(' ');

  const handleClick = () => {
    if (isDisabled) {
      return;
    }
    onClick(id);
  };

  const handleFight = () => {
    if (isLockedFromClick || isUnlockAnimating) {
      return;
    }
    onStartBattle(stageId);
  };

  return (
    <g
      className={groupClassName}
      data-arrived={isArrived ? 'true' : 'false'}
      transform={`translate(${position.x}, ${position.y})`}
      onClick={handleClick}
    >
      {/*
        ラベルと詳細パネルは隙間なく接するように配置する。
          - ラベル：translate(0, -36)、半高 35 → 上端 y = -71
          - 詳細：translate(0, -141)、半高 70 → 下端 y = -71
        詳細パネルの opacity は data-arrived 属性で CSS が切り替える。
      */}
      <g transform="translate(0, -36)">
        <LandmarkScroll
          text={stageId ?? label}
          isLocked={shouldShowLock}
          isFading={isFading}
        />
      </g>
      {hasStage && (
        <g transform="translate(0, -141)">
          <LandmarkDetail
            name={label}
            difficulty={difficulty}
            onFight={handleFight}
            isCleared={isCleared}
          />
        </g>
      )}
    </g>
  );
}

export default Landmark;
