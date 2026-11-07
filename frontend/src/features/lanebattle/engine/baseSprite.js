/**
 * 本陣に立つキャラ（主人公／真のドラゴン）1 体の DOM を生成する（要件 7）．
 *
 * 盤面の端（味方＝左端／敵＝右端）に寄せて idle アニメのスプライトを立たせる
 * 軽量ハンドル．ユニットと違い移動も撃破もしないので，位置は生成時に決め，以降は
 * `step(dt)` で待機コマだけ送る（描画層の実フレーム dt で，ユニットと同じクロック）．
 * 大きさは `heightPx`（img の高さ）で決める．端アンカーなので，高さを増やしても
 * 盤面外へはみ出さない（中心基準でずらすと端で見切れるため採らない）．向きは
 * `flipX`（true で左右反転）だけ transform で行う．フレーム URL の作り方（hero と
 * enemy で命名規則が違う）は呼び出し側が `framePath(frameIndex)` として渡す
 * （この関数はどちらの規則かを知らない）．
 *
 * Args:
 *     fieldEl (HTMLElement): `.lbf-field`．ここにキャラ要素を差し込む．
 *     opt (object):
 *         insetPct (number): 盤面端からの内側%（味方は左端／敵は右端から）．
 *         framePath (function): `(frameIndex) => url`．idle コマの URL を返す．
 *         frames (number): idle のコマ数．
 *         frameMs (number): 1 コマの表示時間（ミリ秒）．
 *         flipX (boolean): true で左右反転（スプライト既定の向きと逆に向ける）．
 *         heightPx (number): 表示高さ（px）．大きさはこれで決める．
 *         side (string): 'you' / 'cpu'（クラス付け・左右どちらの端に寄せるか）．
 *
 * Returns:
 *     object:
 *         node (HTMLElement): 生成したキャラ要素．
 *         step (function): `step(dt)` で idle を進める．
 *         remove (function): DOM から取り除く．
 */
export function createBaseSprite(fieldEl, { framePath, frames, frameMs, flipX, heightPx, insetPct, side }) {
  // コマを先読みしてフレーム切替のチラつきを防ぐ（laneSprite と同じ方針）．
  for (let i = 0; i < frames; i += 1) {
    const pre = new Image();
    pre.src = framePath(i);
  }

  const node = document.createElement('div');
  node.className = `lbf-basechar ${side}`;
  // 盤面の端にアンカーして外側へ寄せる（味方＝左端，敵＝右端）．端基準なので
  // 高さを増やしても盤面外へはみ出さない．
  node.style[side === 'you' ? 'left' : 'right'] = `${insetPct}%`;

  const img = document.createElement('img');
  img.draggable = false;
  img.alt = '';
  img.src = framePath(0);
  // 大きさは高さで決める（レイアウト箱＝実寸にして端アンカーを正確にするため）．
  img.style.height = `${heightPx}px`;
  // 向きは反転のみ（flipX でスプライト既定の向きを反転する）．
  img.style.transform = flipX ? 'scaleX(-1)' : 'none';
  node.appendChild(img);

  fieldEl.appendChild(node);

  let animT = 0;
  let frame = 0;

  return {
    node,
    step: (dt) => {
      animT += dt;
      if (animT < frameMs) return;
      animT = 0;
      frame = (frame + 1) % frames;
      img.src = framePath(frame);
    },
    remove: () => {
      node.remove();
    },
  };
}
