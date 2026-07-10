import { useState } from 'react';
import styles from './CardHelpWindow.module.css';
import cardHelpData from '../../data/card_help.json';
import tokenizeFurigana from '../cutscene/tokenizeFurigana';
import Card from '../cards/Card';
import useProgressStore from '../../stores/progressStore';

/**
 * 未出（まだ出会っていない）カードのタブ・名前に使う伏せ字ラベル。
 */
const LOCKED_LABEL = '？？？カード';

/**
 * カードごとのテーマ色（アクセント色）。
 *
 * 攻撃=赤・防御=青・回復=緑・反射=橙と、戦闘画面のフロート演出（ダメージ赤／
 * ガード青／回復緑／反射橙）と同じ色割りに揃えることで、ヘルプ画面と実戦の
 * 演出が同じ「意味の色」で結びつくようにする。各カードの枠・名前・タブの
 * 強調色として CSS 変数（`--accent`）経由で使う。
 */
const CARD_ACCENTS = {
  attack: '#e0563b',
  guard: '#4a8ef0',
  heal: '#3ad430',
  reflect: '#f0a040',
};

/**
 * `漢字《ふりがな》` 記法のテキストを、ルビ付きの React ノード列へ変換する。
 *
 * `RoboBubble` の読み上げ表示と同じ `tokenizeFurigana` でトークン化し、
 * こちらは静的表示なので全トークンを一度に描画する（タイプライター演出は
 * 持たない）。ルビ対象は `<ruby>`＋`<rt>`、地の文はそのまま文字列にする。
 *
 * Args:
 *     text (string): `漢字《ふりがな》` 記法を含む説明文。
 *
 * Returns:
 *     Array<React.ReactNode>: ルビ付きの表示ノード列。
 */
function renderFurigana(text) {
  return tokenizeFurigana(text).map((token, index) =>
    token.type === 'ruby' ? (
      <ruby key={index}>
        {token.base}
        <rt>{token.ruby}</rt>
      </ruby>
    ) : (
      token.value
    ),
  );
}

/**
 * カードの効果を説明するヘルプウィンドウ（RPG 風意匠）。
 *
 * バトル画面左上の `HelpButton` から開かれるモーダル。背景を暗幕で覆い、
 * 中央に金枠＋赤バナーの RPG 調ウィンドウを表示する。タイトル画面の
 * スタートボタン（赤グラデ＋金枠 `#f0c040`＋立体影）や `DotGothic16`
 * フォントと意匠を揃え、ゲームの世界観に溶け込ませる。
 *
 * ウィンドウ上部に各カードのタブを 1 列で並べ、タブを押すとそのカードの
 * 絵・名前・効果説明に切り替わる（タブ式 UI）。選択中カードの
 * テーマ色（`CARD_ACCENTS`）を CSS 変数 `--accent` として `.window` に
 * 流し込み、カード枠・名前・アクティブタブの強調色を動的に切り替える。
 * 説明テキストは `card_help.json` から読み、`漢字《ふりがな》` 記法を
 * `renderFurigana` でルビ付きに描画する。
 *
 * カードの解放（ネタバレ防止）：`progressStore.seenCardIds` を購読し、まだ
 * 戦闘で出会っていないカードは説明を伏せる。未出カードのタブは
 * 「？？？カード」表記＋押せない（`disabled`）状態にし、内容側も絵・名前・
 * 効果を伏せ字（？）に差し替える。初期表示タブは「最初の既出カード」を
 * 選ぶ（全カード未出という稀なケースでは先頭カードを伏せ字のまま表示）。
 * 既出カードは初出の戦闘入場時に `BattleScreen` が `markCardsSeen` で記録
 * するため、ヘルプを開いた時点でそのステージの手札カードは必ず解放済み。
 *
 * 閉じ方は 2 通り：右上の × ボタン、または暗幕（ウィンドウ外）クリック。
 * 暗幕クリックはイベントが `.window` へ伝播しないよう、`.window` 側で
 * `stopPropagation` する。表示状態（開閉）自体は親（`BattleScreen`）が
 * 持ち、本コンポーネントは「開いている前提」で描画のみを担う。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onClose (function): ウィンドウを閉じるときに呼ぶハンドラ。引数なし。
 *         initialCardId (string, optional): 最初に開くカードの ID。
 *             カットシーンから「攻撃カードの説明を見せる」のように特定カードへ
 *             直接開きたいときに渡す。指定カードが既出のときだけそのタブを
 *             初期選択にし、未指定・未出・存在しない ID のときは従来どおり
 *             「最初の既出カード」（全部未出なら先頭）を選ぶ。
 *
 * Returns:
 *     JSX.Element: 暗幕＋ウィンドウ全体を表す要素。
 */
function CardHelpWindow({ onClose, initialCardId }) {
  const cards = cardHelpData.cards;
  const seenCardIds = useProgressStore((s) => s.seenCardIds);
  const isSeen = (id) => seenCardIds.includes(id);

  /*
   * 初期タブの決定。`initialCardId` が既出カードならそれを開く（カットシーン
   * からの「このカードの説明を見せる」誘導用）。なければ「最初の既出カード」、
   * 全部未出なら先頭（伏せ字表示）にフォールバックする。
   */
  const [activeId, setActiveId] = useState(() => {
    if (initialCardId && isSeen(initialCardId)) {
      return initialCardId;
    }
    return cards.find((card) => isSeen(card.id))?.id ?? cards[0].id;
  });
  const activeCard = cards.find((card) => card.id === activeId) ?? cards[0];
  const isActiveSeen = isSeen(activeCard.id);
  const accent = isActiveSeen ? CARD_ACCENTS[activeCard.id] ?? '#f0c040' : '#7a7280';

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.window}
        style={{ '--accent': accent }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="カードのせつめい"
      >
        <div className={styles.titleBar}>
          <span className={styles.titleText}>カードのせつめい</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="とじる"
          >
            ×
          </button>
        </div>
        <div className={styles.tabBar}>
          {cards.map((card) => {
            const seen = isSeen(card.id);
            return (
              <button
                key={card.id}
                type="button"
                className={[
                  styles.tab,
                  card.id === activeId ? styles.tabActive : '',
                  seen ? '' : styles.tabLocked,
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--accent': seen ? CARD_ACCENTS[card.id] ?? '#f0c040' : '#7a7280' }}
                disabled={!seen}
                onClick={() => seen && setActiveId(card.id)}
              >
                {seen ? renderFurigana(card.name) : LOCKED_LABEL}
              </button>
            );
          })}
        </div>
        <div className={styles.content}>
          {isActiveSeen ? (
            <>
              <div className={styles.cardFrame}>
                <Card card={{ id: activeCard.id, power: activeCard.power }} />
              </div>
              <div className={styles.cardText}>
                <h2 className={styles.cardName}>{renderFurigana(activeCard.name)}</h2>
                <p className={styles.cardDescription}>
                  {renderFurigana(activeCard.description)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className={`${styles.cardFrame} ${styles.cardFrameLocked}`}>
                <span className={styles.lockedMark}>？</span>
              </div>
              <div className={styles.cardText}>
                <h2 className={styles.cardName}>{LOCKED_LABEL}</h2>
                <p className={styles.cardDescription}>
                  {renderFurigana(
                    'このカードが はじめて でてきたら、せつめいが 見《み》られるよ。',
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CardHelpWindow;
