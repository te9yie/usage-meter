# usage-meter

Claude Codeのmod。5時間と週間のレート制限の使用量を、プロンプトの上に出す。

```
5H ▰▰▱▱▱▱▱▱▱▱▱▱ 1% · 4h 41m  ◆  WK ▰▱▱▱▱▱▱▱▱▱▱▱ 7% · 4d 8h
```

## 入れ方

Claude Codeで次を実行する。

```
/plugin marketplace add te9yie/usage-meter
/plugin install usage-meter@usage-meter
```

## 動き

- 使用量はClaude Codeがセッション内で持っている値（`session.measure` の `rateLimits`）を読む。自前のネットワークアクセスはなく、何も保存しない。
- サブスクリプション以外のアカウントでは値が空なので、何も出ない。
- `/usage-meter` で今の値を1行で返す。
- バーの色は40%、70%、90%で変わる。

## remote-controlでは帯が出ない

Windowsのデスクトップアプリからremote-controlでリモートのCLIに繋ぐと、アプリが描画先として登録されず、`AbovePrompt` の帯は出ない。この場合は、応答のたびに同じ1行をtranscriptへ追記する。アプリでローカルのフォルダを開いたセッションでは帯が出る。
