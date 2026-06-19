/**
 * 全体マップ（`map_0`）の領域プリセット定義（境界線＝十字モデル）。
 *
 * 全体マップを中心点と 4 本の境界線（`up` / `right` / `down` / `left`）で
 * 2×2 に分割する。各領域はそのうち隣り合う 2 本の境界線と地図の角から
 * 自動生成されるため、ここでは「どの 2 本に挟まれた角か」を `arms` に持つ。
 * `arms` の順序は領域ポリゴンを単純多角形として閉じるための巡回順
 * （1 本目を逆向き → 中心 → 2 本目を順向き、`buildRegionPolygons` 参照）。
 *
 * 各要素のフィールド:
 *   - `id` (string)     : 領域 ID。一意な識別子。
 *   - `label` (string)  : 編集 UI（開発用）に出す日本語名。漢字可。
 *   - `stageId` (string): 移動先マップのキー（`map_1`〜`map_4`）。領域クリックで
 *       そのマップへ移動する際のリンク先になる。巻物に出す「ステージ N」の
 *       番号もこのキー末尾の数字から導出する。
 *   - `color` (string)  : 輪郭・塗りのプレビュー色（編集時の視認用）。
 *   - `arms` (Array<string>): その領域を挟む 2 本の境界線名。巡回順に並べる。
 */
const REGION_PRESETS = [
  { id: 'grassland', label: '草原', stageId: 'map_1', color: '#5fd86b', arms: ['up', 'left'] },
  { id: 'desert', label: '砂漠', stageId: 'map_2', color: '#e8c45a', arms: ['up', 'right'] },
  { id: 'volcano', label: '火山', stageId: 'map_4', color: '#e8624f', arms: ['right', 'down'] },
  { id: 'coast', label: '海岸', stageId: 'map_3', color: '#4fc3e8', arms: ['down', 'left'] },
];

export default REGION_PRESETS;
