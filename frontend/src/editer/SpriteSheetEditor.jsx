import { useRef, useState } from 'react';
import styles from './SpriteSheetEditor.module.css';
import ImageStage from './ImageStage';
import FrameList from './FrameList';
import PreviewPlayer from './PreviewPlayer';
import SavePanel from './SavePanel';

const DEFAULT_FRAME_SIZE = 64;
const MIN_FRAME_SIZE = 1;

/**
 * スプライトシート分割エディタ画面のルートコンポーネント。
 *
 * AI が生成した「コマ間隔がバラバラで一般的なエディタでは分割できない」
 * スプライトシートを、枠を手で合わせて 1 コマずつ切り出すための開発用ツール。
 * 状態（アップロード画像・切り取り枠サイズ・切り取り済みコマ列・プレビュー
 * FPS）をここで集約し、子コンポーネントへ配る：
 *   - ImageStage: 画像の拡大縮小・移動表示と切り取り枠、切り取り実行。
 *   - FrameList: 切り取ったコマの一覧とドラッグ並べ替え・削除。
 *   - PreviewPlayer: コマ列の FPS 指定アニメ再生。
 *   - SavePanel: キャラ名・状態を選び命名規則どおりに ZIP 保存。
 * 切り取り枠サイズ（縦・横）は元画像ピクセル単位で、ヘッダーの数値入力か
 * ImageStage の枠ハンドルのドラッグで指定でき、どちらの操作も同じ state を
 * 更新するため常に同期する。コマには一意 ID を採番し、並べ替え・
 * 削除・再生で取り違えないようにする。本ツールは開発者向けのため、ゲーム内
 * テキストのふりがな規則は適用しない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onExit (function): 「マップへ戻る」押下時に呼ぶ関数。引数なし。
 *
 * Returns:
 *     JSX.Element: エディタ画面全体を表す要素。
 */
function SpriteSheetEditor({ onExit }) {
  const [image, setImage] = useState(null);
  const [frameWidth, setFrameWidth] = useState(DEFAULT_FRAME_SIZE);
  const [frameHeight, setFrameHeight] = useState(DEFAULT_FRAME_SIZE);
  const [frames, setFrames] = useState([]);
  const [fps, setFps] = useState(8);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const nextId = useRef(0);

  const loadImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => setImage(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = (event) => {
    loadImageFile(event.target.files?.[0]);
    // 同じファイルを連続で選び直せるよう値をリセットする。
    event.target.value = '';
  };

  const handleCrop = (dataUrl, width, height) => {
    setFrames((prev) => [
      ...prev,
      { id: nextId.current++, dataUrl, width, height },
    ]);
  };

  const handleReorder = (fromIndex, toIndex) => {
    setFrames((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleRemove = (id) => {
    setFrames((prev) => prev.filter((frame) => frame.id !== id));
  };

  /*
   * 一覧のコマをクリックしてプレビューに表示する。再生中は自動送りと競合する
   * ため何もせず、一時停止中だけそのコマへジャンプする。
   */
  const handleSelectFrame = (index) => {
    if (!isPlaying) {
      setPreviewIndex(index);
    }
  };

  const handleFrameSizeChange = (setter) => (event) => {
    const value = Number(event.target.value);
    setter(Number.isFinite(value) ? Math.max(MIN_FRAME_SIZE, Math.round(value)) : MIN_FRAME_SIZE);
  };

  /*
   * ImageStage のリサイズハンドル操作からの枠サイズ更新。ヘッダーの数値入力と
   * 同じ state を更新するため、GUI 操作と入力欄が常に同期する。
   */
  const handleFrameSizeFromStage = (width, height) => {
    setFrameWidth(Math.max(MIN_FRAME_SIZE, Math.round(width)));
    setFrameHeight(Math.max(MIN_FRAME_SIZE, Math.round(height)));
  };

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.heading}>スプライトシートエディタ</h1>
        <div className={styles.tools}>
          <label className={styles.uploadButton}>
            画像をアップロード
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className={styles.fileInput}
            />
          </label>
          <label className={styles.sizeField}>
            横
            <input
              type="number"
              min={MIN_FRAME_SIZE}
              value={frameWidth}
              onChange={handleFrameSizeChange(setFrameWidth)}
              className={styles.sizeInput}
            />
            px
          </label>
          <label className={styles.sizeField}>
            縦
            <input
              type="number"
              min={MIN_FRAME_SIZE}
              value={frameHeight}
              onChange={handleFrameSizeChange(setFrameHeight)}
              className={styles.sizeInput}
            />
            px
          </label>
        </div>
        <button type="button" className={styles.backButton} onClick={onExit}>
          マップへ戻る
        </button>
      </header>

      <div className={styles.body}>
        <div className={styles.left}>
          <div className={styles.stageArea}>
            <ImageStage
              image={image}
              frameWidth={frameWidth}
              frameHeight={frameHeight}
              onCrop={handleCrop}
              onDropFile={loadImageFile}
              onFrameSizeChange={handleFrameSizeFromStage}
            />
          </div>
          <div className={styles.listArea}>
            <FrameList
              frames={frames}
              onReorder={handleReorder}
              onRemove={handleRemove}
              onSelect={handleSelectFrame}
              selectedIndex={previewIndex}
              isSelectable={!isPlaying}
            />
          </div>
        </div>

        <aside className={styles.right}>
          <PreviewPlayer
            frames={frames}
            fps={fps}
            onFpsChange={setFps}
            index={previewIndex}
            onIndexChange={setPreviewIndex}
            isPlaying={isPlaying}
            onPlayingChange={setIsPlaying}
          />
          <SavePanel frames={frames} />
        </aside>
      </div>
    </section>
  );
}

export default SpriteSheetEditor;
