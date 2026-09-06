# swaprise

パネルを入れ替えて揃え、せり上がる盤面で連鎖を狙うアクションパズル。ブラウザで動く。仕様の全体は README.md にある。

## コマンド

```sh
pnpm typecheck        # tsc --noEmit
pnpm test             # コアの単体テスト（vitest、数秒）
pnpm e2e              # Playwright。ビルドして preview を立てて回す（40秒ほど）
pnpm test:balance     # CPU に何分も遊ばせるバランスの回帰テスト（分単位）
pnpm sim duel|endless|levels   # バランス調整用のシミュレーション（tools/sim/）
pnpm puzzles          # パズル面の生成
```

初回の e2e には `pnpm exec playwright install chromium` が必要。worktree を並べるときは `DEV_PORT` / `PREVIEW_PORT` でポートを変える。

## 構造

- `src/core/` はゲームロジック。DOM・Phaser に依存しない純粋な TypeScript で、60fps の固定 tick の決定論的シミュレーション。同じ seed と入力列なら同じ結果になる。ここは Node だけで動くので、単体テストもシミュレーションもブラウザなしで回せる
- `src/render/` は Phaser 4 の描画・入力・音。画像・音声ファイルは使わず、すべてコードで生成する
- `tests/core/` が単体テスト、`e2e/` が Playwright。`e2e` からは `window.__swaprise`（game / scene / tick）と `window.__swapriseAudio` で内部を触れる
- タイミングは `src/core/constants.ts` の `TIMING` にフレーム数でまとまっている

## 判断の基準

- **仕様に迷ったら原作（SFC のパネルでポン）の挙動に合わせる**。おじゃまの変身、連鎖の板の送り方、入れ替え中の揃い判定は原作どおりにして解決した
- **バランスは数値で示す**。「速い・遅い」「強い・弱い」を変えるときは `pnpm sim` で前後を計測し、コミットメッセージに数字を書く（例: 最短の試合が10秒から32秒）。人の代わりは `tools/sim/proxy.ts` の CASUAL（遅い CPU）を使う。実際の初心者はこれより消す量が少ない
- **本家の名称を出さない**。panepon / Panel de Pon / パネポン とその類語は、コード・文言・README のどこにも書かない。原作の挙動に言及するときは「原作」と書く
- **localStorage のキーは `swaprise.*.v1`**。旧キー `panepon.*` からの移行は `src/render/storage.ts` が起動時に行う

## テストの書き方

- e2e の待ちは `waitForTimeout` より `waitForFunction` を使う。表示待ちの固定時間は flaky の元
- 盤面は `board.setColumns([[列0の下から], [列1], ...])` で組む。揃いのない静かな盤面が要るときは `[[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]`
- 挙動を直したときは、修正前のコードで新しいテストが落ちることを確認してからコミットする

## git

- コミットメッセージは日本語で、何をなぜ変えたかを1つの文にまとめる（既存のログに合わせる）
- 別のエージェントや人が同じ作業ツリーを触っていることがある。コミットは `git add -A` ではなく、自分が変えたファイルを名指しで add する。`git status` に自分の知らない変更があれば、それは含めずにユーザーへ伝える
- main への push で Cloudflare Workers にデプロイされる（`.github/workflows/deploy.yml`）。旧 URL の転送用 Worker（`redirect/`）は `pnpm deploy:redirect` で手動デプロイ。Worker の削除とリポジトリ名の変更はしない
