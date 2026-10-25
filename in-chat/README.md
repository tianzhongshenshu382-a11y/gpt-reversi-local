# ChatGPT内で動かすオセロ — 外部ゲームサーバーなしの検証

**配布用の入口：[START.md](https://github.com/tianzhongshenshu382-a11y/gpt-reversi-local/blob/main/in-chat/START.md)**

目標は「このURLをWeb版ChatGPTへ貼る → 必要なファイルを取得 → 右側でオセロを開く → 黒を打つだけで、そのチャットのGPTが白を打つ」です。現時点の0.1.1はその構成の検証版であり、この一連の動作が完成したという意味ではありません。

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

## 配布物

実行に使うのは `game.html` と `render_turn.py`。起動手順は `START.md` とこのREADMEに記載。`game.html` 自体に読みやすい形で全ゲームコードを含むため、利用時のビルドや依存パッケージ取得は不要。

GitHubから最初に取得した後、ゲームコードが外部のゲーム処理先へアクセスすることはない。GPTの思考とチャット表示にはChatGPT自体の通信を使う。通常のブラウザーでHTMLを開くだけでは、そのチャットのGPTへ接続されない。

| ファイル | 役割 |
|---|---|
| `START.md` | URLを受け取ったChatGPT向けの起動・対局手順 |
| `game.html` | 配布する自己完結した画面と全ゲームコード |
| `render_turn.py` | GPTが選んだ手と盤面JSONをHTMLへ埋める補助処理 |
| `engine.mjs` | 合法手、裏返しなどのルールの原本 |
| `session.mjs` | 履歴、手番、状態の検証、GPTへ送る依頼文の原本 |
| `ui.js` | クリック、表示、保存、GPTへの依頼処理の原本 |
| `game.template.html` | 画面のHTML・CSS原本 |
| `build.mjs` | 原本を `game.html` にまとめ、配布物のハッシュを生成 |
| `manifest.json` | バージョン、必要なホスト機能、確認状況、実行ファイルのSHA-256 |
| `session.test.mjs` / `ui.test.mjs` / `render_turn_test.py` | 開発側のテスト。ChatGPT上の動作確認とは区別 |
| `AGENTS.md` | この構成を保守する際の制約 |

## 0.1.1の修正

- 保存された白の手番を復元した後や、送信済みの応答が止まった場合に再依頼できるようにした。通常の黒着手では自動依頼し、復元時は重複依頼を勝手に送らない。
- 古い保存状態や別対局の遅れて届いた状態で、現在の盤面を巻き戻さない。
- 履歴から盤面を再現してJSONの転記誤りを検出し、応答ID・着手との整合性も検証する。
- 補助ファイルも書き込み前に入力形式を検証する。白の合法性は画面内のJavaScriptが判定する。

開発者はNode.jsで `node build.mjs` の後、`node --test session.test.mjs ui.test.mjs` を実行する。補助処理は `python -m unittest render_turn_test.py` で確認する。利用者PCでこれらを実行する必要はない。

## 2026-10-26の実測結果

| 項目 | 結果 |
|---|---|
| ゲーム処理の画面内への移行 | 実装済み。外部のゲーム処理URL、API呼び出し、相手AIなし |
| 開発側のルール・状態・UI処理テスト | 6テスト成功。合法手での30対局、パス・終局、古い白応答の拒否、同じ応答の重複防止、送信する盤面の一致を確認 |
| GPTの応答をHTMLへ埋める補助処理 | 合成の黒D3・白C5で動作確認。これは実際のGPT対戦の証明ではない |
| GitHub掲載内容と開発側HTMLの一致 | 改行形式・末尾改行を除き一致 |
| 既存PC版の保持 | 追加前の25ファイルすべてのGit blob SHAが不変。成功例を削除・変更していない |
| 実際のWeb版ChatGPTへのGitHub URL入力 | README・HTML・補助ファイルを取得し、インタラクティブ表示を生成するところまで進行 |
| Web版のインライン表示 | `TimeoutError: MCP sandbox RPC timed out.`。チャットを一度再読み込みしても表示失敗 |
| 通常のHTMLファイルプレビュー | 右側のペインは開いたが「このファイルを読み込めませんでした」。再試行1回でも失敗 |
| 完全なHTML文書で包む追加試験 | 右側のペインは開いたが「可視化内でエラーが発生しました」 |
| ゲームを含まない対照試験 | JavaScript・CSS・外部参照のない、文字とボタンだけの最小HTMLも同じ `MCP sandbox RPC timed out` で初期化失敗。ゲームコード特有の問題とは区別 |
| 実際の黒クリック→このチャットのGPT→白の反映 | 画面を表示できなかったため未確認・未達 |

Web試験はログイン済みChrome上の既存検証チャットで実施。別アカウント・履歴のない受け取り側チャットでの試験は未実施。MCPサーバーやPC版の古い盤面を、新方式の成功証拠には使っていない。

現時点では依頼された一連の動作を満たす完成版ではない。表示機能のエラーがある環境で、URLだけで対戦開始できるとは案内しない。

今回の再確認でも、既存Web検証チャットを再読み込みしてHTMLを右側で開いたところ「このファイルを読み込めませんでした」となった。ゲームを含まない最小表示も前回同様に失敗しているため、完成を宣言せず `manifest.json` のWeb動作確認フラグを `false` のままとする。

参考：OpenAI公式の [Visualizations](https://learn.chatgpt.com/docs/visualizations)、[HTMLファイルのプレビュー](https://learn.chatgpt.com/docs/artifacts-viewer)、[コンポーネントとチャットの通信](https://developers.openai.com/plugins/reference)。これらの機能の説明自体は、この配布物での成功を証明しない。
