// lightweight-charts로 일봉 + 거래량 + 뉴스 표시를 그린다.
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
} from "/vendor/lightweight-charts.mjs";

const RANGE_BARS = { "1M": 22, "3M": 66, "6M": 132, ALL: Infinity };

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function palette() {
  return {
    text: cssVar("--muted"),
    grid: cssVar("--line"),
    up: cssVar("--up"),
    down: cssVar("--down"),
    accent: cssVar("--accent"),
    foreground: cssVar("--text"),
    crosshair: cssVar("--line-strong"),
  };
}

/** 차트가 돌려주는 시간 값을 YYYY-MM-DD로 맞춘다 */
function timeToDate(time) {
  if (typeof time === "string") return time;
  if (typeof time === "number") return new Date(time * 1000).toISOString().slice(0, 10);
  const pad = (n) => String(n).padStart(2, "0");
  return `${time.year}-${pad(time.month)}-${pad(time.day)}`;
}

/**
 * @param {HTMLElement} container
 * @param {{ candles: object[], market: "KR" | "US", onSelectDate: (date: string) => void }} options
 */
export function createPriceChart(container, { candles, market, onSelectDate }) {
  let colors = palette();
  const chart = createChart(container, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: colors.text,
      fontFamily: getComputedStyle(document.body).fontFamily,
      fontSize: 11,
    },
    grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
      horzLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false },
    localization: { locale: "ko-KR" },
  });

  const candleColors = (c) => ({
    upColor: c.up,
    downColor: c.down,
    borderUpColor: c.up,
    borderDownColor: c.down,
    wickUpColor: c.up,
    wickDownColor: c.down,
  });

  const candleSeries = chart.addSeries(CandlestickSeries, {
    ...candleColors(colors),
    priceFormat:
      market === "KR" ? { type: "price", precision: 0, minMove: 1 } : { type: "price", precision: 2, minMove: 0.01 },
  });
  candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.26 } });

  const volumeSeries = chart.addSeries(HistogramSeries, {
    priceScaleId: "volume",
    priceFormat: { type: "volume" },
    lastValueVisible: false,
    priceLineVisible: false,
  });
  chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

  const markerPlugin = createSeriesMarkers(candleSeries, []);
  let markers = [];
  let selected = null;

  const setData = () => {
    candleSeries.setData(candles.map(({ date, open, high, low, close }) => ({ time: date, open, high, low, close })));
    volumeSeries.setData(
      candles.map((c, i) => ({
        time: c.date,
        value: c.volume,
        // 토큰 색(#rrggbb)에 투명도 35%(59)를 붙인다
        color: `${i > 0 && c.close < candles[i - 1].close ? colors.down : colors.up}59`,
      })),
    );
  };

  const drawMarkers = () => {
    markerPlugin.setMarkers(
      markers.map((m) => {
        const isSelected = m.date === selected;
        const base = m.kind === "up" ? colors.up : m.kind === "down" ? colors.down : colors.accent;
        return {
          time: m.date,
          position: m.kind === "down" ? "belowBar" : "aboveBar",
          shape: m.kind === "up" ? "arrowUp" : m.kind === "down" ? "arrowDown" : "circle",
          color: isSelected ? colors.foreground : base,
          size: m.kind === "flat" ? 0.5 : isSelected ? 1.6 : 1.1,
          text: m.kind === "flat" ? "" : `뉴스 ${m.newsCount}`,
        };
      }),
    );
  };

  chart.subscribeClick((param) => {
    if (param.time !== undefined) onSelectDate(timeToDate(param.time));
  });

  const applyTheme = () => {
    colors = palette();
    chart.applyOptions({
      layout: { textColor: colors.text },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      crosshair: {
        vertLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
        horzLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
      },
    });
    candleSeries.applyOptions(candleColors(colors));
    setData();
    drawMarkers();
  };
  window.addEventListener("themechange", applyTheme);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  setData();

  return {
    setMarkers(next) {
      markers = next;
      drawMarkers();
    },
    /** 날짜를 강조하고, 보이는 범위 밖이면 그 날짜가 보이도록 옮긴다 */
    setSelected(date) {
      selected = date;
      drawMarkers();
      const index = candles.findIndex((c) => c.date === date);
      const visible = chart.timeScale().getVisibleLogicalRange();
      if (index < 0 || !visible || (index >= visible.from && index <= visible.to)) return;
      const width = visible.to - visible.from;
      const from = Math.max(0, Math.min(index - width / 2, candles.length - width));
      chart.timeScale().setVisibleLogicalRange({ from, to: from + width });
    },
    setRange(range) {
      const bars = Math.min(RANGE_BARS[range], candles.length);
      chart.timeScale().setVisibleLogicalRange({ from: candles.length - bars, to: candles.length + 1 });
    },
  };
}
