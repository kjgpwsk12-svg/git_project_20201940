// 숫자·날짜 표시 형식. 서버와 브라우저가 함께 쓰는 모듈이다.

const krw = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const indexFormat = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatPrice(value, market) {
  return market === "KR" ? `${krw.format(value)}원` : `$${usd.format(value)}`;
}

export function formatIndexValue(value) {
  return indexFormat.format(value);
}

const signOf = (value) => (value > 0 ? "+" : value < 0 ? "−" : "");

/** @param {"KR" | "US" | "index"} kind */
export function formatChange(value, kind) {
  const abs = Math.abs(value);
  const body = kind === "KR" ? krw.format(abs) : kind === "US" ? usd.format(abs) : indexFormat.format(abs);
  return `${signOf(value)}${body}`;
}

export function formatPercent(value) {
  return `${signOf(value)}${Math.abs(value).toFixed(2)}%`;
}

/** 한국식 표기로 통일: 상승(up) 빨강, 하락(down) 파랑 */
export function toneOf(change) {
  return change > 0 ? "up" : change < 0 ? "down" : "flat";
}

export function formatVolume(value) {
  if (value >= 1e8) return `${(value / 1e8).toFixed(1)}억`;
  if (value >= 1e4) return `${Math.round(value / 1e4).toLocaleString("ko-KR")}만`;
  return value.toLocaleString("ko-KR");
}

const dateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatKoreanDateTime(iso) {
  return dateTime.format(new Date(iso));
}

export function formatDateLabel(date) {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}년 ${m}월 ${d}일 (${weekday})`;
}

const shortDate = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric" });

/** 글·댓글 작성 시각: "방금 전", "5분 전", "3시간 전", "2일 전", 일주일이 넘으면 날짜 */
export function formatRelativeTime(iso, now = new Date()) {
  const seconds = Math.max(0, (now - new Date(iso)) / 1000);
  if (seconds < 60) return "방금 전";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}일 전`;
  return shortDate.format(new Date(iso));
}
