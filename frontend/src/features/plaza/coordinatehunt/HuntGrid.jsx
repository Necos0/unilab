import styles from './HuntGrid.module.css';

/* 盤面のよこのマス数。マップ画像の幅 1920px を CELL_SIZE で割った数 */
export const GRID_COLS = 16;

/* 盤面のたてのマス数。マップ画像の高さ 1080px を CELL_SIZE で割った数 */
export const GRID_ROWS = 9;

/* 1 マスの一辺(マップ画像のピクセル基準) */
const CELL_SIZE = 120;

/* 座標ラベルを置く余白の幅(左)と高さ(下) */
const LABEL_MARGIN = 90;

/* 盤面の背景に使うマップ画像(本編ワールド 1 の草原マップを流用) */
const MAP_IMAGE_SRC = '/maps/map_1.png';

const MAP_WIDTH = GRID_COLS * CELL_SIZE;
const MAP_HEIGHT = GRID_ROWS * CELL_SIZE;

/* 正解マーカー(きらめき)の頂点列。中心 (0, 0) 基準の 4 方向スパーク */
const SPARKLE_POINTS = '0,-52 13,-13 52,0 13,13 0,52 -13,13 -52,0 -13,-13';

/**
 * マスの中心の SVG 座標を求める。
 *
 * ゲームの座標系(左下が (0, 0)、たては上向き)を、SVG の座標系(左上が
 * 原点、y は下向き)へ変換する。この向きの反転が本ゲームの座標系の要。
 *
 * Args:
 *     cell ({x: number, y: number}): ゲーム座標系のマス。
 *
 * Returns:
 *     {cx: number, cy: number}: マス中心の SVG 座標。
 */
function cellCenter(cell) {
  return {
    cx: cell.x * CELL_SIZE + CELL_SIZE / 2,
    cy: (GRID_ROWS - 1 - cell.y) * CELL_SIZE + CELL_SIZE / 2,
  };
}

/**
 * 「ざひょうたからさがし」の盤面(マップ+格子+座標ラベル)。
 *
 * マップ画像の上に 16×9 の格子を重ね、左の余白にたて(y)、下の余白に
 * よこ(x)の座標ラベルを並べた SVG を描画する。ラベルは算数の座標平面に
 * 合わせ、よこは右へ・たては上へ増える(左下のマスが (0, 0))。
 *
 * 各マスは透明な rect で覆い、ホバーで淡く光らせ、クリックでゲーム座標を
 * `onCellClick` へ渡す。正誤の演出は `feedback` に従って描画する:
 *   - hit : マス中心にきらめきマーク+獲得点数のフロート表示
 *   - miss: マス中心に赤いバツ+「ここは (x, y)」と実際の座標を表示
 *     (どこを押してしまったかを座標で見せる、教育上いちばん大事な表示)
 *
 * 演出のアニメーションは CSS の一回再生で行い、`feedback.id` を key に
 * して同じマスが連続しても要素を作り直して再生し直す。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onCellClick (function): マスをクリックしたとき、ゲーム座標
 *             `{x, y}` を引数に呼ぶハンドラ。
 *         feedback (object | null): 表示する正誤マーカー。null なら非表示。
 *             `{id: number, type: 'hit'|'miss', cell: {x, y}, points?: number}`。
 *
 * Returns:
 *     JSX.Element: 盤面全体の svg 要素。
 */
function HuntGrid({ onCellClick, feedback }) {
  /* クリック判定用の透明マス。JSX のクロージャに捕捉させる値は再代入の
     ないもの(Array.from のコールバック引数由来)にする */
  const cells = Array.from({ length: GRID_ROWS * GRID_COLS }, (_, index) => {
    const row = Math.floor(index / GRID_COLS);
    const col = index % GRID_COLS;
    const cellY = GRID_ROWS - 1 - row;
    return (
      <rect
        key={`cell-${col}-${row}`}
        className={styles.cell}
        x={col * CELL_SIZE}
        y={row * CELL_SIZE}
        width={CELL_SIZE}
        height={CELL_SIZE}
        onClick={() => onCellClick({ x: col, y: cellY })}
      />
    );
  });

  const gridLines = [];
  for (let col = 1; col < GRID_COLS; col += 1) {
    gridLines.push(
      <line
        key={`v-${col}`}
        className={styles.line}
        x1={col * CELL_SIZE}
        x2={col * CELL_SIZE}
        y1={0}
        y2={MAP_HEIGHT}
      />,
    );
  }
  for (let row = 1; row < GRID_ROWS; row += 1) {
    gridLines.push(
      <line
        key={`h-${row}`}
        className={styles.line}
        x1={0}
        x2={MAP_WIDTH}
        y1={row * CELL_SIZE}
        y2={row * CELL_SIZE}
      />,
    );
  }

  const labels = [];
  for (let col = 0; col < GRID_COLS; col += 1) {
    labels.push(
      <text
        key={`lx-${col}`}
        className={styles.label}
        x={col * CELL_SIZE + CELL_SIZE / 2}
        y={MAP_HEIGHT + 60}
      >
        {col}
      </text>,
    );
  }
  for (let row = 0; row < GRID_ROWS; row += 1) {
    labels.push(
      <text
        key={`ly-${row}`}
        className={styles.label}
        x={-LABEL_MARGIN / 2}
        y={row * CELL_SIZE + CELL_SIZE / 2 + 16}
      >
        {GRID_ROWS - 1 - row}
      </text>,
    );
  }

  let feedbackMarker = null;
  if (feedback) {
    const { cx, cy } = cellCenter(feedback.cell);
    /* 上端の行では吹き出しテキストが盤面の外へはみ出すため下側に出す */
    const textY = cy < CELL_SIZE ? cy + 96 : cy - 68;
    /* 左右端では中央ぞろえテキストがはみ出すため内側に寄せる */
    const textX = Math.min(Math.max(cx, 200), MAP_WIDTH - 200);
    feedbackMarker =
      feedback.type === 'hit' ? (
        <g key={feedback.id} pointerEvents="none">
          <polygon
            className={styles.hitSparkle}
            points={SPARKLE_POINTS}
            transform={`translate(${cx} ${cy})`}
          />
          <text className={styles.hitPoints} x={textX} y={textY}>
            +{feedback.points}
          </text>
        </g>
      ) : (
        <g key={feedback.id} pointerEvents="none">
          <line
            className={styles.missCross}
            x1={cx - 34}
            y1={cy - 34}
            x2={cx + 34}
            y2={cy + 34}
          />
          <line
            className={styles.missCross}
            x1={cx + 34}
            y1={cy - 34}
            x2={cx - 34}
            y2={cy + 34}
          />
          <text className={styles.missLabel} x={textX} y={textY}>
            ここは ({feedback.cell.x}, {feedback.cell.y})
          </text>
        </g>
      );
  }

  return (
    <svg
      className={styles.board}
      viewBox={`${-LABEL_MARGIN} 0 ${MAP_WIDTH + LABEL_MARGIN} ${MAP_HEIGHT + LABEL_MARGIN}`}
      role="img"
      aria-label="ざひょうの ばんめん"
    >
      <image
        href={MAP_IMAGE_SRC}
        x={0}
        y={0}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
      />
      {gridLines}
      <rect
        className={styles.frame}
        x={0}
        y={0}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
      />
      {labels}
      {cells}
      {feedbackMarker}
    </svg>
  );
}

export default HuntGrid;
