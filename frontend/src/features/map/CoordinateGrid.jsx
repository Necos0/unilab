import { useEffect, useState } from 'react';
import styles from './CoordinateGrid.module.css';

const STEP = 100;

/**
 * 座標調整用の一時的なデバッグオーバーレイ。
 *
 * SVG `<g>` として 100px 間隔の格子と各軸の座標ラベルを描画し、画面右上に
 * 現在のマウス座標（viewBox 基準）を表示する HTML 要素も合わせて返す。
 * `maps.json` のランドマーク `position` / `stopPoint` / `waypoints` を実画像
 * 上で目視確認しながら微調整するための補助で、確定後は MapScreen から
 * 取り外す。
 *
 * Args:
 *     props (object): React プロパティ。
 *         viewBox ({width: number, height: number}): 親 SVG の viewBox 寸法。
 *
 * Returns:
 *     JSX.Element: 格子を含む `<g>` 要素＋座標表示の `<foreignObject>`。
 */
function CoordinateGrid({ viewBox }) {
  const [cursor, setCursor] = useState(null);

  useEffect(() => {
    const svg = document.querySelector('svg');
    if (!svg) {
      return undefined;
    }
    const handleMove = (event) => {
      const pt = svg.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) {
        return;
      }
      const p = pt.matrixTransform(ctm.inverse());
      setCursor({ x: Math.round(p.x), y: Math.round(p.y) });
    };
    svg.addEventListener('mousemove', handleMove);
    return () => svg.removeEventListener('mousemove', handleMove);
  }, []);

  const verticalLines = [];
  for (let x = 0; x <= viewBox.width; x += STEP) {
    verticalLines.push(
      <line
        key={`v-${x}`}
        x1={x}
        x2={x}
        y1={0}
        y2={viewBox.height}
        className={styles.line}
      />,
    );
    verticalLines.push(
      <text key={`vt-${x}`} x={x + 4} y={20} className={styles.label}>
        {x}
      </text>,
    );
  }
  const horizontalLines = [];
  for (let y = 0; y <= viewBox.height; y += STEP) {
    horizontalLines.push(
      <line
        key={`h-${y}`}
        x1={0}
        x2={viewBox.width}
        y1={y}
        y2={y}
        className={styles.line}
      />,
    );
    horizontalLines.push(
      <text key={`ht-${y}`} x={4} y={y - 4} className={styles.label}>
        {y}
      </text>,
    );
  }

  return (
    <g pointerEvents="none">
      {verticalLines}
      {horizontalLines}
      <foreignObject
        x={viewBox.width - 260}
        y={viewBox.height - 60}
        width={240}
        height={50}
      >
        <div className={styles.readout}>
          {cursor ? `x=${cursor.x}, y=${cursor.y}` : 'x=?, y=?'}
        </div>
      </foreignObject>
    </g>
  );
}

export default CoordinateGrid;
