import { useRef, useState } from 'react';
import styles from './MapEditorPanel.module.css';
import useMapEditorStore from '../../stores/mapEditorStore';

/*
 * 境界線ボタンの定義。`name` は `regionBorders` のキー、`label` は UI 表示名。
 * 4 本（上・右・下・左）を中心点から地図の辺まで伸ばして全体マップを 4 分割する。
 */
const BORDER_DEFS = [
  { name: 'up', label: '上境界' },
  { name: 'right', label: '右境界' },
  { name: 'down', label: '下境界' },
  { name: 'left', label: '左境界' },
];

/**
 * 座標を整数へ丸めたマップ定義の JSON 文字列を組み立てる。
 *
 * `maps.json` へ貼り戻しやすいよう、編集中マップ 1 つ分を
 * `"<mapId>": { ... }` の形（末尾カンマ付き）で 2 スペースインデントの
 * JSON にする。ドラッグ中の小数座標は `Math.round` で整数化する。
 *
 * Args:
 *     mapId (string): マップキー（例: `"map_3"`）。
 *     draft (object): 編集中のマップ定義。
 *
 * Returns:
 *     string: 貼り戻し用の JSON 文字列。
 */
function buildMapJson(mapId, draft) {
  const rounded = structuredClone(draft);
  const round = (p) => {
    if (p) {
      p.x = Math.round(p.x);
      p.y = Math.round(p.y);
    }
  };
  for (const landmark of rounded.landmarks) {
    round(landmark.position);
    round(landmark.stopPoint);
  }
  for (const junction of rounded.junctions ?? []) {
    round(junction.stopPoint);
  }
  for (const edge of rounded.edges) {
    for (const wp of edge.waypoints ?? []) {
      round(wp);
    }
  }
  round(rounded.regionCenter);
  for (const arm of Object.values(rounded.regionBorders ?? {})) {
    for (const point of arm) {
      round(point);
    }
  }
  return `"${mapId}": ${JSON.stringify(rounded, null, 2)},`;
}

/**
 * マップ座標エディタの操作パネル（HTML オーバーレイ）。
 *
 * 編集中マップの JSON を常時プレビューし、「コピー」で
 * クリップボードへ書き出す。コピーした文字列をそのまま `maps.json` の
 * 該当マップへ貼り戻す運用。`リセット` で編集開始時の座標へ戻し、`終了`
 * で編集モードを抜ける。ドラッグ操作の凡例（色と意味）も併記する。
 *
 * パネルはヘッダーを掴んで自由に移動できる（右側のハンドルが隠れて編集
 * できない、といった状況を避けるため）。初期位置は右上で、一度ドラッグ
 * すると親領域内に収まる絶対座標へ切り替わる。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onClose (function): 「終了」押下時に呼ぶハンドラ（編集モード解除）。
 *
 * Returns:
 *     JSX.Element | null: パネル要素。編集対象が無い場合は `null`。
 */
function MapEditorPanel({ onClose }) {
  const mapId = useMapEditorStore((s) => s.mapId);
  const draft = useMapEditorStore((s) => s.draft);
  const resetDraft = useMapEditorStore((s) => s.resetDraft);
  const traceMode = useMapEditorStore((s) => s.traceMode);
  const activeBorder = useMapEditorStore((s) => s.activeBorder);
  const toggleTraceMode = useMapEditorStore((s) => s.toggleTraceMode);
  const setActiveBorder = useMapEditorStore((s) => s.setActiveBorder);
  const removeLastBorderPoint = useMapEditorStore((s) => s.removeLastBorderPoint);
  const [copied, setCopied] = useState(false);

  /*
   * パネルのドラッグ移動。`pos` が null の間は CSS 既定位置（右上）に従い、
   * 一度ドラッグすると親（`.canvas`）基準の絶対座標 `{left, top}` に切り替える。
   * ヘッダーを掴んでいる間の pointerId と掴んだ瞬間の基準値を `dragRef` に
   * 保持し、移動量を足して位置を更新する。掴んだ位置がはみ出して見失わない
   * よう、親領域内へ軽くクランプする。
   */
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const [pos, setPos] = useState(null);

  if (!mapId || !draft) {
    return null;
  }

  const json = buildMapJson(mapId, draft);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleDragStart = (event) => {
    const el = panelRef.current;
    if (!el) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseLeft: el.offsetLeft,
      baseTop: el.offsetTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const el = panelRef.current;
    const parent = el?.offsetParent;
    let left = drag.baseLeft + (event.clientX - drag.startX);
    let top = drag.baseTop + (event.clientY - drag.startY);
    if (parent) {
      const maxLeft = parent.clientWidth - 48;
      const maxTop = parent.clientHeight - 48;
      left = Math.min(Math.max(left, 0), Math.max(maxLeft, 0));
      top = Math.min(Math.max(top, 0), Math.max(maxTop, 0));
    }
    setPos({ left, top });
  };

  const handleDragEnd = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragRef.current = null;
    }
  };

  const positionStyle = pos
    ? { left: `${pos.left}px`, top: `${pos.top}px`, right: 'auto' }
    : undefined;

  return (
    <div ref={panelRef} className={styles.panel} style={positionStyle}>
      <div
        className={styles.header}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        title="ドラッグで移動"
      >
        <span className={styles.title}>座標エディタ: {mapId}</span>
        <button
          type="button"
          className={styles.close}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
        >
          終了
        </button>
      </div>

      <ul className={styles.legend}>
        <li>
          <span className={`${styles.swatch} ${styles.swPosition}`} />
          position（アイコン位置・四角）
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.swStop}`} />
          stopPoint（道上の停止点・丸）
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.swJunction}`} />
          junction stopPoint（菱形）
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.swWaypoint}`} />
          waypoint（通過点・小丸）
        </li>
      </ul>
      <p className={styles.hint}>
        ハンドルをドラッグで移動／「＋」で通過点を挿入／通過点をダブル
        クリックで削除。
      </p>

      <div className={styles.regions}>
        <div className={styles.regionsHeader}>
          <span className={styles.regionsTitle}>境界線トレース</span>
          <button
            type="button"
            className={styles.trace}
            data-active={traceMode ? 'true' : 'false'}
            onClick={toggleTraceMode}
          >
            {traceMode ? 'トレース中' : 'トレース停止中'}
          </button>
        </div>
        <div className={styles.regionAdd}>
          {BORDER_DEFS.map((def) => {
            const count = (draft.regionBorders?.[def.name] ?? []).length;
            return (
              <button
                key={def.name}
                type="button"
                className={styles.regionAddButton}
                data-active={def.name === activeBorder ? 'true' : 'false'}
                onClick={() => setActiveBorder(def.name)}
              >
                {def.label}（{count}点）
              </button>
            );
          })}
        </div>
        <p className={styles.hint}>
          境界線を選ぶ→中心点（桃）から地図の端へ向けて画像をクリックして
          なぞる。頂点はドラッグで微調整、ダブルクリックで削除。中心点も
          ドラッグで動かせる。4 本すべて引くと領域の塗りが現れ、全面が
          すき間なく 4 分割される。
        </p>
        <button
          type="button"
          className={styles.regionUndo}
          onClick={removeLastBorderPoint}
          disabled={!activeBorder}
        >
          1つ戻す
        </button>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.copy} onClick={handleCopy}>
          {copied ? 'コピーしました' : 'JSON をコピー'}
        </button>
        <button type="button" className={styles.reset} onClick={resetDraft}>
          リセット
        </button>
      </div>

      <pre className={styles.json}>{json}</pre>
    </div>
  );
}

export default MapEditorPanel;
