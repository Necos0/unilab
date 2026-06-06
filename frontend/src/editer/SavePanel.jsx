import { useState } from 'react';
import styles from './SavePanel.module.css';
import buildSpriteFileName from './buildSpriteFileName';
import buildAnimationMeta from './buildAnimationMeta';
import sanitizeId from './sanitizeId';
import dataUrlToBytes from './dataUrlToBytes';
import createZip from './createZip';
import downloadBlob from './downloadBlob';

const STATES = ['idle', 'dead'];

/**
 * キャラクター名と状態を選び、命名規則に沿って一括保存するパネル。
 *
 * 名前は `sanitizeId` で snake_case の ID に正規化し、状態は idle / dead から
 * 選ぶ。保存を押すと、`<ID>` という 1 つのフォルダの中に状態名のフォルダ
 * （`idle` / `dead`）を作り、その状態フォルダへ各コマ（命名規則
 * `<ID>_<状態>_<2桁連番>.png`）と enemies.json 用アニメ設定
 * （frameCount・frameDurationMs・loop）の JSON を一緒に収め、外部ライブラリ
 * なしの ZIP として 1 ファイルでダウンロードさせる（`frameDurationMs` は
 * プレビューの FPS から算出）。後で別状態を保存すれば同じ `<ID>` フォルダ
 * 直下に状態フォルダが並ぶ構成になる。名前未入力またはコマ 0 枚のときは
 * 保存できない。
 *
 * 例（idle を保存した場合）::
 *
 *     <ID>/
 *       idle/
 *         <ID>_idle_00.png
 *         <ID>_idle_01.png
 *         <ID>_idle.meta.json
 *
 * Args:
 *     props (object): React プロパティ。
 *         frames (Array<{id: number, dataUrl: string}>): 保存するコマ一覧。
 *         fps (number): メタ情報の frameDurationMs を算出する FPS。
 *
 * Returns:
 *     JSX.Element: 保存パネルを表す要素。
 */
function SavePanel({ frames, fps }) {
  const [name, setName] = useState('');
  const [state, setState] = useState('idle');

  const cleanId = sanitizeId(name);
  const canSave = cleanId.length > 0 && frames.length > 0;

  const handleSave = () => {
    if (!canSave) {
      return;
    }
    const files = frames.map((frame, index) => ({
      name: `${cleanId}/${state}/${buildSpriteFileName(cleanId, state, index)}`,
      data: dataUrlToBytes(frame.dataUrl),
    }));

    const meta = buildAnimationMeta(frames.length, fps, state);
    const metaText = JSON.stringify(
      { id: cleanId, animations: { [state]: meta } },
      null,
      2,
    );
    files.push({
      name: `${cleanId}/${state}/${cleanId}_${state}.meta.json`,
      data: new TextEncoder().encode(metaText),
    });

    const zip = createZip(files);
    downloadBlob(zip, `${cleanId}_${state}.zip`);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.title}>保存</div>

      <label className={styles.field}>
        キャラクター名
        <input
          type="text"
          className={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="例: slime"
        />
      </label>

      <div className={styles.field}>
        状態
        <div className={styles.states}>
          {STATES.map((option) => (
            <label key={option} className={styles.stateOption}>
              <input
                type="radio"
                name="sprite-state"
                value={option}
                checked={state === option}
                onChange={() => setState(option)}
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.preview}>
        保存名:{' '}
        <code>
          {cleanId
            ? `${cleanId}/${state}/${buildSpriteFileName(cleanId, state, 0)} …（${frames.length}枚）`
            : '（名前を入力してください）'}
        </code>
      </div>

      <button
        type="button"
        className={styles.saveButton}
        onClick={handleSave}
        disabled={!canSave}
      >
        ZIP でダウンロード
      </button>
    </div>
  );
}

export default SavePanel;
