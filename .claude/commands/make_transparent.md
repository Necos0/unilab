---
description: 画像の白い背景とすき間を一括で透過する（ドット絵向けハードエッジ）
argument-hint: [入力パス/グロブ/ディレクトリ] [-o 出力先] [--mode crisp|soft]
allowed-tools: Bash, Read, Write
---

# 画像の白背景・すき間を一括透過

対象引数: `$ARGUMENTS`

引数は下記スクリプトにそのまま渡す。書式:
`<入力パス|グロブ|ディレクトリ ...> [-o 出力先] [--mode crisp|soft] [--chroma N] [--bright N] [--suffix 文字列]`

- 第1引数以降が入力。ディレクトリを渡すと中の画像を全部処理。グロブ（例 `sprites/*.png`）も可。
- 既定は**元画像を上書き**（`-o` も `--suffix` も省略時）。別名で残したいときは `--suffix _transparent` を付ける。`-o` で別ディレクトリにも出せる。
- 既定は **crisp**（半透明を作らないハードエッジ／ドット絵向け）。にじみを残したいときは `--mode soft`。

## 実行手順

ワーカースクリプトは `.claude/scripts/transparentize.py` に既にあるので、それを呼ぶだけ。

1. 依存確認。無ければ入れる:
   `python3 -c "import PIL, numpy" 2>/dev/null || pip install pillow numpy`
2. 実行する:
   `python3 .claude/scripts/transparentize.py $ARGUMENTS`
3. 引数が空なら使い方を表示して終了。処理後は各ファイルの保存先と透過率を一覧で報告する。

## 判定ロジック（仕組みの要約）

各ピクセルの「鮮やかさ(chroma=max-min)」と「明るさ(brightness=min)」で判定する。無彩色（chroma小）かつ明るい部分＝白〜明るいグレーの背景・すき間・にじみを透過し、黄みがかったクリーム色など色のある部分や黒い輪郭は残す。`--chroma`（既定40）と `--bright`（crisp既定110 / soft既定200）でしきい値を調整できる。

詳しい実装は `.claude/scripts/transparentize.py` を参照。