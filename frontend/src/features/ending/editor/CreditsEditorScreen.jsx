import { useCallback, useRef, useState } from 'react';
import styles from './CreditsEditorScreen.module.css';
import CreditsScreen from '../CreditsScreen.jsx';
import CREDITS_DATA from '../../../data/ending_credits.json';

/* 行と行の縦の間隔（px）。`CreditsScreen` の LINE_STEP_PX と合わせる。 */
const LINE_STEP_PX = 96;

/* 編集キャンバスの横幅（px）。ゲーム画面より広めに取って余白で作業できるようにする。 */
const WORLD_WIDTH_PX = 1600;

/* キャンバス下端の余白（px）。最後の行の下にもコインを置けるようにする。 */
const WORLD_BOTTOM_PAD_PX = 300;

/* くうはく行から他の種類へ変えたときの初期値。 */
const NEW_LINE_TEXT = 'あたらしい ぎょう';
const NEW_LINE_X = 176;

/* 行の種類の選択肢。ラベルは足場としての性質が分かる書き方にする。 */
const KIND_OPTIONS = [
  { value: 'tag', label: 'タグ（かたい足場・金）' },
  { value: 'text', label: 'テキスト（ふつうの足場・白）' },
  { value: 'comment', label: 'コメント（のれない・グレー）' },
  { value: 'blank', label: 'くうはく（なにも出ない）' },
];

/*
 * プレースホルダの見本値。エディタでは実際の進捗の代わりにこの値で
 * 表示し、行の幅（＝足場の幅）が本番に近い見た目になるようにする。
 */
const SAMPLE_REPLACEMENTS = {
  '{playerName}': 'きみ',
  '{clearedCount}': '16',
  '{stageTotal}': '16',
  '{cardCount}': '6',
};

/**
 * プレースホルダを見本値に置き換えた表示用テキストを返す。
 *
 * Args:
 *     text (string): `{playerName}` などを含む可能性のある行テキスト。
 *
 * Returns:
 *     string: 見本値で置換したテキスト。
 */
function toSampleText(text) {
  let result = text;
  for (const [placeholder, value] of Object.entries(SAMPLE_REPLACEMENTS)) {
    result = result.replaceAll(placeholder, value);
  }
  return result;
}

/**
 * エンディングロールの配置エディタ（開発用ツール）。
 *
 * 隠しコマンド `wqedit` で開く。`data/ending_credits.json` の内容を
 * 読み込み、クレジットの縦の並びを 1 枚のスクロールキャンバスに広げて
 * GUI で編集する：
 *   - 「うごかす」モード: 行をドラッグして横位置（`x`）を変える。行を
 *     クリックすると下部に編集パネルが開き、表示テキスト・行の種類
 *     （タグ / テキスト / コメント / くうはく）の変更、行の追加・削除が
 *     できる。コインはドラッグで自由に動かせ、ダブルクリックで削除する。
 *   - 「コインをおく」モード: キャンバスをクリックした場所にコインを置く。
 *   - 「コインをけす」モード: クリックしたコインを削除する（うごかす
 *     モードのダブルクリック削除も残している）。
 *   - 「テストプレイ」: 編集中の下書きをそのまま `CreditsScreen` で遊べる。
 *     JSON を書き出さなくても挙動を確かめられ、「← エディタへ」で編集に戻る
 *     （編集内容は保持される）。
 *
 * 行を追加・削除すると、それより下にあるコインの縦位置も 1 行ぶん
 * （96px）自動でずらし、置いたコインと行の関係が崩れないようにする。
 *
 * 編集結果はファイルへ直接保存できない（ブラウザのため）ので、
 * 「JSON をダウンロード」または「JSON をコピー」で書き出し、
 * `frontend/src/data/ending_credits.json` を丸ごと置き換えて反映する。
 *
 * プレースホルダ（`{playerName}` 等）はキャンバス上では見本値で表示するが、
 * 編集パネルの入力欄と書き出す JSON では元のまま保持する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onExit (function): 「もどる」で呼ぶ（引数なし）。
 *
 * Returns:
 *     JSX.Element: エディタ画面全体の要素。
 */
function CreditsEditorScreen({ onExit }) {
  const [lines, setLines] = useState(() =>
    CREDITS_DATA.lines.map((line) => ({ ...line })),
  );
  const [coins, setCoins] = useState(() =>
    CREDITS_DATA.coins.map((coin) => ({ ...coin })),
  );
  /*
   * 'move'（行・コインをドラッグ/選択） | 'coin'（クリックでコイン追加）
   * | 'erase'（クリックでコイン削除）
   */
  const [mode, setMode] = useState('move');
  /* 編集パネルを開いている行の index。null なら非表示。 */
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  const worldRef = useRef(null);
  /*
   * ドラッグ中の対象。`{type: 'line'|'coin', index, startClientX,
   * startClientY, originX, originY}` を保持し、pointermove で差分を足す。
   */
  const dragRef = useRef(null);

  const worldHeight = lines.length * LINE_STEP_PX + WORLD_BOTTOM_PAD_PX;
  const selectedLine = selectedIndex !== null ? lines[selectedIndex] : null;

  /** 現在の編集内容を、保存用の JSON 文字列に変換する。 */
  const buildJson = useCallback(() => {
    const data = {
      lines: lines.map((line) =>
        line.x !== undefined ? { ...line, x: Math.round(line.x) } : line,
      ),
      coins: coins.map((coin) => ({
        x: Math.round(coin.x),
        y: Math.round(coin.y),
      })),
    };
    return `${JSON.stringify(data, null, 2)}\n`;
  }, [lines, coins]);

  /** 編集内容を ending_credits.json としてダウンロードする。 */
  const handleDownload = useCallback(() => {
    const blob = new Blob([buildJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ending_credits.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [buildJson]);

  /** 編集内容の JSON をクリップボードへコピーする。 */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildJson());
      setCopyFeedback('コピーしました!');
    } catch {
      setCopyFeedback('コピーできませんでした');
    }
    setTimeout(() => setCopyFeedback(''), 1500);
  }, [buildJson]);

  /** 行・コインのドラッグを開始する（うごかすモードのみ）。行は選択も兼ねる。 */
  const startDrag = useCallback(
    (event, type, index) => {
      if (mode !== 'move') {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      if (type === 'line') {
        setSelectedIndex(index);
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      const target = type === 'line' ? lines[index] : coins[index];
      dragRef.current = {
        type,
        index,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: target.x ?? 0,
        originY: type === 'coin' ? target.y : 0,
      };
    },
    [mode, lines, coins],
  );

  /** ドラッグ中の移動。行は横のみ、コインは縦横自由に動かす。 */
  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (drag.type === 'line') {
      const newX = Math.max(0, drag.originX + dx);
      setLines((prev) =>
        prev.map((line, i) => (i === drag.index ? { ...line, x: newX } : line)),
      );
    } else {
      const newX = Math.max(0, Math.min(WORLD_WIDTH_PX, drag.originX + dx));
      const newY = Math.max(0, drag.originY + dy);
      setCoins((prev) =>
        prev.map((coin, i) =>
          i === drag.index ? { ...coin, x: newX, y: newY } : coin,
        ),
      );
    }
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  /** コイン追加（コインをおくモードでキャンバスをクリック）。 */
  const handleWorldClick = useCallback(
    (event) => {
      if (mode !== 'coin' || !worldRef.current) {
        return;
      }
      const rect = worldRef.current.getBoundingClientRect();
      setCoins((prev) => [
        ...prev,
        {
          x: Math.round(event.clientX - rect.left),
          y: Math.round(event.clientY - rect.top),
        },
      ]);
    },
    [mode],
  );

  /** コイン削除（ダブルクリック）。 */
  const handleCoinDoubleClick = useCallback((event, index) => {
    event.stopPropagation();
    setCoins((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * コインのクリック。けすモードなら削除する。コインをおくモードでは
   * 何もしないが、クリックがキャンバスへ伝わって同じ場所に新しいコインが
   * 重なって置かれてしまうのを止める。
   */
  const handleCoinClick = useCallback(
    (event, index) => {
      event.stopPropagation();
      if (mode === 'erase') {
        setCoins((prev) => prev.filter((_, i) => i !== index));
      }
    },
    [mode],
  );

  /** 選択中の行のテキストを書き換える（プレースホルダはそのまま入力できる）。 */
  const handleTextChange = useCallback(
    (event) => {
      const { value } = event.target;
      setLines((prev) =>
        prev.map((line, i) =>
          i === selectedIndex ? { ...line, text: value } : line,
        ),
      );
    },
    [selectedIndex],
  );

  /**
   * 選択中の行の種類を変える。くうはくから他の種類へ変えたときは、
   * 表示に必要な `x` / `text` を初期値で補う。
   */
  const handleKindChange = useCallback(
    (event) => {
      const kind = event.target.value;
      setLines((prev) =>
        prev.map((line, i) => {
          if (i !== selectedIndex) {
            return line;
          }
          if (kind === 'blank') {
            return { ...line, kind };
          }
          return {
            ...line,
            kind,
            x: line.x ?? NEW_LINE_X,
            text: line.text ?? NEW_LINE_TEXT,
          };
        }),
      );
    },
    [selectedIndex],
  );

  /**
   * 行を挿入する（くうはく行として追加し、種類はあとから変える）。
   * 挿入位置より下のコインは 1 行ぶん下へずらす。
   *
   * Args:
   *     index (number): 挿入先の行 index（この位置の上に入る）。
   */
  const insertLineAt = useCallback((index) => {
    const boundaryY = index * LINE_STEP_PX;
    setLines((prev) => [
      ...prev.slice(0, index),
      { kind: 'blank' },
      ...prev.slice(index),
    ]);
    setCoins((prev) =>
      prev.map((coin) =>
        coin.y >= boundaryY ? { ...coin, y: coin.y + LINE_STEP_PX } : coin,
      ),
    );
    setSelectedIndex(index);
  }, []);

  /** 選択中の行を削除し、下のコインを 1 行ぶん上へずらす。 */
  const handleDeleteLine = useCallback(() => {
    if (selectedIndex === null || lines.length <= 1) {
      return;
    }
    const boundaryY = selectedIndex * LINE_STEP_PX;
    setLines((prev) => prev.filter((_, i) => i !== selectedIndex));
    setCoins((prev) =>
      prev.map((coin) =>
        coin.y > boundaryY ? { ...coin, y: coin.y - LINE_STEP_PX } : coin,
      ),
    );
    setSelectedIndex(null);
  }, [selectedIndex, lines.length]);

  const lineClassByKind = {
    tag: styles.tagLine,
    text: styles.textLine,
    comment: styles.commentLine,
  };

  /* テストプレイ中はエディタ UI の代わりにゲーム本体を出す（状態は保持）。 */
  if (isTesting) {
    return (
      <CreditsScreen
        testLines={lines}
        testCoins={coins}
        onExitTest={() => setIsTesting(false)}
      />
    );
  }

  return (
    <section className={styles.root}>
      <header className={styles.toolbar}>
        <span className={styles.title}>エンディング配置エディタ</span>
        <div className={styles.modeGroup}>
          <button
            type="button"
            className={mode === 'move' ? styles.modeActive : styles.modeButton}
            onClick={() => setMode('move')}
          >
            うごかす
          </button>
          <button
            type="button"
            className={mode === 'coin' ? styles.modeActive : styles.modeButton}
            onClick={() => setMode('coin')}
          >
            コインをおく
          </button>
          <button
            type="button"
            className={mode === 'erase' ? styles.modeActive : styles.modeButton}
            onClick={() => setMode('erase')}
          >
            コインをけす
          </button>
          <button
            type="button"
            className={styles.testButton}
            onClick={() => setIsTesting(true)}
          >
            ▶ テストプレイ
          </button>
        </div>
        <span className={styles.hint}>
          {mode === 'move' &&
            '行: クリックで編集・横ドラッグで移動 / コイン: ドラッグで移動'}
          {mode === 'coin' && 'クリックした場所にコインを置く'}
          {mode === 'erase' && 'クリックしたコインを消す'}
          （コイン {coins.length} 個）
        </span>
        <div className={styles.actions}>
          <button type="button" className={styles.actionButton} onClick={handleDownload}>
            JSON をダウンロード
          </button>
          <button type="button" className={styles.actionButton} onClick={handleCopy}>
            {copyFeedback || 'JSON をコピー'}
          </button>
          <button type="button" className={styles.exitButton} onClick={onExit}>
            もどる
          </button>
        </div>
      </header>
      <p className={styles.note}>
        保存先: ダウンロード/コピーした JSON で{' '}
        <code>frontend/src/data/ending_credits.json</code>{' '}
        を丸ごと置き換える。通し確認は隠しコマンド <code>wqend</code>。
      </p>

      <div className={styles.canvas}>
        <div
          className={styles.world}
          ref={worldRef}
          style={{ height: worldHeight, width: WORLD_WIDTH_PX }}
          onClick={handleWorldClick}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {lines.map((line, index) =>
            line.kind === 'blank' ? (
              <div
                key={index}
                className={[
                  styles.blankLine,
                  index === selectedIndex && styles.selected,
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ top: index * LINE_STEP_PX }}
                onPointerDown={(event) => {
                  if (mode === 'move') {
                    event.stopPropagation();
                    setSelectedIndex(index);
                  }
                }}
              >
                （くうはく）
              </div>
            ) : (
              <div
                key={index}
                className={[
                  lineClassByKind[line.kind],
                  index === selectedIndex && styles.selected,
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ top: index * LINE_STEP_PX, left: line.x }}
                onPointerDown={(event) => startDrag(event, 'line', index)}
              >
                {line.sprite && (
                  <img
                    className={styles.castSprite}
                    src={line.sprite}
                    alt=""
                    draggable={false}
                  />
                )}
                {toSampleText(line.text)}
              </div>
            ),
          )}
          {coins.map((coin, index) => (
            <div
              key={index}
              className={
                mode === 'erase'
                  ? `${styles.coin} ${styles.coinErasable}`
                  : styles.coin
              }
              style={{ left: coin.x, top: coin.y }}
              onPointerDown={(event) => startDrag(event, 'coin', index)}
              onClick={(event) => handleCoinClick(event, index)}
              onDoubleClick={(event) => handleCoinDoubleClick(event, index)}
            >
              {'{}'}
            </div>
          ))}
        </div>
      </div>

      {selectedLine && (
        <footer className={styles.editPanel}>
          <span className={styles.editLabel}>行 {selectedIndex + 1}</span>
          <select
            className={styles.kindSelect}
            value={selectedLine.kind}
            onChange={handleKindChange}
          >
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            className={styles.textInput}
            value={selectedLine.kind === 'blank' ? '' : (selectedLine.text ?? '')}
            onChange={handleTextChange}
            disabled={selectedLine.kind === 'blank'}
            placeholder={
              selectedLine.kind === 'blank'
                ? 'くうはく行（種類を変えると文字を入れられる）'
                : '表示する文字（{playerName} などはそのまま残す）'
            }
          />
          <button
            type="button"
            className={styles.panelButton}
            onClick={() => insertLineAt(selectedIndex)}
          >
            ↑ 上に行を追加
          </button>
          <button
            type="button"
            className={styles.panelButton}
            onClick={() => insertLineAt(selectedIndex + 1)}
          >
            ↓ 下に行を追加
          </button>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={handleDeleteLine}
          >
            行を削除
          </button>
          <button
            type="button"
            className={styles.panelButton}
            onClick={() => setSelectedIndex(null)}
          >
            閉じる
          </button>
        </footer>
      )}
    </section>
  );
}

export default CreditsEditorScreen;
