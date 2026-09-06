# TODO: スマホをメインにする

スマホ（縦持ち・タッチ・PWA）で遊ぶことを前提にした変更の一覧。上から順に対応する。
終わった項目は `[x]` にして、どう対応したかを1行添える。

## 1. 最優先（遊び心地を直接損なっている）

- [x] 描画解像度をスマホに合わせる
  - 対応: `src/render/hidpi.ts`。canvas を論理サイズ × DPR で作り、カメラ zoom を DPR にして論理座標を保つ。テクスチャは DPR 倍で生成して Image を 1/DPR に縮め、`scene.add.text` の resolution を既定で DPR にした。入力は Pointer の worldX / worldY を使う
- [x] 回転・リサイズに追従する
  - 対応: BoardView を原点付きの Container にして `place(ox, oy, scale)` で動かせるようにし、GameScene の `place()` が全 UI を置く。window の resize を 150ms 待ってから `layoutFor` を再評価し、変わっていれば置き直す。メニューは作り直す
  - 残り: 横持ちのスマホは 800×520 のデスクトップ用レイアウトを縮小して出すので小さい。横持ち専用のレイアウトは未対応
- [x] 画面上の操作ボタンを置く
  - 対応: `src/render/ui.ts` の Button（背景つき・pointerdown を止める）。盤面右上に ❚❚、ポーズ画面に RESUME / RESTART / SOUND / VIBRATION / MENU、終了後の盤面に RETRY / MENU。ミュートは localStorage に保存
- [x] タップ対象を指の大きさにする
  - 対応: 「tap here: menu」は廃止（ポーズ画面の MENU へ）。縦持ちの CPU 対戦は自分の盤面が等倍、CPU の盤面が 0.5 倍の非対称レイアウト（幅 340）。メニュー項目の padding を増やし、SOUND / VIBRATION を Button にした
- [x] セーフエリアを避ける
  - 対応: `#app` に `env(safe-area-inset-*)` の padding、内側の `#game` を Phaser の親にした。中央寄せは Phaser の autoCenter だけに任せる（CSS でも寄せると二重にずれる）。Playwright は safe-area を再現できないので実機で確認が必要

## 2. 次点（スマホ運用として欲しい）

- [x] PWA としてインストールできる形にする
  - 対応: vite-plugin-pwa（generateSW, autoUpdate）で manifest と Service Worker を生成。アイコンは `tools/make-icons.mjs` が zlib だけで PNG を書く（192 / 512 / maskable 512 / apple-touch-icon 180）。`e2e/pwa.spec.ts` でオフライン再読込を確認
- [ ] せり上げの操作をもう1つ用意する
  - 今は「盤面の外を押し続ける」だけ。縦持ちのエンドレスは盤面が画面幅いっぱいなので、押せる場所が上下の余白に限られる
  - 候補は専用の RAISE ボタン、盤面の2本指押し、上フリック。パネルドラッグと衝突しにくいのはボタンか2本指
- [x] 結果画面と案内文をタッチ向けの言葉にする
  - 対応: 結果画面の「R / tap: restart   Esc: menu」を RETRY / MENU ボタンに、「tap / P to resume」をポーズ画面のボタンに置き換えた。キー操作の案内はタッチ端末では出さない
- [x] 音の ON/OFF を画面に出す
  - 対応: メニューとポーズ画面に SOUND ボタン。iOS のサイレントスイッチの件は README に書く（次の項目でまとめて）
- [x] iOS の長押し対策
  - 対応: `-webkit-touch-callout: none` を body に追加
- [ ] 画面のスリープ防止
  - Screen Wake Lock API を取り、`visibilitychange` で再取得する。Android Chrome と iOS 16.4 以降で動く

## 3. あれば良い（機能追加）

- [ ] 記録の共有と一覧
  - Web Share API で「SCORE / MAX CHAIN」をテキスト共有
  - 上位5件の一覧を出す画面。今はベスト1件しかメニューに出ない
- [ ] スマホの e2e を増やす
  - 縦持ち・タッチのテストは Pixel 7 だけ。iPhone のサイズ（390×844）と横持ちのケースを足し、解像度とセーフエリアの回帰を止める
- [ ] 1人で遊ぶモードの拡充
  - タイムアタック（2分で何点）。エンドレスより1回が短くスマホ向き
  - ステージクリア・パズルモード（README の未実装項目）
- [ ] オンライン対戦
  - 2P VERSUS は同じ画面を2人で触る前提で、スマホでは成立しにくい。決定論的シミュレーションなので seed と入力列を送り合うロックステップ方式で作れる
  - 非同期の「同じ seed でスコア勝負」なら、サーバーはスコアを預かるだけで済む
- [ ] iOS の振動
  - `navigator.vibrate` は使えない。iOS 18 以降の Safari で `<input type="checkbox" switch>` の切り替えが触覚を鳴らす仕様を使った回避策があるが、鳴らせるのは短い1種類で動作保証もない。試すなら `vibrate-test.html` に足して端末で確かめてから
