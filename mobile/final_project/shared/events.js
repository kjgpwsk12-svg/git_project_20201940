// 경제 일정 표시 도우미. DB의 economic_events 값(supabase/schema.sql)과 같은 분류를 쓴다.

export const EVENT_CATEGORIES = {
  rate: "금리",
  inflation: "물가",
  employment: "고용",
  gdp: "성장",
  earnings: "실적",
  other: "기타",
};

export const EVENT_COUNTRIES = { KR: "한국", US: "미국", GLOBAL: "글로벌" };

const seoulDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

/** 서울 날짜 (YYYY-MM-DD) */
export const seoulDateOf = (iso) => seoulDay.format(new Date(iso));

/** 서울 날짜 기준 남은 날: "D-DAY", "D-3", 지났으면 null */
export function dday(iso, now = new Date()) {
  const toDay = (d) => Date.UTC(...d.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  const diff = Math.round((toDay(seoulDateOf(iso)) - toDay(seoulDateOf(now.toISOString()))) / 86400_000);
  if (diff < 0) return null;
  return diff === 0 ? "D-DAY" : `D-${diff}`;
}

/** 날짜별로 묶는다 (입력은 시각 순서로 정렬되어 있다고 본다) */
export function groupByDate(events) {
  const groups = [];
  for (const e of events) {
    const date = seoulDateOf(e.scheduled_at);
    const last = groups.at(-1);
    if (last?.date === date) last.events.push(e);
    else groups.push({ date, events: [e] });
  }
  return groups;
}

/** 해당 월(YYYY-MM)의 서울 기준 시작·끝 시각 (ISO) */
export function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - 9 * 3600_000);
  const end = new Date(Date.UTC(y, m, 1) - 9 * 3600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}
