import styles from './RestrictedSlotIcon.module.css';

/**
 * カード種別制限スロット（`restricted-slot` 仕様）に表示する右上アイコン。
 *
 * `type` props（`'attack' | 'guard' | 'heal'`）に応じて 3 種類の小さな SVG
 * アイコンを返す。`SlotNode` 側で `data.acceptOnly` がセットされているスロット
 * にのみ条件付きでレンダリングされる。各アイコンは 12×12px、`shape-rendering:
 * crispEdges` で `<rect>` ベースのピクセル風意匠。
 *
 * カラーグルーピング設計：
 *   - attack: 赤系 `#ff4d4d`（剣身）＋ `#8a2a2a`（柄、暗赤で立体感）
 *     上向きの剣を縦バー + 横ガード + 柄の 3 つの rect で表現
 *   - guard: 青系 `#4a8ef0`、`GuardBar.jsx` 内蔵の盾アイコンと **完全同形・同色**
 *     プロジェクト全体で「青 = ガード」の意味付けを統一する
 *   - heal: 緑系 `#3ad430`、`BattleScreen.CrossIcon` と **完全同形・同色**
 *     プロジェクト全体で「緑 = HP/回復」の意味付けを統一する
 *
 * 配置は `.icon` CSS の `position: absolute; top: 2px; right: 2px;` で
 * スロット内側右上にバッジ風に張り付く。`z-index: 2` で配置済みカード
 * （`DraggableCard`）よりも前面に描画され、カードが置かれている状態でも
 * アイコンが視認できる（要件 3-6）。`pointer-events: none` でドラッグ操作を
 * 奪わない。
 *
 * 不正な `type`（タイプセーフでない呼び出し）に対しては `null` を返して
 * クラッシュを避ける。データ側の `isValidAcceptOnly` ガード（`stagesLoader.js`）
 * が事前に弾く前提だが、防御的なフォールバックを残している。
 *
 * インライン SVG を採用する理由：14×14 の小さなピクセル風アイコンは
 * `<img src="...png">` だと DPR や OS のスケーリングで滲みやすい。
 * `shape-rendering: crispEdges` 付き SVG なら解像度独立で確実にピクセル境界
 * が保てる。色やサイズの将来調整も 1 ファイルで完結する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         type (string): 表示するアイコン種別。`'attack'` / `'guard'` / `'heal'`
 *             のいずれか。それ以外の値は `null` を返す。
 *
 * Returns:
 *     JSX.Element | null: 対応する SVG 要素、または不正値時 `null`。
 */
function RestrictedSlotIcon({ type }) {
  if (type === 'attack') return <AttackIcon />;
  if (type === 'guard') return <GuardIcon />;
  if (type === 'heal') return <HealIcon />;
  return null;
}

function AttackIcon() {
  return (
    <svg
      viewBox="0 0 14 14"
      className={styles.icon}
      shapeRendering="crispEdges"
    >
      <rect x="6" y="1" width="2" height="7" fill="#ff4d4d" />
      <rect x="3" y="7" width="8" height="2" fill="#ff4d4d" />
      <rect x="6" y="9" width="2" height="4" fill="#8a2a2a" />
    </svg>
  );
}

function GuardIcon() {
  return (
    <svg
      viewBox="0 0 14 14"
      className={styles.icon}
      shapeRendering="crispEdges"
    >
      <rect x="3" y="2" width="8" height="2" fill="#4a8ef0" />
      <rect x="2" y="4" width="10" height="6" fill="#4a8ef0" />
      <rect x="3" y="10" width="8" height="1" fill="#4a8ef0" />
      <rect x="4" y="11" width="6" height="1" fill="#4a8ef0" />
      <rect x="5" y="12" width="4" height="1" fill="#4a8ef0" />
    </svg>
  );
}

function HealIcon() {
  return (
    <svg
      viewBox="0 0 14 14"
      className={styles.icon}
      shapeRendering="crispEdges"
    >
      <rect x="5" y="2" width="4" height="10" fill="#3ad430" />
      <rect x="2" y="5" width="10" height="4" fill="#3ad430" />
    </svg>
  );
}

export default RestrictedSlotIcon;