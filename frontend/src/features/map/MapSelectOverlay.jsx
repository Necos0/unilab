import styles from './MapSelectOverlay.module.css';

/**
 * マップ移動先を選ばせるモーダル風オーバーレイ。
 *
 * 画面全体を半透明で覆い、中央のパネルに各マップを表すカードを並べる。
 * 専用のマップアイコン画像は未作成のため、暫定で地球儀絵文字 + マップ ID
 * + 既知のラベル（マップ 1 / マップ 2…）でカードを表現する。カードを
 * クリックすると `onSelect(mapId)` を呼ぶ。現在表示中のマップは選択でき
 * ないよう視覚的に薄く、`disabled` 属性を付ける。
 *
 * 背景の暗幕をクリック、または右上の「×」を押すと `onClose()` を呼んで
 * オーバーレイを閉じる。パネル領域内のクリックは伝播を止めて誤閉じを
 * 防ぐ。
 *
 * Args:
 *     props (object): React プロパティ。
 *         maps (Array<{id: string, label: string}>): 表示するマップ一覧。
 *         currentMapId (string): 現在表示中のマップ ID（無効化対象）。
 *         onSelect (function): カード押下時に呼ぶ。引数: 選んだ mapId。
 *         onClose (function): 暗幕／× 押下時に呼ぶ。
 *
 * Returns:
 *     JSX.Element: フルスクリーンの選択オーバーレイ。
 */
function MapSelectOverlay({ maps, currentMapId, onSelect, onClose }) {
  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.panel}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="マップ移動"
      >
        <div className={styles.header}>
          <span className={styles.title}>マップ移動</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <div className={styles.cardList}>
          {maps.map((m) => {
            const isCurrent = m.id === currentMapId;
            return (
              <button
                key={m.id}
                type="button"
                className={styles.card}
                disabled={isCurrent}
                onClick={() => onSelect(m.id)}
              >
                <span className={styles.cardIcon}>🌍</span>
                <span className={styles.cardLabel}>{m.label}</span>
                {isCurrent && <span className={styles.cardBadge}>現在地</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MapSelectOverlay;
