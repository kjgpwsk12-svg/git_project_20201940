// 경제 지표 표시 형식. 홈 카드와 경제지표 화면이 함께 쓴다.

const num2 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 값: 4.00% · 0.42%p · 1,342.13원 · $96.24 · 121.60 */
export function formatIndicatorValue(ind, value = ind.value) {
  if (value === null || value === undefined) return "—";
  if (ind.unit === "$") return `$${num2.format(value)}`;
  return `${num2.format(value)}${ind.unit}`;
}

/** 금리처럼 %로 나타내는 지표는 변화도 %p로, 나머지는 변화율(%)로 */
export const isRateUnit = (unit) => unit === "%" || unit === "%p";

/** 변화 문구: "▲ 0.25%p", "▼ 0.09%", 변화가 없으면 "변동 없음" */
export function formatIndicatorChange(ind) {
  if (!ind.change) return "변동 없음";
  const arrow = ind.change > 0 ? "▲" : "▼";
  return isRateUnit(ind.unit)
    ? `${arrow} ${num2.format(Math.abs(ind.change))}%p`
    : `${arrow} ${num2.format(Math.abs(ind.changePercent))}%`;
}

/** 기준일: "10.13" (월.일) */
export function formatIndicatorDate(date) {
  const [, m, d] = date.split("-").map(Number);
  return `${m}.${d}`;
}
