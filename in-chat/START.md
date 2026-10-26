# このチャットでGPTとオセロを遊ぶ

これは、GitHubからゲームを取得して、Web版ChatGPTの右側に表示し、そのチャットのGPTと対戦するための起動案内です。

**現在は検証版0.1.1です。Web版ChatGPT内での盤面表示は確認できましたが、黒を打った後にChatGPT側の送信確認が必要です。白の盤面は手動の再読み込み後に反映できました。確認なしの自動応答と、右側の盤面の自動更新は未達です。URLを渡すだけで自動対戦できる完成版としては案内できません。**

## 受け取ったChatGPTへ

利用者は、このURLからオセロを起動したいと考えています。READMEと次の2ファイルを読み、このチャットの通常のファイル作業領域に取得してください。

- [game.html](https://raw.githubusercontent.com/tianzhongshenshu382-a11y/gpt-reversi-local/main/in-chat/game.html)：画面、全ルール、対局状態、GPTへの手番依頼を含む単独HTML断片。
- [render_turn.py](https://raw.githubusercontent.com/tianzhongshenshu382-a11y/gpt-reversi-local/main/in-chat/render_turn.py)：あなたが選んだ白の一手をHTMLに埋める、実行して終了する補助ファイル。
- [README.md](https://github.com/tianzhongshenshu382-a11y/gpt-reversi-local/blob/main/in-chat/README.md)：手順と確認済みの範囲。

### 最初の表示

1. HTML内のコードを省略・置換せず、使える場合はVisualizeでこのチャット内に表示し、右側に展開できる形で返してください。ブラウザーだけの別ゲームに置き換えないでください。
2. 黒は利用者、白はあなた自身です。黒を打つまでは白を打たずに待ってください。
3. 利用者PCへのインストール、PCのサーバー、外部ゲームサーバー、トンネル、MCP接続、別の生成AI API、白を選ぶ内蔵アルゴリズムを追加しないでください。

### 黒が打たれた後

画面が `window.openai.sendFollowUpMessage` でこのチャットに渡す依頼には、黒の着手後の完全な `state` と白の `legalMoves` が含まれます。

1. `legalMoves` から、あなた自身が白の一手を考えてください。
2. 受け取った `state` を変更せず `turn.json` に保存してください。
3. 次をこのチャットのファイル作業領域で実行してください。`C5` は例であり、実際に選んだ座標に置き換えます。

```text
python3 render_turn.py --html game.html --snapshot turn.json --white C5
```

4. 更新した同じ `game.html` を、最初と同じチャット内の表示方法で返してください。Visualizeなら同じファイルの参照を使います。白の合法性と盤面への反映はHTMLのJavaScriptが行います。
5. 新規対局を作らず、座標を文章で返すだけで終了せず、追加のサーバーやAIで代用しないでください。

### 利用できない場合

HTML表示機能、現在のチャットへの手番依頼、GPT応答後の自動再表示のいずれかが利用できない場合は、その段階を具体的に報告してください。ファイル取得、開発用テスト、確認ダイアログの表示、別の盤面の表示をもって自動対戦の成功と扱わないでください。確認・送信・再表示のクリックが必要なら「黒を打つだけ」は未達です。

この案内はChatGPTが備えていない機能を追加するものではありません。
