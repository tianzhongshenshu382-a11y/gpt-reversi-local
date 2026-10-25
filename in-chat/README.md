# ChatGPT内で動かすオセロ — 外部ゲームサーバーなしの検証

## 目的と現在の状態

GitHubのURLをWeb版ChatGPTに渡し、画面内のHTML・CSS・JavaScriptでゲームを動かし、そのチャットのGPTを白の相手にする。各自PCのサーバー、一時トンネル、外部MCP、生成AI APIは使わない。

`game.html` は依存部品のないHTML断片。画面内のJavaScriptが合法手、裏返し、手番、パス、終局、重複防止を処理する。白を自動選択するアルゴリズムは含まない。GPTが選んだ座標だけを受け付ける。

この方式は検証中。通常のブラウザーで開くだけではGPTにつながらない。ChatGPTが供給するHTML表示と `window.openai.sendFollowUpMessage` が必要。確認ダイアログや再表示操作が残れば「黒クリックだけ」の達成とは扱わない。

既存の各自PC版0.2.2は別の成功例としてそのまま保持する。

## 受け取ったChatGPTへの手順

1. このREADME、`game.html`、`render_turn.py` を読む。
2. `game.html` と `render_turn.py` を、このチャットのファイル作業領域に取得する。利用者PCへのインストールやサーバー起動はしない。
3. HTML断片をそのままChatGPT内に表示する。Visualizeが使える場合はその表示機能を使える。ゲームのJavaScriptを省略・置換せず、内蔵の相手AIを追加しない。必要ならユーザーが右側へ展開する。
4. 黒を打つと画面内で着手を適用し、その盤面と合法手を `sendFollowUpMessage` でこのチャットへ送る。保存状態だけには依存せず、依頼文にも盤面を含める。
5. あなた自身が白の一手を選ぶ。依頼中の `state` をJSONファイルに保存し、次を実行する。

```text
python3 render_turn.py --html game.html --snapshot turn.json --white C5
```

`C5` は例であり、その都度あなたが合法手から選ぶ。ヘルパーはJSONをHTMLへ埋め込むだけで、AIでもサーバーでもない。次の表示時にHTML内のJavaScriptが手番とrevisionを検証して白を適用する。

6. 更新した同じ `game.html` を、初回と同じChatGPT内の表示方法で返す。Visualizeの場合は同じファイルの参照を返す。文章で座標を回答するだけで盤面が変わったと扱わない。
7. 同じ盤面の右側表示が自動更新されるか、確認・送信・再表示クリックが必要かを実測する。未確認を成功扱いしない。利用できない機能を外部サーバーで補わない。

## 開発

`node build.mjs` で画面・ルール・状態処理を `game.html` に一体化する。`node --test session.test.mjs` はゲーム処理とネットワーク依存不在の検証であり、実際のGPT自動応答の証明ではない。
