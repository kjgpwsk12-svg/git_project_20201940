// 도넛 차트 (SVG). 자산 구성처럼 몇 개의 비중을 보여줄 때 쓴다.
const SVG_NS = "http://www.w3.org/2000/svg";

/** 구분이 잘 되는 색. 다크 모드에서도 보이도록 중간 밝기로 고른다. */
export const DONUT_COLORS = ["#13a89a", "#3b82f6", "#f59e0b", "#e5484d", "#8b5cf6", "#10b981", "#ec4899", "#64748b"];

/**
 * @param {{ label: string, value: number, color: string }[]} segments
 * @param {{ size?: number, label: string }} options label: 화면 읽기 프로그램용 설명
 */
export function donut(segments, { size = 150, label }) {
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  svg.classList.add("donut-chart");

  const circle = (attrs) => {
    const c = document.createElementNS(SVG_NS, "circle");
    for (const [k, v] of Object.entries({ cx: 60, cy: 60, r, fill: "none", "stroke-width": 14, ...attrs })) c.setAttribute(k, String(v));
    svg.append(c);
    return c;
  };
  circle({ class: "donut-track" });

  let offset = 0;
  if (total > 0) {
    for (const s of segments) {
      const length = (s.value / total) * circumference;
      // 조각 사이에 아주 작은 틈을 둔다 (조각이 하나면 틈 없이)
      const gap = segments.length > 1 ? Math.min(1.5, length / 3) : 0;
      circle({
        stroke: s.color,
        "stroke-dasharray": `${Math.max(0, length - gap)} ${circumference}`,
        "stroke-dashoffset": -offset,
        transform: "rotate(-90 60 60)",
      });
      offset += length;
    }
  }
  return svg;
}
