import { useState } from 'react';
import styles from './HelpWindow.module.css';
import cardHelpData from '../../data/card_help.json';
import slotHelpData from '../../data/slot_help.json';
import tokenizeFurigana from '../cutscene/tokenizeFurigana';
import Card from '../cards/Card';
import SlotHelpVisual from './SlotHelpVisual';
import useProgressStore from '../../stores/progressStore';

/**
 * 未出（まだ出会っていない）カード・マスのタブ・名前に使う伏せ字ラベル。
 */
const LOCKED_LABELS = {
  cards: '？？？カード',
  slots: '？？？マス',
};

/**
 * 未出のカード・マスの説明欄に出す共通の案内文。
 */
const LOCKED_DESCRIPTIONS = {
  cards: 'このカードが はじめて でてきたら、せつめいが 見《み》られるよ。',
  slots: 'このマスが はじめて でてきたら、せつめいが 見《み》られるよ。',
};

/**
 * カードごとのテーマ色（アクセント色）。
 *
 * 攻撃=赤・防御=青・回復=緑・反射=橙と、戦闘画面のフロート演出（ダメージ赤／
 * ガード青／回復緑／反射橙）と同じ色割りに揃えることで、ヘルプ画面と実戦の
 * 演出が同じ「意味の色」で結びつくようにする。敵攻撃（monster）だけは
 * フロート演出との対応ではなく、カード画像（`monster.png`）の紫の枠色に
 * 合わせて「敵のカード」であることを示す。各カードの枠・名前・タブの
 * 強調色として CSS 変数（`--accent`）経由で使う。
 */
const CARD_ACCENTS = {
  attack: '#e0563b',
  guard: '#4a8ef0',
  heal: '#3ad430',
  reflect: '#f0a040',
  monster: '#a86ae0',
};

/**
 * マス種別ごとのテーマ色（アクセント色）。
 *
 * 実戦の見た目に寄せられるものは寄せる：パワーアップ（counter）はペアスロット
 * の金色アウトライン（`SlotNode` の `.counterPaired` #ffd54a）、条件分岐は実行
 * ハイライトの白（#e5e5ff）。倍率・種類指定・カウント（ループ）は戦闘画面に
 * 固有色が無いため、カテゴリ内で識別しやすい互いに離れた色を割り当てる。
 */
const SLOT_ACCENTS = {
  condition: '#e5e5ff',
  loop: '#4ad0c8',
  multiplier: '#c792ea',
  acceptOnly: '#ff6a6a',
  counter: '#ffd54a',
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
 * カードとマス（スロット）の効果を説明するヘルプウィンドウ（RPG 風意匠）。
 *
 * バトル画面左上の `HelpButton` から開かれるモーダル。背景を暗幕で覆い、
 * 中央に金枠＋赤バナーの RPG 調ウィンドウを表示する。タイトル画面の
 * スタートボタン（赤グラデ＋金枠 `#f0c040`＋立体影）や `DotGothic16`
 * フォントと意匠を揃え、ゲームの世界観に溶け込ませる。
 *
 * 左のサイドバーで「カード」「マス」のカテゴリを切り替え、ウィンドウ上部に
 * そのカテゴリの項目タブを 1 列で並べる。タブを押すとその項目の
 * 絵（カードはカード画像、マスは `SlotHelpVisual` のミニ図解）・名前・
 * 効果説明に切り替わる。選択中項目のテーマ色（`CARD_ACCENTS` /
 * `SLOT_ACCENTS`）を CSS 変数 `--accent` として `.window` に流し込み、
 * 額縁・名前・アクティブタブの強調色を動的に切り替える。説明テキストは
 * `card_help.json` / `slot_help.json` から読み、`漢字《ふりがな》` 記法を
 * `renderFurigana` でルビ付きに描画する。
 *
 * 解放（ネタバレ防止）：`progressStore.seenCardIds` / `seenSlotTypeIds` を
 * 購読し、まだ戦闘で出会っていないカード・マスは説明を伏せる。未出項目の
 * タブは「？？？カード」「？？？マス」表記＋押せない（`disabled`）状態にし、
 * 内容側も絵・名前・効果を伏せ字（？）に差し替える。各カテゴリの初期表示
 * タブは「最初の既出項目」を選ぶ（全項目未出という稀なケースでは先頭項目を
 * 伏せ字のまま表示）。既出の記録はバトル入場時に `BattleScreen` が
 * `markCardsSeen` / `markSlotTypesSeen` で行うため、ヘルプを開いた時点で
 * そのステージのカード・マスは必ず解放済み。
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
 *             「最初の既出カード」（全部未出なら先頭）を選ぶ。カテゴリは
 *             常に「カード」から始まる。
 *
 * Returns:
 *     JSX.Element: 暗幕＋ウィンドウ全体を表す要素。
 */
function HelpWindow({ onClose, initialCardId }) {
  const cards = cardHelpData.cards;
  const slotTypes = slotHelpData.slots;
  const seenCardIds = useProgressStore((s) => s.seenCardIds);
  const seenSlotTypeIds = useProgressStore((s) => s.seenSlotTypeIds);

  /* 'cards'（カードのせつめい）か 'slots'（マスのせつめい）か。 */
  const [category, setCategory] = useState('cards');

  /*
   * カテゴリごとの選択中タブ。初期値は「最初の既出項目」（カードは
   * `initialCardId` が既出ならそれを優先。カットシーンからの「このカードの
   * 説明を見せる」誘導用）。全部未出なら先頭（伏せ字表示）にフォールバック。
   */
  const [activeCardId, setActiveCardId] = useState(() => {
    if (initialCardId && seenCardIds.includes(initialCardId)) {
      return initialCardId;
    }
    return cards.find((card) => seenCardIds.includes(card.id))?.id ?? cards[0].id;
  });
  const [activeSlotTypeId, setActiveSlotTypeId] = useState(
    () =>
      slotTypes.find((slot) => seenSlotTypeIds.includes(slot.id))?.id ??
      slotTypes[0].id,
  );

  const isCards = category === 'cards';
  const items = isCards ? cards : slotTypes;
  const seenIds = isCards ? seenCardIds : seenSlotTypeIds;
  const accents = isCards ? CARD_ACCENTS : SLOT_ACCENTS;
  const activeId = isCards ? activeCardId : activeSlotTypeId;
  const setActiveId = isCards ? setActiveCardId : setActiveSlotTypeId;
  const lockedLabel = LOCKED_LABELS[category];

  const activeItem = items.find((item) => item.id === activeId) ?? items[0];
  const isActiveSeen = seenIds.includes(activeItem.id);
  const accent = isActiveSeen ? accents[activeItem.id] ?? '#f0c040' : '#7a7280';

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.window}
        style={{ '--accent': accent }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="カードとマスのせつめい"
      >
        <div className={styles.titleBar}>
          <span className={styles.titleText}>
            {isCards ? 'カードのせつめい' : 'マスのせつめい'}
          </span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="とじる"
          >
            ×
          </button>
        </div>
        <div className={styles.body}>
          <nav className={styles.sidebar} aria-label="せつめいのカテゴリ">
            <button
              type="button"
              className={[styles.sideButton, isCards && styles.sideActive]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setCategory('cards')}
            >
              カード
            </button>
            <button
              type="button"
              className={[styles.sideButton, !isCards && styles.sideActive]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setCategory('slots')}
            >
              マス
            </button>
          </nav>
          <div className={styles.main}>
            <div className={styles.tabBar}>
              {items.map((item) => {
                const seen = seenIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={[
                      styles.tab,
                      item.id === activeId ? styles.tabActive : '',
                      seen ? '' : styles.tabLocked,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      '--accent': seen ? accents[item.id] ?? '#f0c040' : '#7a7280',
                    }}
                    disabled={!seen}
                    onClick={() => seen && setActiveId(item.id)}
                  >
                    {seen ? renderFurigana(item.name) : lockedLabel}
                  </button>
                );
              })}
            </div>
            <div className={styles.content}>
              {isActiveSeen ? (
                <>
                  <div className={styles.cardFrame}>
                    {isCards ? (
                      <Card
                        card={{ id: activeItem.id, power: activeItem.power }}
                      />
                    ) : (
                      <SlotHelpVisual typeId={activeItem.id} />
                    )}
                  </div>
                  <div className={styles.cardText}>
                    <h2 className={styles.cardName}>
                      {renderFurigana(activeItem.name)}
                    </h2>
                    <p className={styles.cardDescription}>
                      {renderFurigana(activeItem.description)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className={`${styles.cardFrame} ${styles.cardFrameLocked}`}>
                    <span className={styles.lockedMark}>？</span>
                  </div>
                  <div className={styles.cardText}>
                    <h2 className={styles.cardName}>{lockedLabel}</h2>
                    <p className={styles.cardDescription}>
                      {renderFurigana(LOCKED_DESCRIPTIONS[category])}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpWindow;
