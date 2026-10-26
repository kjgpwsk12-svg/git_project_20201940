import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dday, groupByDate, monthRange, seoulDateOf } from "../shared/events.js";

describe("경제 일정", () => {
  it("서울 날짜로 바꾼다 (미국 오후 발표는 서울 다음 날 새벽)", () => {
    assert.equal(seoulDateOf("2026-10-28T18:00:00Z"), "2026-10-29");
  });

  it("D-day는 서울 날짜 기준", () => {
    const now = new Date("2026-10-14T03:00:00Z"); // 서울 10월 14일 낮
    assert.equal(dday("2026-10-22T00:00:00Z", now), "D-8");
    assert.equal(dday("2026-10-14T14:00:00Z", now), "D-DAY"); // 서울 10월 14일 23시
    assert.equal(dday("2026-10-13T00:00:00Z", now), null);
  });

  it("같은 날 일정을 묶는다", () => {
    const groups = groupByDate([
      { scheduled_at: "2026-11-06T13:30:00Z" },
      { scheduled_at: "2026-11-06T14:00:00Z" },
      { scheduled_at: "2026-11-10T13:30:00Z" },
    ]);
    assert.deepEqual(groups.map((g) => [g.date, g.events.length]), [["2026-11-06", 2], ["2026-11-10", 1]]);
  });

  it("월 범위는 서울 1일 0시부터", () => {
    assert.deepEqual(monthRange("2026-10"), { start: "2026-09-30T15:00:00.000Z", end: "2026-10-31T15:00:00.000Z" });
    assert.equal(monthRange("2026-12").end, "2026-12-31T15:00:00.000Z");
  });
});
