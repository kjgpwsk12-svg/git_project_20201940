// 여러 종목 시세를 한 번에 불러온다 (서버가 캐시하므로 자주 불러도 외부 API 호출은 제한된다)
import { api } from "./api.js";

/** @returns {Promise<Record<string, { quote: object | null, fetchedAt: string | null, stale: boolean }>>} */
export async function fetchQuotes(ids) {
  if (ids.length === 0) return {};
  const { results } = await api(`/api/quotes?ids=${encodeURIComponent(ids.join(","))}`);
  return Object.fromEntries(results.map((r) => [r.id, r]));
}

/** 탭이 보일 때만 주기적으로 실행 */
export function everyVisible(ms, fn) {
  return setInterval(() => {
    if (document.visibilityState === "visible") fn();
  }, ms);
}
