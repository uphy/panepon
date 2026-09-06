import { expect, test, devices } from "@playwright/test";

const pixel = devices["Pixel 7"];
test.use({
  viewport: pixel.viewport,
  deviceScaleFactor: pixel.deviceScaleFactor,
  isMobile: pixel.isMobile,
  hasTouch: pixel.hasTouch,
  userAgent: pixel.userAgent,
});

test("メニューの記録をタップすると上位5件の一覧が開き、CLOSE で閉じる", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "panepon.highscores.v1",
      JSON.stringify({
        endless: [
          { score: 4321, maxChain: 4, date: "2026-09-01" },
          { score: 1000, maxChain: 2, date: "2026-09-02" },
        ],
        cpu: { easy: { wins: 1, losses: 0 }, normal: { wins: 0, losses: 2 }, hard: { wins: 0, losses: 0 } },
      }),
    );
  });
  await page.goto("/?bgm=0");
  await page.waitForTimeout(400);
  // 記録のテキストを叩く
  const pos = await page.evaluate(() => {
    const scene = (window as any).__paneponScenes.menu;
    const t = scene.children.getByName("records");
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    const s = (rect.width / scene.scale.width) * scene.cameras.main.zoom;
    return { x: rect.left + t.x * s, y: rect.top + (t.y + t.height / 2) * s };
  });
  await page.touchscreen.tap(pos.x, pos.y);
  await page.waitForTimeout(200);
  const list = await page.evaluate(() => {
    const scene = (window as any).__paneponScenes.menu;
    const panel = scene.children.getByName("records-list");
    return panel ? panel.list.find((o: any) => typeof o.text === "string" && o.text.includes("TOP 5"))?.text : null;
  });
  expect(list).toContain("1.  004321   x4   2026-09-01");
  expect(list).toContain("2.  001000   x2   2026-09-02");
  expect(list).toContain("NORMAL  0W 2L");

  const close = await page.evaluate(() => {
    const scene = (window as any).__paneponScenes.menu;
    const panel = scene.children.getByName("records-list");
    const b = panel.list.find((o: any) => o.text === "CLOSE");
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    const s = (rect.width / scene.scale.width) * scene.cameras.main.zoom;
    return { x: rect.left + b.x * s, y: rect.top + b.y * s };
  });
  await page.touchscreen.tap(close.x, close.y);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => Boolean((window as any).__paneponScenes.menu.children.getByName("records-list")))).toBe(false);
});

test("結果画面の SHARE で navigator.share に得点が渡る", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__shared = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: unknown) => {
        (window as any).__shared.push(data);
        return Promise.resolve();
      },
    });
  });
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
  await page.evaluate(() => {
    const p = (window as any).__panepon;
    p.game.boards[0].score = 777;
    p.game.boards[0].maxChain = 3;
    p.game.boards[0].gameOver = true;
    p.game.finished = true;
  });
  // 結果のボタンは終了の 800ms 後に出る
  await page.waitForFunction(() => {
    const v = (window as any).__panepon.scene.views[0];
    return v.overlay.list.some((o: any) => o.text === "SHARE");
  });
  const share = await page.evaluate(() => {
    const p = (window as any).__panepon;
    const v = p.scene.views[0];
    const b = v.overlay.list.find((o: any) => o.text === "SHARE");
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    const s = rect.width / p.layout.width;
    // overlay は盤面の中央が原点
    return { x: rect.left + (v.ox + 96 + b.x) * s, y: rect.top + (v.oy + 192 + b.y) * s };
  });
  await page.touchscreen.tap(share.x, share.y);
  await page.waitForTimeout(200);
  const shared = await page.evaluate(() => (window as any).__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].text).toBe("PANEPON  SCORE 777  MAX CHAIN x3");
  expect(shared[0].url).toContain("http://127.0.0.1:4173/");
});
