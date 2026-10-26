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

/** 차트가 들어 있는 카드의 색 토큰을 읽는다 (어두운 카드 안에서는 어두운 색) */
function palette(container) {
  const style = getComputedStyle(container);
  const cssVar = (name) => style.getPropertyValue(name).trim();
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
  let colors = palette(container);
  const chart = createChart(container, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: colors.text,
      fontFamily: getComputedStyle(document.body).fontFamily,
      fontSize: 12,
    },
    grid: { vertLines: { visible: false }, horzLines: { color: colors.grid } },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
      horzLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
    },
    // 가격 축 폭을 확보해 현재가 라벨과 눈금이 붙지 않게 한다
    rightPriceScale: { borderVisible: false, minimumWidth: 64 },
    // 양 끝을 고정해 데이터 밖으로 밀려나지 않게 하고, 최신 봉을 오른쪽 끝에 붙인다
    timeScale: {
      borderVisible: false,
      fixLeftEdge: true,
      fixRightEdge: true,
      rightOffset: 0,
      lockVisibleTimeRangeOnResize: true,
    },
    // 관성 스크롤과 세로 끌기를 꺼서 차트가 튀지 않게 한다. 좌우 이동은 끌기·아래 스크롤 바로.
    kineticScroll: { mouse: false, touch: false },
    handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: false }, axisDoubleClickReset: true },
    localization: { locale: "ko-KR" },
  });

  // ----- 좌우 스크롤 바 -----
  const scroller = document.createElement("input");
  scroller.type = "range";
  scroller.className = "chart-scroll";
  scroller.setAttribute("aria-label", "차트 기간 이동 (왼쪽: 과거, 오른쪽: 최근)");
  scroller.min = "0";
  scroller.step = "1";
  container.after(scroller);
  let syncing = false;

  /** 지금 보이는 봉 개수와 오른쪽 끝 위치로 스크롤 바를 맞춘다 */
  const syncScroller = () => {
    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const width = Math.max(1, range.to - range.from);
    const maxRight = candles.length - 1;
    const minRight = Math.min(maxRight, Math.round(width));
    scroller.min = String(minRight);
    scroller.max = String(maxRight);
    scroller.hidden = minRight >= maxRight; // 전체가 다 보이면 숨긴다
    syncing = true;
    scroller.value = String(Math.round(Math.min(maxRight, Math.max(minRight, range.to))));
    syncing = false;
  };

  scroller.addEventListener("input", () => {
    if (syncing) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const width = range.to - range.from;
    const right = Number(scroller.value);
    chart.timeScale().setVisibleLogicalRange({ from: right - width, to: right });
  });
  chart.timeScale().subscribeVisibleLogicalRangeChange(syncScroller);

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
          // 글자는 캔들과 겹쳐 읽기 어려워 표시하지 않는다 (뉴스 수는 아래 목록·뉴스 패널에서 확인)
          text: "",
        };
      }),
    );
  };

  chart.subscribeClick((param) => {
    if (param.time !== undefined) onSelectDate(timeToDate(param.time));
  });

  const applyTheme = () => {
    colors = palette(container);
    chart.applyOptions({
      layout: { textColor: colors.text },
      grid: { vertLines: { visible: false }, horzLines: { color: colors.grid } },
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
      // 최신 봉이 오른쪽 끝에 오도록 맞춘다
      const apply = () => {
        chart.timeScale().setVisibleLogicalRange({ from: candles.length - bars - 0.5, to: candles.length - 0.5 });
        syncScroller();
      };
      apply();
      // 처음 그릴 때는 크기가 정해진 다음 프레임에 다시 맞춘다
      requestAnimationFrame(() => requestAnimationFrame(apply));
    },
  };
}
