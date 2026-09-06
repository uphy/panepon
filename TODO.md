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
- [x] せり上げの操作をもう1つ用意する
  - 対応: 盤面を2本の指で押している間もせり上げ（`TouchInput.onBoard`）。2本目が触れた時点で進行中のドラッグは捨てる。メニューの案内文に追記
- [x] 結果画面と案内文をタッチ向けの言葉にする
  - 対応: 結果画面の「R / tap: restart   Esc: menu」を RETRY / MENU ボタンに、「tap / P to resume」をポーズ画面のボタンに置き換えた。キー操作の案内はタッチ端末では出さない
- [x] 音の ON/OFF を画面に出す
  - 対応: メニューとポーズ画面に SOUND ボタン。iOS のサイレントスイッチの件は README に書く（次の項目でまとめて）
- [x] iOS の長押し対策
  - 対応: `-webkit-touch-callout: none` を body に追加
- [x] 画面のスリープ防止
  - 対応: `src/render/wakelock.ts`。GameScene の間だけ取り、画面が戻ったら取り直す。メニューへ戻ると外す

## 3. あれば良い（機能追加）

- [x] 記録の共有と一覧
  - 対応: 結果画面に SHARE（`src/render/share.ts`。Web Share API がなければクリップボードへコピーして COPIED と出す）。メニューの記録をタップすると上位5件と CPU 戦の勝敗の一覧
- [x] スマホの e2e を増やす
  - 対応: `e2e/mobile.spec.ts`（CPU 対戦の非対称レイアウト、ポーズボタン、回転、2本指せり上げ、iPhone 14）、`e2e/records.spec.ts`、`e2e/pwa.spec.ts`。iPhone 14 の Safari は 390×664 で背が低いので、縦持ちの高さを画面の縦横比から決めるようにした（幅固定、高さは下限 500〜上限 640）
- [x] タイムアタック（2分で何点）
  - 対応: `GameMode` に `timeattack`。`Game.timeLimit` / `framesLeft` / `timeUp`。残り時間はフレームで数えるのでポーズ中は減らない。記録は `highscores.timeattack` に別で保存。`?time=秒` で制限時間を変えられる（e2e 用）
- [ ] ステージクリア・パズルモード（未着手。面データの方針が要る）
  - パズルモードは「決められた手数で全部消す」面データが要る。原作の面を写すか自作するかを決めてから。ロジック側は Board に「せり上がりなし・手数カウント・全消し判定」を足せばよい
- [x] 横持ちのスマホ専用レイアウト
  - 対応: `Layout.phoneLandscape`（タッチ端末で実画面の高さ 560px 未満）。高さ 412 固定で盤面を画面いっぱいに描き、HUD（得点・時間・予告おじゃま・せり上げ矢印）を盤面の横に置く `BoardView.hud`。2P と CPU 対戦は盤面を左右の端（40 論理px）に寄せ、ポーズは中央下。メニューは下段を3列にする
  - 直した不具合: 回転後に canvas が細長いまま中央に残っていた。Phaser の Scale.FIT は最初の縦横比を `resize()` でも保持するので、`applyLayout` で `displaySize.setAspectRatio` を入れ直す。e2e に回転後の canvas 実寸の検証を足した
  - マスの大きさは Pixel 7 横持ちで実画面 32px（縦持ちは 44px）。盤面が 12 段ある以上これが上限
- [ ] オンライン機能（Cloudflare の無料枠で足りる。順に 1 → 2 → 3）
  - 今の構成は `wrangler deploy` で静的ファイルを配るだけ。同じ Worker に API を足し、`wrangler.jsonc` に `main`・`d1_databases`・`durable_objects` を追加する。CI の secret はそのまま使える
  - 無料枠（2026-09 時点の公開値）: Workers リクエスト 10万/日・CPU 10ms/回。D1 読み 500万行/日・書き 10万行/日・5GB。Durable Objects は SQLite 版のみ、リクエスト 10万/日・13,000 GB秒/日、WebSocket の受信は 20通で1リクエスト換算
  - [ ] 1. スコアのオンライン共有
    - D1 に `scores(mode, score, max_chain, name, date, seed)` の1テーブル。Worker が `POST /api/scores` と `GET /api/scores?mode=` を受ける
    - 不正対策は別件。決定論的シミュレーションなので入力列を送れば検証できるが、2分ぶん（7,200 tick）の再生は Worker の CPU 10ms に収まらないので、検証は保存とは別の Worker に分けるか後回し
  - [ ] 2. 「今日の seed」でスコア勝負
    - 日付から seed を決めて同じ盤面を配り、seed 付きで D1 に保存する。サーバーにゲームのロジックは要らない
  - [ ] 3. リアルタイム対戦
    - Durable Objects を部屋1つにつき1つ作り、2人が WebSocket でつなぐ。送るのは seed と各フレームの入力だけ（ロックステップ）。サーバーは中継するだけ
    - 上限は WebSocket の受信メッセージ数で決まる。毎フレーム送る（60通/秒×2人＝6リクエスト/秒）と1日 約4.6時間、3フレームごとにまとめる（2リクエスト/秒）と 約14時間の対戦ぶん。CPU 時間の枠は約29時間ぶんあるので先に効くのはリクエスト数
    - 相手の入力が届くまで進められないので、入力に 3〜4 フレームの遅延を入れる。Durable Objects は最初に接続した人の近くに作られ、日本同士なら往復 20〜40ms。核心はゲーム側の入力遅延と再同期で、サーバー側は薄い
    - もっと遊ばせるなら、Durable Objects は部屋作りとシグナリングだけにして、入力は WebRTC DataChannel で直接送る。Cloudflare を通るのは最初の数往復だけになる。NAT 越えに失敗する端末（キャリア回線同士）の救済に使う TURN は Cloudflare Realtime の無料枠（月 1TB）で賄える
- [ ] iOS の振動（未着手。実機がないと確かめられない）
  - `navigator.vibrate` は使えない。iOS 18 以降の Safari で `<input type="checkbox" switch>` の切り替えが触覚を鳴らす仕様を使った回避策があるが、鳴らせるのは短い1種類で動作保証もない。試すなら `vibrate-test.html` に足して端末で確かめてから

## 4. 実機で遊んで見つかったこと（2026-09-06）

- [x] 横持ちの 2P 対戦で盤面を左右の端に寄せる
  - 対応済み（`1bd5b4e`、未デプロイ時点の報告）。横持ちのスマホ用レイアウトで、盤面は左右 40 論理px（実画面 約39px）の位置。手がぶつからないよう、これ以上は Android の戻るジェスチャ領域（24dp）を踏まない範囲で寄せてある。実機で試して足りなければ `GameScene.place()` の `edge` を詰める
- [ ] 上下のブラウザ UI（URL バー・メニューバー）を除いて使う
  - Android Chrome は Fullscreen API（`documentElement.requestFullscreen()`）がユーザー操作から呼べるので、メニューに FULLSCREEN ボタンを置く。終了・回転で解除されるので、ゲーム開始時にも取り直す
  - iPhone の Safari は Fullscreen API を動画以外に使えない。ホーム画面に追加した PWA（standalone）で開けば URL バーが消えるので、案内文に書く。ブラウザのままなら `100dvh` で URL バーが縮んだぶんは追従している（対応済み）
- [ ] 危険状態で曲を変える
  - 原作は上 3〜4 段まで積み上がると別の曲（ピンチの曲）に切り替わる。今はテンポを 1.3 倍にするだけで気づきにくい
  - `src/render/bgm.ts` にピンチ用の曲を1つ足し、`setDanger` でテンポではなく曲を切り替える。戻るときは元の曲の続きから。曲はコードで書く方針なので `tools/bgm-candidates.html` で候補を作ってから
- [ ] CPU を強くする
  - まず不具合: 15 秒くらい経つと CPU が止まる。これが弱さの一番の原因。`src/core/ai.ts` で「手が見つからないと待ち続ける」「消去中の読みで詰まる」のどちらかを疑い、再現する seed を見つけてテストにする
  - 次に難易度の作り直し。今の hard は「速いだけ」で、運が良いと押し切るが基本は弱い。操作速度は人より少し速い程度に抑え、賢さで差をつける
    - 消せる手を並べて、連鎖につながる手（消したあとに落ちて揃う）を優先する
    - おじゃまが乗っているときは、おじゃまに隣接する手を優先して変身させる
    - 危険状態では連鎖より即消しを優先し、平時は縦積みで連鎖を仕込む
    - 難易度は「読みの深さ」「待ち時間」「せり上げの積極性」で分ける
- [ ] スワイプで動かしたパネルは、下が空なら落ちる
  - 原作は入れ替え先の下が空だとそこで落ちる。今はドラッグを続けると谷を越えて運べてしまう（落ちたあとも同じ段で入れ替えを続けるため）
  - `TouchInput.onMove` で、入れ替えたあとに移動先の下が空（row 0 でなく、真下が EMPTY）ならドラッグを終える。core 側の落下はそのまま
- [ ] おじゃまが変身しないケースがある
  - 原作は隣接するパネルが消えると必ず変身する。クローンでは変身しない場面がかなりあるとの報告。具体例は未特定
  - 疑う順: (1) 落下中・着地直後のおじゃまに隣接して揃った場合 (2) 変身中のおじゃまに別の消去が隣接した場合 (3) 入れ替えで動かしたパネルがそのまま揃った場合の隣接判定 (4) 灰色（ビックリ）と通常の板が接している場合
  - fuzz テストに「揃ったパネルに隣接するおじゃまは、消去が終わるまでに必ず transforming になる」という不変条件を足して、破れる seed を拾う（`tests/core/fuzz.test.ts`）
