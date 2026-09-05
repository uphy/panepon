import { expect, test, devices, type Page } from "@playwright/test";

const SHOT = "e2e/__screenshots__";

/** 盤面のマス (x,y) の画面上の中心座標を求める。 */
async function cellCenter(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([cx, cy]) => {
      const p = (window as any).__panepon;
      const t = p.scene.touches[0];
      const canvas = document.querySelector("canvas")!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / p.scene.scale.width;
      const scaleY = rect.height / p.scene.scale.height;
      const gx = t.ox + cx * 32 + 16;
      const gy = t.oy + (11 - cy) * 32 + 16 - p.game.boards[0].riseProgress * 32;
      return { x: rect.left + gx * scaleX, y: rect.top + gy * scaleY };
    },
    [x, y],
  );
}

/** 盤面のすぐ下（盤面の外）の画面座標。ここを押し続けるとせり上げ。 */
async function belowBoard(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const p = (window as any).__panepon;
    const t = p.scene.touches[0];
    const canvas = document.querySelector("canvas")!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / p.scene.scale.width;
    const scaleY = rect.height / p.scene.scale.height;
    return { x: rect.left + (t.ox + 96) * scaleX, y: rect.top + (t.oy + 12 * 32 + 40) * scaleY };
  });
}

function kinds(page: Page, x1: number, x2: number, y: number): Promise<number[]> {
  return page.evaluate(
    ([a, b, row]) => {
      const board = (window as any).__panepon.game.boards[0];
      return [board.cell(a, row).kind, board.cell(b, row).kind];
    },
    [x1, x2, y],
  );
}

test("マウス: クリックで入れ替え、ドラッグで入れ替え、盤面の外を押してせり上げ", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
  await page.waitForTimeout(200);

  // (1,1) と (2,1) の境目をクリック → 1回で入れ替わる
  const tapBefore = await kinds(page, 1, 2, 1);
  const c1 = await cellCenter(page, 1, 1);
  const c2 = await cellCenter(page, 2, 1);
  await page.mouse.click((c1.x + c2.x) / 2, c1.y);
  await page.waitForTimeout(150);
  const cursor = await page.evaluate(() => ({ ...(window as any).__panepon.game.boards[0].cursor }));
  expect(cursor).toEqual({ x: 1, y: 1 });
  expect(await kinds(page, 1, 2, 1)).toEqual([tapBefore[1], tapBefore[0]]);

  const before = await kinds(page, 3, 4, 0);
  const from = await cellCenter(page, 3, 0);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y, { steps: 4 });
  await page.mouse.move(from.x + 40, from.y, { steps: 4 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  const after = await kinds(page, 3, 4, 0);
  expect(after).toEqual([before[1], before[0]]);

  // 消去処理中はせり上げが止まるので、揃いのない静かな盤面に置き換えてから盤面の外を押す
  await page.evaluate(() => {
    const b = (window as any).__panepon.game.boards[0];
    b.setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
  });
  await page.waitForTimeout(200);
  const below = await belowBoard(page);
  const rowsBefore = await page.evaluate(() => (window as any).__panepon.game.boards[0].stats.manualRows);
  await page.mouse.move(below.x, below.y);
  await page.mouse.down();
  await page.waitForTimeout(500);
  const raising = await page.evaluate(() => (window as any).__panepon.scene.touches[0].raising);
  await page.mouse.up();
  expect(raising).toBe(true);
  const rowsAfter = await page.evaluate(() => (window as any).__panepon.game.boards[0].stats.manualRows);
  expect(rowsAfter).toBeGreaterThan(rowsBefore);
  const released = await page.evaluate(() => (window as any).__panepon.scene.touches[0].raising);
  expect(released).toBe(false);
});

test.describe("スマホ縦画面", () => {
  const pixel = devices["Pixel 7"];
  test.use({
    viewport: pixel.viewport,
    deviceScaleFactor: pixel.deviceScaleFactor,
    isMobile: pixel.isMobile,
    hasTouch: pixel.hasTouch,
    userAgent: pixel.userAgent,
  });

  test("縦レイアウトになり、タッチのタップ・ドラッグが効く", async ({ page }) => {
    await page.goto("/?bgm=0&countdown=0");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT}/mobile-menu.png` });

    await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
    await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
    await page.waitForTimeout(300);
    const size = await page.evaluate(() => {
      const p = (window as any).__panepon;
      return { w: p.scene.scale.width, h: p.scene.scale.height };
    });
    expect(size).toEqual({ w: 300, h: 600 });
    await page.screenshot({ path: `${SHOT}/mobile-endless.png` });

    // (2,0) と (3,0) の境目をタップ → 1回で入れ替わる
    const tapBefore = await kinds(page, 2, 3, 0);
    const from = await cellCenter(page, 2, 0);
    const next = await cellCenter(page, 3, 0);
    await page.touchscreen.tap((from.x + next.x) / 2, from.y);
    await page.waitForTimeout(150);
    const cursor = await page.evaluate(() => ({ ...(window as any).__panepon.game.boards[0].cursor }));
    expect(cursor).toEqual({ x: 2, y: 0 });
    expect(await kinds(page, 2, 3, 0)).toEqual([tapBefore[1], tapBefore[0]]);
    await page.waitForTimeout(1200); // タップで揃った場合の消去処理を待つ

    const before = await kinds(page, 2, 3, 0);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + 25, y: from.y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + 45, y: from.y }] });
    await page.waitForTimeout(150);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(100);
    const after = await kinds(page, 2, 3, 0);
    expect(after).toEqual([before[1], before[0]]);

    // 盤面の下をタッチで押し続けるとせり上げ
    await page.waitForTimeout(1500);
    const below = await belowBoard(page);
    const rowsBefore = await page.evaluate(() => (window as any).__panepon.game.boards[0].stats.manualRows);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: below.x, y: below.y }] });
    await page.waitForTimeout(500);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const rowsAfter = await page.evaluate(() => (window as any).__panepon.game.boards[0].stats.manualRows);
    expect(rowsAfter).toBeGreaterThan(rowsBefore);

    await page.goto("/?mode=versus&seed=7&bgm=0&countdown=0");
    await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOT}/mobile-versus.png` });
  });
});
