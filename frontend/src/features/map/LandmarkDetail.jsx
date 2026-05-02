import styles from './LandmarkDetail.module.css';

const MAX_DIFFICULTY = 5;

/**
 * 難易度（1〜5）を ★／☆ の連結文字列に整形する純関数。
 *
 * Args:
 *     difficulty (number): 1 以上 5 以下の整数（範囲外は clamp する）。
 *
 * Returns:
 *     string: 例 difficulty=3 → '★★★☆☆'。
 */
function formatStars(difficulty) {
  const filled = Math.max(0, Math.min(MAX_DIFFICULTY, difficulty));
  return '★'.repeat(filled) + '☆'.repeat(MAX_DIFFICULTY - filled);
}

/**
 * ランドマーク到着時に表示される詳細パネル。
 *
 * パーチメント風の角丸矩形を背景に、上半分に難易度を星で、下半分に
 * 「たたかう」ボタンを配置する。SVG `<g>` を返すため、親側で
 * `transform="translate(...)"` により位置を制御する。表示／非表示は
 * 親 Landmark 側の data-arrived 属性に紐づく CSS が opacity で切り替える
 * （本コンポーネント自体は常時マウントされてフェードのみ受け持つ）。
 * `onFight` は「たたかう」ボタンのクリック時にイベント伝搬を止めた上で
 * 呼ばれる（ラベルクリック＝移動要求と区別するため）。表示中は必ず
 * プレイヤーが到着済みなので、ボタン側に到着判定は不要。
 *
 * Args:
 *     props (object): React プロパティ。
 *         difficulty (number): 1〜5 の難易度。
 *         onFight (function): 「たたかう」ボタンのクリックハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: 詳細パネル全体を表す `<g>` 要素。
 */
function LandmarkDetail({ difficulty, onFight }) {
  const halfWidth = 100;
  const halfHeight = 70;

  const handleFightClick = (event) => {
    event.stopPropagation();
    onFight();
  };

  return (
    <g data-role="detail">
      <rect
        x={-halfWidth}
        y={-halfHeight}
        width={halfWidth * 2}
        height={halfHeight * 2}
        rx={6}
        ry={6}
        className={styles.panel}
      />
      <text x={0} y={-halfHeight + 28} textAnchor="middle" className={styles.label}>
        難易度
      </text>
      <text x={0} y={-halfHeight + 56} textAnchor="middle" className={styles.stars}>
        {formatStars(difficulty)}
      </text>
      <g className={styles.fightButton} onClick={handleFightClick}>
        <rect
          x={-60}
          y={halfHeight - 50}
          width={120}
          height={36}
          rx={4}
          ry={4}
          className={styles.fightBg}
        />
        <text
          x={0}
          y={halfHeight - 26}
          textAnchor="middle"
          className={styles.fightText}
        >
          たたかう
        </text>
      </g>
    </g>
  );
}

export default LandmarkDetail;
