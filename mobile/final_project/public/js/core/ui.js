// 화면 공통 조각: 등락 표시, 기준 시각, 메시지, 시장 배지
import { formatChange, formatKoreanDateTime, formatPercent, toneOf } from "/shared/format.js";
import { el } from "./dom.js";

/** 전일 대비 변화. 색만으로 구분하지 않도록 ▲▼ 기호와 부호를 함께 쓴다. */
export function changeText(change, changePercent, kind, extraClass = "") {
  const tone = toneOf(change);
  const arrow = tone === "up" ? "▲ " : tone === "down" ? "▼ " : "";
  return el(
    "span",
    { class: `mono ${tone} ${extraClass}`.trim() },
    el("span", { "aria-hidden": "true" }, arrow),
    `${formatChange(change, kind)} (${formatPercent(changePercent)})`,
  );
}

/** 등락률 알약 */
export function changePill(changePercent) {
  const tone = toneOf(changePercent);
  return el("span", { class: `pill ${tone}` }, formatPercent(changePercent));
}

export function marketBadge(market) {
  return el("span", { class: `badge ${market.toLowerCase()}` }, market === "KR" ? "KR" : "US");
}

/** "10. 12. 14:30 기준" 또는 갱신 실패 경고 */
export function fetchedText({ fetchedAt, stale }) {
  return el(
    "span",
    { class: stale ? "up" : "" },
    `${stale ? "갱신 실패 · 이전 데이터 · " : ""}${formatKoreanDateTime(fetchedAt)} 기준`,
  );
}

/** 폼·페이지 안내 메시지 */
export function showMessage(target, text, kind = "error") {
  target.textContent = text;
  target.className = `alert ${kind}`;
  target.hidden = !text;
}

export function skeletonRows(count, columns) {
  return Array.from({ length: count }, () =>
    el("tr", {}, ...Array.from({ length: columns }, () => el("td", {}, el("span", { class: "skeleton", style: "width:70%" })))),
  );
}
