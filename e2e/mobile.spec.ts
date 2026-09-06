import { expect, test, devices, type Page } from "@playwright/test";

const pixel = devices["Pixel 7"];
test.use({
  viewport: pixel.viewport,
  deviceScaleFactor: pixel.deviceScaleFactor,
  isMobile: pixel.isMobile,
  hasTouch: pixel.hasTouch,
  userAgent: pixel.userAgent,
});

/** 論理座標を画面（client）座標にする。 */
async function toScreen(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([gx, gy]) => {
      const p = (window as any).__panepon;
      const rect = document.querySelector("canvas")!.getBoundingClientRect();
      const s = rect.width / p.layout.width;
      return { x: rect.left + gx * s, y: rect.top + gy * s };
    },
    [x, y],
  );
}

test("縦持ちの CPU 対戦は自分の盤面が等倍、CPU の盤面が半分。画面端に 24dp 以上の余白", async ({ page }) => {
  await page.goto("/?mode=cpu&cpu=easy&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    const p = (window as any).__panepon;
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    const s = rect.width / p.layout.width;
    const [me, cpu] = p.scene.views;
    return {
      layout: { w: p.layout.width, h: p.layout.height, portrait: p.layout.portrait },
      scales: [me.scale, cpu.scale],
      left: rect.left + me.ox * s,
      right: window.innerWidth - (rect.left + (cpu.ox + 192 * cpu.scale) * s),
      cellPx: 32 * s,
    };
  });
  expect(info.layout).toEqual({ w: 340, h: 600, portrait: true });
  expect(info.scales).toEqual([1, 0.5]);
  expect(info.left).toBeGreaterThanOrEqual(24);
  expect(info.right).toBeGreaterThanOrEqual(24);
  // 自分のマスは指で押せる大きさ（36dp 以上）
  expect(info.cellPx).toBeGreaterThanOrEqual(36);
});

test("画面のポーズボタンで止まり、ポーズ画面の RESUME で再開する。SOUND の切り替えは保存される", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
  await page.waitForTimeout(200);
  const btn = await page.evaluate(() => {
    const b = (window as any).__panepon.scene.pauseButton;
    return { x: b.x, y: b.y };
  });
  const at = await toScreen(page, btn.x, btn.y);
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(100);
  const paused = await page.evaluate(() => {
    const p = (window as any).__panepon;
    return { paused: p.scene.paused, menu: p.scene.pauseMenu.visible, rows: p.game.boards[0].stats.manualRows };
  });
  expect(paused).toEqual({ paused: true, menu: true, rows: 0 });

  // ポーズ画面の SOUND を押すとミュートになり、localStorage に残る
  const sound = await page.evaluate(() => {
    const scene = (window as any).__panepon.scene;
    const b = scene.pauseButtons.find((x: any) => x.text.startsWith("SOUND"));
    return { x: b.x + scene.pauseMenu.x, y: b.y + scene.pauseMenu.y };
  });
  const soundAt = await toScreen(page, sound.x, sound.y);
  await page.touchscreen.tap(soundAt.x, soundAt.y);
  await page.waitForTimeout(100);
  const muted = await page.evaluate(() => {
    const scene = (window as any).__panepon.scene;
    const b = scene.pauseButtons.find((x: any) => x.text.startsWith("SOUND"));
    return { text: b.text, stored: localStorage.getItem("panepon.mute.v1"), stillPaused: scene.paused };
  });
  expect(muted).toEqual({ text: "SOUND: OFF", stored: "on", stillPaused: true });

  const resume = await page.evaluate(() => {
    const scene = (window as any).__panepon.scene;
    const b = scene.pauseButtons.find((x: any) => x.text === "RESUME");
    return { x: b.x + scene.pauseMenu.x, y: b.y + scene.pauseMenu.y };
  });
  const resumeAt = await toScreen(page, resume.x, resume.y);
  await page.touchscreen.tap(resumeAt.x, resumeAt.y);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).__panepon.scene.paused)).toBe(false);
});

test("回転すると横向きのレイアウトに置き直し、ゲームは続く", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => {
    const p = (window as any).__panepon;
    return { frame: p.game.boards[0].frame, portrait: p.layout.portrait, text: p.game.boards[0].toString() };
  });
  expect(before.portrait).toBe(true);

  await page.setViewportSize({ width: pixel.viewport.height, height: pixel.viewport.width });
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const p = (window as any).__panepon;
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    return {
      frame: p.game.boards[0].frame,
      layout: { w: p.layout.width, h: p.layout.height, portrait: p.layout.portrait },
      canvasCenter: rect.left + rect.width / 2,
      windowCenter: window.innerWidth / 2,
      boardTop: p.scene.views[0].oy,
    };
  });
  expect(after.layout).toEqual({ w: 800, h: 520, portrait: false });
  expect(after.frame).toBeGreaterThan(before.frame);
  // canvas は中央に置かれる（CSS と Phaser の二重の中央寄せでずれない）
  expect(Math.abs(after.canvasCenter - after.windowCenter)).toBeLessThan(2);
  expect(after.boardTop).toBe(70);

  // 戻すと縦持ちに戻る
  await page.setViewportSize({ width: pixel.viewport.width, height: pixel.viewport.height });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__panepon.layout.portrait)).toBe(true);
});
