/**
 * 結果の共有。Web Share API（Android Chrome・iOS Safari）があれば OS の共有シートを出し、
 * なければクリップボードへコピーする。戻り値は何をしたか。
 */
export type ShareOutcome = "shared" | "copied" | "failed";

export function canShare(): boolean {
  return typeof navigator !== "undefined" && (typeof navigator.share === "function" || Boolean(navigator.clipboard));
}

export async function shareText(text: string): Promise<ShareOutcome> {
  const url = typeof location !== "undefined" ? location.origin + location.pathname : "";
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "PANEPON", text, url });
      return "shared";
    } catch {
      // 共有シートを閉じた（AbortError）か、対応していない。クリップボードへ
    }
  }
  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    return "copied";
  } catch {
    return "failed";
  }
}
