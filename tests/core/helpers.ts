import { Board, NO_INPUT, type BoardEvent, type Input } from "../../src/core";

export function run(board: Board, frames: number, input: Input = NO_INPUT): BoardEvent[] {
  const events: BoardEvent[] = [];
  for (let i = 0; i < frames; i++) {
    board.tick(input);
    events.push(...board.events);
  }
  return events;
}

/** 1フレームだけ入力を与え、その後は無入力で進める。 */
export function press(board: Board, input: Partial<Input>, thenFrames = 0): BoardEvent[] {
  const events = run(board, 1, { ...NO_INPUT, ...input });
  events.push(...run(board, thenFrames));
  return events;
}

export function moveCursor(board: Board, x: number, y: number): void {
  board.cursor.x = x;
  board.cursor.y = y;
}

export function matches(events: BoardEvent[]) {
  return events.filter((e) => e.type === "match") as Extract<BoardEvent, { type: "match" }>[];
}

/** テスト用の空盤面。自動せり上がりなし、6種。 */
export function emptyBoard(kinds = 6): Board {
  return new Board({ seed: 1, kinds, initialHeight: 0, noRise: true });
}
