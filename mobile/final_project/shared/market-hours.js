// 정규장 운영 상태. 주말은 반영하지만 공휴일은 반영하지 않는다(화면에 함께 안내).
import { toMarketLocal } from "./news-markers.js";

export const SESSIONS = {
  KR: { open: 9 * 60, close: 15 * 60 + 30, label: "한국" },
  US: { open: 9 * 60 + 30, close: 16 * 60, label: "미국" },
};

function weekdayOf(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * @param {"KR" | "US"} market
 * @param {Date} [now]
 * @returns {{ state: "open" | "closed", label: string, detail: string }}
 */
export function marketStatus(market, now = new Date()) {
  const { date, minutes } = toMarketLocal(now.toISOString(), market);
  const session = SESSIONS[market];
  const day = weekdayOf(date);
  const weekend = day === 0 || day === 6;
  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const hours = `${fmt(session.open)}–${fmt(session.close)} 현지`;

  if (!weekend && minutes >= session.open && minutes < session.close) {
    return { state: "open", label: "장중", detail: hours };
  }
  if (!weekend && minutes < session.open) {
    return { state: "closed", label: "개장 전", detail: hours };
  }
  return { state: "closed", label: "장 마감", detail: hours };
}
