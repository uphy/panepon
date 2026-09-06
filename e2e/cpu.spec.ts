import { expect, test } from "@playwright/test";

const SHOT = "e2e/__screenshots__";

test("CPU 対戦: 2P 側を CPU が動かし、放置すると負けて勝敗が記録される", async ({ page }) => {
  await page.goto("/?mode=cpu&cpu=hard&seed=5&speed=30&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { boards: p.game.boards.length, cpu: Boolean(p.game.cpu), level: p.game.cpu?.level, touches: p.scene.touches.length };
  });
  expect(info).toEqual({ boards: 2, cpu: true, level: "hard", touches: 1 });

  // 描画ループを止め、決定論的に進める
  await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    for (let i = 0; i < 600; i++) p.tick([{ moveX: 0, moveY: 0, swap: false, raise: false }]);
  });
  const cleared = await page.evaluate(() => (window as any).__swaprise.game.boards[1].panelsCleared);
  expect(cleared).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${SHOT}/cpu.png` });

  await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    for (let i = 0; i < 60 * 60 * 4 && !p.game.finished; i++) p.tick([{ moveX: 0, moveY: 0, swap: false, raise: false }]);
  });
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.waitForFunction(() => (window as any).__swaprise.game.finished);
  await page.waitForTimeout(200);
  const winner = await page.evaluate(() => (window as any).__swaprise.game.winner);
  expect(winner).toBe(1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("swaprise.highscores.v1") ?? "{}"));
  expect(stored.cpu.hard.losses).toBe(1);
  await page.screenshot({ path: `${SHOT}/cpu-result.png` });
});

test("ハイスコア: エンドレスの結果が保存され、メニューに表示される", async ({ page }) => {
  await page.goto("/?mode=endless&seed=3&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.score = 4321;
    b.maxChain = 4;
    const col: number[] = [];
    for (let r = 0; r < 12; r++) col.push(r % 2);
    b.setColumns([col]);
  });
  await page.waitForFunction(() => (window as any).__swaprise.game.finished);
  await page.waitForTimeout(200);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("swaprise.highscores.v1") ?? "{}"));
  expect(stored.endless[0]).toMatchObject({ score: 4321, maxChain: 4 });

  // 2回目はより低い得点。1位は変わらず、2位に入る
  await page.keyboard.press("r");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game) && !(window as any).__swaprise.game.finished);
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.score = 1000;
    const col: number[] = [];
    for (let r = 0; r < 12; r++) col.push(r % 2);
    b.setColumns([col]);
  });
  await page.waitForFunction(() => (window as any).__swaprise.game.finished);
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("swaprise.highscores.v1") ?? "{}"));
  expect(after.endless.map((e: any) => e.score)).toEqual([4321, 1000]);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  // 1 PLAYER を開くと ENDLESS の下にベストが出る
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const records = await page.evaluate(() => {
    const scene = (window as any).__swaprise.scene.scene.manager.getScene("menu");
    const t = scene.children.getByName("item-endless-caption");
    return t ? t.text : "";
  });
  expect(records).toContain("BEST 004321");
  expect(records).toContain("MAX CHAIN x4");
  await page.screenshot({ path: `${SHOT}/menu-records.png` });
});
