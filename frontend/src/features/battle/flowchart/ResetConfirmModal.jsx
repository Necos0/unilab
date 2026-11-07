import { createPortal } from 'react-dom';
import styles from './ResetConfirmModal.module.css';

/**
 * フローチャートのリセットを実行する前の確認モーダル．
 *
 * `ResetButton` が押されたとき，すぐリセットせず確認を挟むために出す（拡大
 * しようとして誤ってリセットする事故を防ぐ）．画面全体を覆う暗幕＋中央パネルで
 * 「もどす／やめる」の2択を出し，暗幕クリックは「やめる」と同じ扱いにする．
 * React Flow の transform 下でも画面基準になるよう `createPortal` で body へ出す．
 * 見た目は `BattleFailOverlay` のボタン意匠に合わせる．
 *
 * Args:
 *     props (object): React プロパティ．
 *         onConfirm (function): 「もどす」押下時に呼ぶ（実際にリセットする）．
 *         onCancel (function): 「やめる」押下・暗幕クリック時に呼ぶ（閉じる）．
 *
 * Returns:
 *     JSX.Element: body 直下にポータル表示する確認モーダル．
 */
function ResetConfirmModal({ onConfirm, onCancel }) {
  return createPortal(
    <div className={styles.backdrop} onClick={onCancel} role="presentation">
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <p className={styles.message}>カードを ぜんぶ もどして やりなおす？</p>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.button} onClick={onCancel}>
            いいえ
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.confirm}`}
            onClick={onConfirm}
          >
            はい
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ResetConfirmModal;
