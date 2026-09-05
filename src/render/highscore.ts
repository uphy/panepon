import type { CpuLevel } from "../core";

export interface ScoreEntry {
  score: number;
  maxChain: number;
  /** ISO 8601 の日付。 */
  date: string;
}

export interface CpuRecord {
  wins: number;
  losses: number;
}

export interface HighScores {
  endless: ScoreEntry[];
  cpu: Record<CpuLevel, CpuRecord>;
}

const KEY = "panepon.highscores.v1";
const MAX_ENTRIES = 5;

function empty(): HighScores {
  return {
    endless: [],
    cpu: {
      easy: { wins: 0, losses: 0 },
      normal: { wins: 0, losses: 0 },
      hard: { wins: 0, losses: 0 },
    },
  };
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** localStorage に保存したハイスコア。壊れていたら空として扱う。 */
export function loadHighScores(): HighScores {
  const s = storage();
  if (!s) return empty();
  try {
    const raw = s.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<HighScores>;
    const base = empty();
    if (Array.isArray(parsed.endless)) {
      base.endless = parsed.endless
        .filter((e) => typeof e?.score === "number")
        .map((e) => ({ score: e.score, maxChain: e.maxChain ?? 1, date: e.date ?? "" }));
    }
    if (parsed.cpu) {
      for (const level of ["easy", "normal", "hard"] as CpuLevel[]) {
        const r = parsed.cpu[level];
        if (r) base.cpu[level] = { wins: r.wins ?? 0, losses: r.losses ?? 0 };
      }
    }
    return base;
  } catch {
    return empty();
  }
}

function save(h: HighScores): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(h));
  } catch {
    // 容量不足やプライベートモードでは保存できないが、ゲームは続けられる
  }
}

/**
 * エンドレスの結果を記録する。上位5件だけ残す。
 * 戻り値は順位（1始まり）。5位以内に入らなければ 0。
 */
export function recordEndless(score: number, maxChain: number, now = new Date()): number {
  const h = loadHighScores();
  const entry: ScoreEntry = { score, maxChain, date: now.toISOString().slice(0, 10) };
  h.endless.push(entry);
  h.endless.sort((a, b) => b.score - a.score || b.maxChain - a.maxChain);
  const rank = h.endless.indexOf(entry) + 1;
  h.endless = h.endless.slice(0, MAX_ENTRIES);
  save(h);
  return rank <= MAX_ENTRIES ? rank : 0;
}

/** CPU 対戦の勝敗を記録する。 */
export function recordCpuResult(level: CpuLevel, won: boolean): CpuRecord {
  const h = loadHighScores();
  const r = h.cpu[level];
  if (won) r.wins++;
  else r.losses++;
  save(h);
  return { ...r };
}

export function bestEndless(): ScoreEntry | null {
  return loadHighScores().endless[0] ?? null;
}
