import styles from './Landmark.module.css';
import LandmarkScroll from './LandmarkScroll';
import LandmarkDetail from './LandmarkDetail';

/**
 * 1 個分のランドマークを SVG 上に描画し、クリック・ホバーを受け付ける
 * コンポーネント。
 *
 * 全てのランドマークに対し、中心の上方に巻物形のバナー
 * （`LandmarkScroll`）を常時表示する。`stageId` を持つランドマーク
 * （戦闘可能な場所）ではさらに、マウスを乗せている間だけ CSS `:hover`
 * で詳細パネル（`LandmarkDetail`）をフェード表示し、難易度と
 * 「たたかう」ボタンを見せる。詳細パネルは巻物の真上に隙間なく接する
 * ように配置することで、巻物→詳細パネルへカーソルを移すあいだも
 * `:hover` が外れないようにしている。`stageId` を持たない出発点
 * （村の門）は巻物だけを表示し、詳細パネルは描かない。
 *
 * クリックには 2 通りある：
 *   - 巻物クリック → `onClick(id)` で移動要求（`isMoving===true` の
 *     あいだは移動要求も詳細表示も完全に無効化する）
 *   - 詳細パネル内「たたかう」ボタン → `onStartBattle(stageId)` で戦闘
 *     画面へ遷移（イベント伝搬を止めて移動要求とは別経路にする）。
 *     ただしプレイヤーがそのランドマークに到着していない（または移動中）
 *     ときはボタンを無効化し、近づくまで戦えないようにする。
 *
 * Args:
 *     props (object): React プロパティ。
 *         landmark (object): `id` / `label` / `position` / `stageId?` /
 *             `difficulty?` を持つランドマーク定義。
 *         isMoving (boolean): 現在キャラクターが移動中かどうか。
 *         currentLocation (string): プレイヤーが現在立っているノード ID。
 *             `landmark.id` と一致しているときだけ「たたかう」が押せる。
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
  const canFight = !isMoving && currentLocation === id;

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
      transform={`translate(${position.x}, ${position.y})`}
      onClick={handleClick}
    >
      {/*
        巻物と詳細パネルは隙間なく接するように配置する。
          - 巻物：translate(0, -55)、半高 16 → 上端 y = -71
          - 詳細：translate(0, -151)、半高 80 → 下端 y = -71
        これにより、巻物→詳細パネルへカーソルを移すあいだも :hover が
        途切れず、追加の透明ヒット領域は不要。
      */}
      <g transform="translate(0, -55)">
        <LandmarkScroll label={label} />
      </g>
      {hasStage && (
        <g transform="translate(0, -151)">
          <LandmarkDetail
            difficulty={difficulty}
            canFight={canFight}
            onFight={handleFight}
          />
        </g>
      )}
    </g>
  );
}

export default Landmark;
