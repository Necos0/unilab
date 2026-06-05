import styles from './MapEditorToggleButton.module.css';
import useMapEditorStore from '../../stores/mapEditorStore';

/**
 * マップ座標エディタの開始／終了を切り替えるボタン（開発用）。
 *
 * マップ左下（大画面ボタンの上）にテキストボタンとして重ねる。
 * 押すと現在表示中のマップを
 * 対象に編集モードへ入り（`startEditing`）、編集中に押すと抜ける
 * （`stopEditing`）。編集対象は表示中マップそのものなので、呼び出し側
 * （`MapScreen`）から現在の `mapId` と `mapDef` を受け取る。
 *
 * Args:
 *     props (object): React プロパティ。
 *         mapId (string): 現在表示中マップのキー。
 *         mapDef (object): 現在表示中マップの定義（`maps.json` の 1 マップ分）。
 *
 * Returns:
 *     JSX.Element: トグルボタン要素。
 */
function MapEditorToggleButton({ mapId, mapDef }) {
  const isEditing = useMapEditorStore((s) => s.isEditing);
  const startEditing = useMapEditorStore((s) => s.startEditing);
  const stopEditing = useMapEditorStore((s) => s.stopEditing);

  const handleClick = () => {
    if (isEditing) {
      stopEditing();
    } else {
      startEditing(mapId, mapDef);
    }
  };

  return (
    <button
      type="button"
      className={styles.button}
      data-active={isEditing ? 'true' : 'false'}
      onClick={handleClick}
      title="マップ座標エディタ"
    >
      {isEditing ? '座標エディタを終了' : '座標エディタ'}
    </button>
  );
}

export default MapEditorToggleButton;
