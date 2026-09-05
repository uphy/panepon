import { describe, expect, it } from "vitest";
import { capScore, chainBonus, comboBonus, matchScore } from "../../src/core";

describe("得点表（SFC版・ファンサイト実測）", () => {
  it("同時消しボーナスは4個から付き、31個は0点、32個以上は約33,300点", () => {
    expect(comboBonus(3)).toBe(0);
    expect(comboBonus(4)).toBe(20);
    expect(comboBonus(5)).toBe(30);
    expect(comboBonus(10)).toBe(100);
    expect(comboBonus(30)).toBe(1330);
    expect(comboBonus(31)).toBe(0);
    expect(comboBonus(32)).toBe(33_300);
  });

  it("連鎖ボーナスは2連鎖50点から13連鎖1,800点まで。14連鎖以降は0", () => {
    expect(chainBonus(1)).toBe(0);
    expect(chainBonus(2)).toBe(50);
    expect(chainBonus(5)).toBe(300);
    expect(chainBonus(13)).toBe(1800);
    expect(chainBonus(14)).toBe(0);
    expect(chainBonus(20)).toBe(0);
  });

  it("3枚消しを13連鎖まで続けると累計9,170点", () => {
    let total = 0;
    const expectedCumulative: Record<number, number> = {
      2: 110, 3: 220, 4: 400, 5: 730, 6: 1160, 7: 1690, 8: 2420,
      9: 3350, 10: 4480, 11: 5810, 12: 7340, 13: 9170,
    };
    for (let chain = 1; chain <= 13; chain++) {
      total += matchScore(3, chain);
      if (expectedCumulative[chain]) expect(total).toBe(expectedCumulative[chain]);
    }
    expect(total).toBe(9170);
  });

  it("同時消しと連鎖が同時に成立すると両方のボーナスが入る", () => {
    expect(matchScore(4, 2)).toBe(40 + 20 + 50);
  });

  it("得点は99,999でカンストする", () => {
    expect(capScore(120_000)).toBe(99_999);
  });
});
