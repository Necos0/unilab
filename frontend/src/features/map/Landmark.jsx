import styles from './Landmark.module.css';
import LandmarkScroll from './LandmarkScroll';
import LandmarkDetail from './LandmarkDetail';

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

  const groupClassName = [styles.landmark, isMoving && styles.disabled]
    .filter(Boolean)
    .join(' ');

  const handleClick = () => {
    if (isMoving) {
      return;
    }
    onClick(id);
  };

  const handleFight = () => {
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
          - ラベル：translate(0, -55)、半高 16 → 上端 y = -71
          - 詳細：translate(0, -141)、半高 70 → 下端 y = -71
        詳細パネルの opacity は data-arrived 属性で CSS が切り替える。
      */}
      <g transform="translate(0, -55)">
        <LandmarkScroll label={label} />
      </g>
      {hasStage && (
        <g transform="translate(0, -141)">
          <LandmarkDetail difficulty={difficulty} onFight={handleFight} />
        </g>
      )}
    </g>
  );
}

export default Landmark;
