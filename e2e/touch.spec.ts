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

async function raiseButtonCenter(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const p = (window as any).__panepon;
    const t = p.scene.touches[0];
    const canvas = document.querySelector("canvas")!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / p.scene.scale.width;
    const scaleY = rect.height / p.scene.scale.height;
    return { x: rect.left + t.raiseButton.x * scaleX, y: rect.top + t.raiseButton.y * scaleY };
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

test("マウス: クリックでカーソル移動、ドラッグで入れ替え、ボタン押下でせり上げ", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
  await page.waitForTimeout(200);

  const c = await cellCenter(page, 1, 1);
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(100);
  const cursor = await page.evaluate(() => ({ ...(window as any).__panepon.game.boards[0].cursor }));
  expect(cursor).toEqual({ x: 1, y: 1 });

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

  const btn = await raiseButtonCenter(page);
  const rowsBefore = await page.evaluate(() => (window as any).__panepon.game.boards[0].stats.manualRows);
  await page.mouse.move(btn.x, btn.y);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  const rowsAfter = await page.evaluate(() => (window as any).__panepon.game.boards[0].stats.manualRows);
  expect(rowsAfter).toBeGreaterThan(rowsBefore);
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
    await page.goto("/?bgm=0");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT}/mobile-menu.png` });

    await page.goto("/?mode=endless&seed=7&bgm=0");
    await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
    await page.waitForTimeout(300);
    const size = await page.evaluate(() => {
      const p = (window as any).__panepon;
      return { w: p.scene.scale.width, h: p.scene.scale.height, visible: p.scene.touches[0].raiseButton.visible };
    });
    expect(size).toEqual({ w: 300, h: 600, visible: true });
    await page.screenshot({ path: `${SHOT}/mobile-endless.png` });

    const from = await cellCenter(page, 2, 0);
    await page.touchscreen.tap(from.x, from.y);
    await page.waitForTimeout(100);
    const cursor = await page.evaluate(() => ({ ...(window as any).__panepon.game.boards[0].cursor }));
    expect(cursor).toEqual({ x: 2, y: 0 });

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

    await page.goto("/?mode=versus&seed=7&bgm=0");
    await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOT}/mobile-versus.png` });
  });
});
