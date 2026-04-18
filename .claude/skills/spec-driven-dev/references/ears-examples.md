# EARS記法サンプル集

EARS = Easy Approach to Requirements Syntax
このファイルはドメイン別のEARS記法サンプルを提供します。
キーワード（WHEN / THEN / IF / WHILE / WHERE / SHALL）は英語のまま使用し、
トリガーやふるまいの説明は日本語で記述します。

---

## Web / UI

```
WHEN ユーザーが「送信」ボタンをクリックする THEN the system SHALL すべての必須フィールドを検証する
IF 必須フィールドが空の場合 WHEN ユーザーが「送信」をクリックする THEN the system SHALL 空のフィールドを赤くハイライトする
WHEN すべてのフィールドが有効な場合 THEN the system SHALL フォームを送信し、成功メッセージを表示する
WHILE フォームを送信中 the system SHALL ローディングスピナーを表示し、送信ボタンを無効化する
WHEN サーバーがエラーを返した場合 THEN the system SHALL エラーメッセージをインラインで表示する
IF ユーザーが未認証の場合 WHEN 保護されたルートにアクセスする THEN the system SHALL /login にリダイレクトする
```

## 認証

```
WHEN ユーザーが有効なメールとパスワードを入力する THEN the system SHALL セッショントークンを発行する
IF メールアドレスが存在しない場合 WHEN ユーザーがログインを試みる THEN the system SHALL 「認証情報が無効です」と表示する
IF パスワードが間違っている場合 WHEN ユーザーがログインを試みる THEN the system SHALL 「認証情報が無効です」と表示する
WHEN ログインが5回連続で失敗した場合 THEN the system SHALL アカウントを15分間ロックする
WHILE アカウントがロック中 the system SHALL NOT ログイン試行を受け付ける
WHEN ユーザーが「パスワードを忘れた」をクリックする THEN the system SHALL 60秒以内にリセットメールを送信する
```

## API / バックエンド

```
WHEN クライアントが GET /users/:id を送信する THEN the system SHALL ユーザーオブジェクトをJSONで返す
IF ユーザーが存在しない場合 WHEN クライアントが GET /users/:id を送信する THEN the system SHALL 404を返す
IF リクエストにAuthorizationヘッダーがない場合 WHEN 保護されたエンドポイントを呼び出す THEN the system SHALL 401を返す
WHEN クライアントが無効なJSONボディを送信する THEN the system SHALL バリデーションエラーメッセージとともに400を返す
WHILE データベースが利用不可 the system SHALL 503を返してエラーをログに記録する
```

## ファイル操作

```
WHEN ユーザーがファイルを選択する THEN the system SHALL ファイルの種類とサイズを検証する
IF ファイルが10MBを超える場合 WHEN ユーザーがアップロードを試みる THEN the system SHALL エラーメッセージとともに拒否する
IF ファイルの種類が許可リストにない場合 THEN the system SHALL NOT アップロードを受け付ける
WHEN 有効なファイルがアップロードされた場合 THEN the system SHALL 5秒以内にファイルを保存してURLを返す
WHILE ファイルをアップロード中 the system SHALL 進捗をパーセンテージで表示する
```

## 通知

```
WHEN 新しいメッセージを受信する THEN the system SHALL 受信トレイアイコンにバッジを表示する
IF ユーザーがメール通知を有効にしている場合 WHEN 新しいメッセージが届く THEN the system SHALL 1分以内にメールを送信する
WHILE ユーザーが会話を表示中 the system SHALL NOT その会話のメッセージに対して通知を送らない
WHEN ユーザーがメッセージを既読にする THEN the system SHALL 未読バッジをクリアする
```

## 検索

```
WHEN ユーザーが検索ボックスに入力する THEN the system SHALL 300msのデバウンス後に検索結果を表示する
IF 検索結果が0件の場合 WHEN ユーザーが検索する THEN the system SHALL 「"<クエリ>"の検索結果はありません」と表示する
WHEN ユーザーがEscapeキーを押す THEN the system SHALL 検索をクリアして前の要素にフォーカスを戻す
WHILE 検索処理中 the system SHALL ローディングインジケーターを表示する
```

## データ操作（CRUD）

```
WHEN ユーザーが作成フォームを送信する THEN the system SHALL レコードを保存して一覧画面に戻る
IF 同じユニークキーのレコードが存在する場合 WHEN ユーザーが作成を試みる THEN the system SHALL 競合エラーを表示する
WHEN ユーザーが削除ボタンをクリックする THEN the system SHALL 削除前に確認ダイアログを表示する
IF ユーザーが削除を確認した場合 THEN the system SHALL レコードを論理削除して一覧から除外する
WHEN レコードが更新された場合 THEN the system SHALL updated_atタイムスタンプを記録する
```
