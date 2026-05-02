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
 * ランドマークにマウスを合わせたときに表示される詳細パネル。
 *
 * パーチメント風の角丸矩形を背景に、上半分に難易度を星で、下半分に
 * 「たたかう」ボタンを配置する。SVG `<g>` を返すため、親側で
 * `transform="translate(...)"` により位置を制御する。表示／非表示は
 * 親の CSS（`:hover`）に任せ、本コンポーネント自体は常時マウントされる
 * 想定。`onFight` は「たたかう」ボタンのクリック時にイベント伝搬を
 * 止めた上で呼ばれる（ランドマーク本体のクリック＝移動要求と区別する
 * ため）。
 *
 * `canFight` が `false` のとき（プレイヤーがそのランドマークに到着して
 * いない／移動中など）はボタンを灰色に落とし、クリックも無視して
 * 「近づいてから戦う」運用を強制する。ボタン下部にヒント文も差し替え
 * 表示してユーザーに状況を伝える。
 *
 * Args:
 *     props (object): React プロパティ。
 *         difficulty (number): 1〜5 の難易度。
 *         canFight (boolean): 「たたかう」を有効化してよいか。
 *         onFight (function): 「たたかう」ボタンのクリックハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: 詳細パネル全体を表す `<g>` 要素。
 */
function LandmarkDetail({ difficulty, canFight, onFight }) {
  const halfWidth = 100;
  const halfHeight = 80;

  const handleFightClick = (event) => {
    event.stopPropagation();
    if (!canFight) {
      return;
    }
    onFight();
  };

  const fightButtonClassName = [
    styles.fightButton,
    !canFight && styles.fightButtonDisabled,
  ]
    .filter(Boolean)
    .join(' ');

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
      <g className={fightButtonClassName} onClick={handleFightClick}>
        <rect
          x={-60}
          y={halfHeight - 56}
          width={120}
          height={36}
          rx={4}
          ry={4}
          className={styles.fightBg}
        />
        <text
          x={0}
          y={halfHeight - 32}
          textAnchor="middle"
          className={styles.fightText}
        >
          たたかう
        </text>
      </g>
      {!canFight && (
        <text
          x={0}
          y={halfHeight - 6}
          textAnchor="middle"
          className={styles.hint}
        >
          近づいて戦おう
        </text>
      )}
    </g>
  );
}

export default LandmarkDetail;
