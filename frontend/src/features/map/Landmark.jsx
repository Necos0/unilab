import styles from './Landmark.module.css';

/**
 * 1 個分のランドマークを SVG 上に描画し、クリックを受け付けるコンポーネント。
 *
 * 現状はプレースホルダとして円とラベルテキストを描く。クリックで
 * `mapStore.requestMove(id)` 相当の `onClick(id)` を呼び出し、移動中
 * （`isMoving === true`）はクリック判定を無効化する（要件 4-5）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         landmark (object): `id` / `label` / `position` を持つランドマーク定義。
 *         isMoving (boolean): 現在キャラクターが移動中かどうか。
 *         onClick (function): クリック時に `landmark.id` を渡して呼ぶ関数。
 *
 * Returns:
 *     JSX.Element: ランドマーク 1 個分の `<g>` 要素。
 */
function Landmark({ landmark, isMoving, onClick }) {
  const { id, label, position } = landmark;
  const groupClassName = [styles.landmark, isMoving && styles.disabled]
    .filter(Boolean)
    .join(' ');

  const handleClick = () => {
    if (isMoving) {
      return;
    }
    onClick(id);
  };

  return (
    <g
      className={groupClassName}
      transform={`translate(${position.x}, ${position.y})`}
      onClick={handleClick}
    >
      <circle r={32} className={styles.hit} />
      <circle r={14} className={styles.dot} />
      {label && (
        <text y={-28} textAnchor="middle" className={styles.label}>
          {label}
        </text>
      )}
    </g>
  );
}

export default Landmark;
