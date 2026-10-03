# SPOROCYST prototype

貝の体内でスポロシスト群体を育て、宿主の健康と免疫警戒を管理しながら、セルカリアを次の宿主へ送り出す短編ブラウザゲームです。

スポロシスト、セルカリア、超寄生などの用語と、ゲームが題材にしている吸虫の生活環については [USER_MANUAL.md](USER_MANUAL.md) を参照してください。

## 起動方法

依存パッケージやビルドは不要です。

1. `dist/index.html` をブラウザで直接開く
2. または、このフォルダで簡易HTTPサーバーを起動する

```bash
python3 -m http.server 8000 --directory dist
```

その後、`http://localhost:8000` を開いてください。

## ファイル

- `dist/index.html` — HTML、CSS、JavaScriptを含むゲーム本体
- `USER_MANUAL.md` — 生活環、用語、ゲーム内表現の解説
- `.openai/hosting.json` — ChatGPT Sites向け公開設定

## 注意

ゲーム内の数値は生物学的実測値ではなく、ゲーム性を確認するための仮想モデルです。
