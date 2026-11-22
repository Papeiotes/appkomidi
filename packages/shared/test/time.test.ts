import { describe, expect, it } from "vitest";
import { athensParts, copyAthensClock } from "../src/time";

describe("shift copy in Europe/Athens", () => {
  it("keeps 08:00 when copying a winter shift onto another winter day", () => {
    const source = new Date("2026-01-15T06:00:00.000Z");
    expect(athensParts(source).hour).toBe(8);
    const copied = copyAthensClock(source, "2026-02-02");
    expect(copied.toISOString()).toBe("2026-02-02T06:00:00.000Z");
    expect(athensParts(copied)).toMatchObject({ year: 2026, month: 2, day: 2, hour: 8, minute: 0 });
  });

  it("keeps 08:00 across DST, so the UTC hour changes", () => {
    const winter = new Date("2026-01-15T06:00:00.000Z");
    const inSummer = copyAthensClock(winter, "2026-07-15");
    expect(inSummer.toISOString()).toBe("2026-07-15T05:00:00.000Z");
    expect(athensParts(inSummer).hour).toBe(8);

    const summer = new Date("2026-07-15T05:00:00.000Z");
    const inWinter = copyAthensClock(summer, "2026-01-20");
    expect(inWinter.toISOString()).toBe("2026-01-20T06:00:00.000Z");
    expect(athensParts(inWinter)).toMatchObject({ day: 20, hour: 8, minute: 0 });
  });

  it("keeps minutes, not just the hour", () => {
    const source = new Date("2026-03-10T06:30:00.000Z");
    const copied = copyAthensClock(source, "2026-11-04");
    expect(athensParts(copied)).toMatchObject({ month: 11, day: 4, hour: 8, minute: 30 });
  });
});
