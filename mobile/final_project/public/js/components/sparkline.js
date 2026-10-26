// 카드에 넣는 작은 추이 그래프 (장식용, 색은 등락 방향 클래스로)
export function sparkline(values, tone) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 64 30");
  svg.setAttribute("class", `kpi-spark ${tone}`);
  svg.setAttribute("aria-hidden", "true");
  if (!values?.length) return svg;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((v, i) => `${((i / (values.length - 1)) * 62 + 1).toFixed(1)},${(28 - ((v - min) / (max - min || 1)) * 26).toFixed(1)}`);
  const line = document.createElementNS(ns, "polyline");
  line.setAttribute("points", points.join(" "));
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "currentColor");
  line.setAttribute("stroke-width", "1.8");
  line.setAttribute("stroke-linejoin", "round");
  line.setAttribute("stroke-linecap", "round");
  svg.append(line);
  return svg;
}
