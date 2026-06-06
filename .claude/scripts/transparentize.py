#!/usr/bin/env python3
"""白い背景＋囲まれたすき間を透過する一括処理スクリプト。

判定ロジック:
  各ピクセルの「鮮やかさ(chroma = max-min)」と「明るさ(brightness = min)」を使う。
  - 無彩色(chroma < --chroma) かつ 明るい(brightness > しきい値) = 白〜明るいグレーの
    背景／すき間／にじみ → 透過する。
  - 黄みがかったクリーム色など色のある部分(chroma が大きい)は残す。
  - 黒い輪郭(暗い部分)も残す。

モード:
  crisp(既定): 半透明を作らず、透明(0) か 不透明(元のalpha) の二択。ドット絵向け。
  soft       : ふちのにじみを明るさに応じて段階的に半透明化する。
"""
import argparse, glob, os, sys

try:
    from PIL import Image
    import numpy as np
except ImportError:
    sys.exit("Pillow と numpy が必要です: pip install pillow numpy")


def collect_inputs(patterns):
    files = []
    for p in patterns:
        if os.path.isdir(p):
            for ext in ("png", "PNG", "webp", "WEBP", "bmp", "BMP", "gif", "GIF",
                        "jpg", "JPG", "jpeg", "JPEG"):
                files += glob.glob(os.path.join(p, f"*.{ext}"))
        else:
            files += glob.glob(p)
    # 重複除去・順序維持
    seen, out = set(), []
    for f in files:
        if f not in seen:
            seen.add(f); out.append(f)
    return out


def process(path, out_dir, suffix, mode, chroma_th, bright_th):
    img = Image.open(path).convert("RGBA")
    arr = np.array(img).astype(int)
    rgb = arr[:, :, :3]
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    chroma = mx - mn
    brightness = mn
    orig_alpha = arr[:, :, 3]

    if mode == "crisp":
        bg = (chroma < chroma_th) & (brightness > bright_th)
        new_alpha = np.where(bg, 0, orig_alpha)
    else:  # soft
        bg = (chroma < chroma_th) & (brightness > bright_th)
        feather = np.clip((250 - brightness) / 50.0, 0, 1)
        new_alpha = np.where(bg, (feather * 255).astype(int), orig_alpha)

    arr[:, :, 3] = new_alpha
    out_img = Image.fromarray(arr.astype("uint8"), "RGBA")

    base = os.path.splitext(os.path.basename(path))[0]
    target_dir = out_dir if out_dir else os.path.dirname(path) or "."
    os.makedirs(target_dir, exist_ok=True)
    out_path = os.path.join(target_dir, f"{base}{suffix}.png")
    out_img.save(out_path)
    removed = int((new_alpha == 0).sum())
    return out_path, removed, arr.shape[1] * arr.shape[0]


def main():
    ap = argparse.ArgumentParser(description="白い背景・すき間を一括透過する")
    ap.add_argument("inputs", nargs="+",
                    help="画像ファイル/グロブ/ディレクトリ(複数可)")
    ap.add_argument("-o", "--out", default="",
                    help="出力先ディレクトリ(省略時は元画像と同じ場所)")
    ap.add_argument("--suffix", default="",
                    help="出力ファイル名に付ける接尾辞(既定: 空=元画像を上書き)")
    ap.add_argument("--mode", choices=["crisp", "soft"], default="crisp",
                    help="crisp=ハードエッジ(既定) / soft=にじみを残す")
    ap.add_argument("--chroma", type=int, default=40,
                    help="この値未満の鮮やかさを無彩色(背景候補)とみなす(既定40)")
    ap.add_argument("--bright", type=int, default=None,
                    help="この明るさ超を背景とみなす(既定: crisp=110, soft=200)")
    args = ap.parse_args()

    bright_th = args.bright if args.bright is not None else (110 if args.mode == "crisp" else 200)

    files = collect_inputs(args.inputs)
    if not files:
        sys.exit("対象画像が見つかりませんでした。")

    print(f"対象 {len(files)} 件 / モード={args.mode} / chroma<{args.chroma} / bright>{bright_th}")
    for f in files:
        try:
            out_path, removed, total = process(f, args.out, args.suffix,
                                                args.mode, args.chroma, bright_th)
            pct = removed / total * 100
            print(f"  OK  {os.path.basename(f)} -> {out_path}  (透過 {pct:.1f}%)")
        except Exception as e:
            print(f"  NG  {f}: {e}")


if __name__ == "__main__":
    main()