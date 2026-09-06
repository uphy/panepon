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
  // 340 × 839 / 412 = 692 だが上限 640 で止まる
  expect(info.layout).toEqual({ w: 340, h: 640, portrait: true });
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

test("盤面を2本指で押している間はせり上げ。離すと止まる", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
  await page.waitForTimeout(200);
  // 揃いのない静かな盤面にして、消去でせり上げが止まらないようにする
  await page.evaluate(() => {
    (window as any).__panepon.game.boards[0].setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
  });
  const view = await page.evaluate(() => {
    const v = (window as any).__panepon.scene.views[0];
    return { ox: v.ox, oy: v.oy };
  });
  const a = await toScreen(page, view.ox + 48, view.oy + 200);
  const b = await toScreen(page, view.ox + 144, view.oy + 200);
  const cdp = await page.context().newCDPSession(page);
  const rowsBefore = await page.evaluate(() => (window as any).__panepon.game.boards[0].stats.manualRows);
  // 入れ替えが起きていないことは、最下段の並びがそのまま（せり上がって1段上がるだけ）なことで確かめる
  const bottomBefore = await page.evaluate(() => {
    const b = (window as any).__panepon.game.boards[0];
    return [0, 1, 2, 3, 4, 5].map((x) => b.cell(x, 0).kind);
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y, id: 0 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y, id: 0 }, { x: b.x, y: b.y, id: 1 }] });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__panepon.scene.touches[0].raising)).toBe(true);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(100);
  const rowsAfter = await page.evaluate(() => (window as any).__panepon.game.boards[0].stats.manualRows);
  expect(rowsAfter).toBeGreaterThan(rowsBefore);
  expect(await page.evaluate(() => (window as any).__panepon.scene.touches[0].raising)).toBe(false);
  // 2本指で押しただけでは入れ替えが起きない
  const bottomAfter = await page.evaluate(
    (rows) => {
      const b = (window as any).__panepon.game.boards[0];
      return [0, 1, 2, 3, 4, 5].map((x) => b.cell(x, rows).kind);
    },
    rowsAfter - rowsBefore,
  );
  expect(bottomAfter).toEqual(bottomBefore);
});

test.describe("iPhone 14", () => {
  const iphone = devices["iPhone 14"];
  test.use({
    viewport: iphone.viewport,
    deviceScaleFactor: iphone.deviceScaleFactor,
    isMobile: iphone.isMobile,
    hasTouch: iphone.hasTouch,
    userAgent: iphone.userAgent,
  });

  test("縦持ちレイアウトになり、canvas は DPR 3 で作られて中央に置かれる", async ({ page }) => {
    await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
    await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const p = (window as any).__panepon;
      const canvas = document.querySelector("canvas")!;
      const rect = canvas.getBoundingClientRect();
      return {
        layout: { w: p.layout.width, h: p.layout.height, portrait: p.layout.portrait, touch: p.layout.touch },
        backing: [canvas.width, canvas.height],
        centerDx: Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2),
        cellPx: (32 * rect.width) / p.layout.width,
      };
    });
    // iPhone 14 の Safari は 390×664 なので、高さは下限の 500 まで下がる
    expect(info.layout).toEqual({ w: 300, h: 511, portrait: true, touch: true });
    expect(info.backing).toEqual([900, 1533]);
    expect(info.centerDx).toBeLessThan(2);
    expect(info.cellPx).toBeGreaterThanOrEqual(36);
  });
});
