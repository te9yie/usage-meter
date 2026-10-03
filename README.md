# usage-meter

Claude Codeのmod。現在のセッションのコンテキスト量と、5時間・週間のレート制限の使用量を、プロンプトの上に出す。

```
ctx ████░░░░░░░░░░░░ 7%   5h █████████░░░░░┃░ 55% 27m (07:00)   7d ██░░┃░░░░░░░░░░░ 10% 4d18h
```

5hと7dのバーの青い縦線は、期間のうち経過した位置を表す。縦線より塗りが短ければ、期間の経過より使用量が少ない。

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
- バーの色は70%、90%で変わる。
- コンテキスト量は最初の応答が返るまで出ない。

## remote-controlでは帯が出ない

Windowsのデスクトップアプリからremote-controlでリモートのCLIに繋ぐと、アプリが描画先として登録されず、`AbovePrompt` の帯は出ない。この場合は、応答のたびに同じ1行をtranscriptへ追記する。アプリでローカルのフォルダを開いたセッションでは帯が出る。
