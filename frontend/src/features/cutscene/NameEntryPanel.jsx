import { useState } from 'react';
import styles from './NameEntryPanel.module.css';

/*
 * 名前の最大文字数。
 */
const NAME_MAX_LENGTH = 8;

/*
 * ひらがな表の列定義。1 要素が縦 1 列（上から 5 マス）で、左から順に並べる。
 * 空文字はマスの「空き」（や行・わ行などの抜け）を表し、ボタンを置かない。
 */
const KANA_COLUMNS = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', '', 'ゆ', '', 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', '', 'を', '', 'ん'],
  ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  ['だ', 'ぢ', 'づ', 'で', 'ど'],
  ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
  ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
  ['ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ'],
  ['ゃ', '', 'ゅ', '', 'ょ'],
  ['っ', '', 'ー', '', ''],
];

/**
 * ひらがな表でプレイヤー名を入力するパネル（RPG によくある名前入力画面）。
 *
 * オープニング会話の `nameInput` step で `RoboBubble` が表示する。上段に
 * 入力中の名前（`NAME_MAX_LENGTH` 文字ぶんのマス）、中央にひらがな表
 * （五十音＋濁音・半濁音・小書き・長音）、下段に「けす」（1 文字削除）と
 * 「けってい」（確定）のボタンを置く。文字はマウス（タップ）のクリックで
 * 1 文字ずつ追加する。入力マスは必ず空の状態から始める（保存済みの名前が
 * あってもプレースホルダーとして見せない）。
 *
 * パネル内のクリックは `stopPropagation` で親レイヤー（クリックで吹き出しを
 * 送る `RoboBubble` の全面レイヤー）へ届かないようにする。確定は空白のみの
 * 名前では押せず、`onSubmit` に確定した名前を渡す（保存や step 送りは
 * 呼び出し側の責務）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onSubmit (function): 「けってい」で呼ぶ関数。引数は確定した名前 (string)。
 *
 * Returns:
 *     JSX.Element: 名前入力パネル要素。
 */
function NameEntryPanel({ onSubmit }) {
  const [name, setName] = useState('');

  /* 表の文字を末尾へ 1 文字追加する（最大文字数に達していたら無視）。 */
  const appendChar = (char) => {
    setName((current) =>
      current.length < NAME_MAX_LENGTH ? current + char : current,
    );
  };

  /* 末尾の 1 文字を消す。 */
  const deleteChar = () => {
    setName((current) => current.slice(0, -1));
  };

  const trimmedName = name.trim();

  return (
    <div
      className={styles.panel}
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-label="なまえを いれてね"
    >
      <p className={styles.title}>なまえを いれてね</p>
      <div className={styles.slots}>
        {Array.from({ length: NAME_MAX_LENGTH }, (_, index) => (
          <span key={index} className={styles.slot}>
            {name[index] ?? ''}
          </span>
        ))}
      </div>
      <div className={styles.kanaGrid}>
        {KANA_COLUMNS.map((column, columnIndex) =>
          column.map((char, rowIndex) =>
            char ? (
              <button
                key={`${columnIndex}-${rowIndex}`}
                type="button"
                className={styles.kanaButton}
                onClick={() => appendChar(char)}
              >
                {char}
              </button>
            ) : (
              <span key={`${columnIndex}-${rowIndex}`} aria-hidden="true" />
            ),
          ),
        )}
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={deleteChar}
          disabled={name.length === 0}
        >
          けす
        </button>
        <button
          type="button"
          className={`${styles.actionButton} ${styles.submitButton}`}
          onClick={() => onSubmit(trimmedName)}
          disabled={trimmedName.length === 0}
        >
          けってい
        </button>
      </div>
    </div>
  );
}

export default NameEntryPanel;
