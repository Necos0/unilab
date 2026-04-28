/**
 * `mapDef` 内のグラフノード（ランドマーク or 分岐点）を ID で線形探索する。
 *
 * グラフ上のノードはクリック可能な「ランドマーク」と、道の分岐点を表す
 * クリック不可の「分岐点（junction）」の 2 種類があり、両者とも BFS の
 * 経路探索や移動セグメントの端点として等しく扱われる。本関数は両配列を
 * 順に探して該当 ID のノード定義を返す。
 *
 * Args:
 *     mapDef (object): `maps.json` の 1 マップ分。
 *         `landmarks` と（任意で）`junctions` を持つ。
 *     id (string): 探したいノードの ID。
 *
 * Returns:
 *     object | null: 見つかったノード定義（少なくとも `id` と `stopPoint`
 *         を持つ）、見つからなければ null。
 */
function findNodeById(mapDef, id) {
  const landmark = mapDef.landmarks.find((lm) => lm.id === id);
  if (landmark) {
    return landmark;
  }
  const junctions = mapDef.junctions ?? [];
  return junctions.find((j) => j.id === id) ?? null;
}

export default findNodeById;
