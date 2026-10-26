// 경제 지도: 주요 상장사 본사 위치 (Leaflet + OpenStreetMap), 분야 필터, 목록과 지도 연동
import * as L from "/vendor/leaflet.mjs";
import { formatPercent, formatPrice, toneOf } from "/shared/format.js";
import { parseSymbolId } from "/shared/symbols.js";
import { getStatus } from "../core/api.js";
import { getSupabase, koreanError } from "../core/auth.js";
import { $, el, icon } from "../core/dom.js";
import { fetchQuotes } from "../core/quotes.js";
import { initShell } from "../core/shell.js";

initShell();

/** 분야별 색 (밝은 지도·어두운 지도 모두에서 구분되는 중간 밝기) */
const SECTOR_COLORS = {
  "반도체·전자": "#3b82f6",
  "인터넷·소프트웨어": "#8b5cf6",
  자동차: "#e5484d",
  "2차전지·소재": "#13a89a",
  "바이오·제약": "#10b981",
  금융: "#f59e0b",
  "철강·화학·에너지": "#64748b",
  "조선·기계·방산": "#0ea5e9",
  통신: "#ec4899",
  "게임·엔터": "#d946ef",
  "유통·소비재": "#f97316",
};
const colorOf = (sector) => SECTOR_COLORS[sector] ?? "#64748b";

const REGIONS = {
  KR: { center: [36.3, 127.8], zoom: 7 },
  US: { center: [38.5, -98], zoom: 4 },
  ALL: { center: [38, 175], zoom: 2 },
};

/** 지도 타일. OpenStreetMap 공개 타일 서버는 이용 정책(출처 표시, 과도한 요청 금지)을 지켜야 하며, 다른 제공자로 바꿀 때는 여기만 고친다 */
const TILES = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
};

const state = { region: "KR", sector: "all", query: "", companies: [], markers: new Map(), selected: null, priceLabel: "" };
getStatus().then((s) => (state.priceLabel = s?.isDemo ? "데모 시세" : (s?.marketLabel ?? "")));

// ----- 지도 -----

const map = L.map("map", { zoomControl: true, scrollWheelZoom: false, worldCopyJump: true }).setView(REGIONS.KR.center, REGIONS.KR.zoom);
L.tileLayer(TILES.url, { maxZoom: 18, attribution: TILES.attribution }).addTo(map);
// 지도를 누르면 그때부터 휠 확대를 켠다 (페이지를 스크롤하다 지도가 확대되지 않게)
map.on("focus click", () => map.scrollWheelZoom.enable());
map.on("blur", () => map.scrollWheelZoom.disable());

const regionButtons = [...document.querySelectorAll("#region button")];
regionButtons.forEach((b) => b.addEventListener("click", () => setRegion(b.dataset.region)));

function setRegion(region) {
  state.region = region;
  regionButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.region === region)));
  const { center, zoom } = REGIONS[region];
  map.flyTo(center, zoom, { duration: 0.6 });
  renderList();
}

// ----- 데이터 -----

async function load() {
  const status = $("map-status");
  status.textContent = "불러오는 중…";
  const client = await getSupabase();
  if (!client) {
    status.textContent = "경제 지도 기능(DB)이 설정되지 않았어요.";
    return;
  }
  const { data, error } = await client
    .from("companies")
    .select("id, symbol_id, name, industry, country, description, company_locations(kind, label, address, lat, lng, precision, source_url, verified_at)")
    .order("name");
  if (error) {
    status.textContent = `기업 위치를 불러오지 못했어요. ${koreanError(error)}`;
    return;
  }
  state.companies = data
    .map((c) => ({ ...c, hq: c.company_locations.find((l) => l.kind === "hq") ?? c.company_locations[0] }))
    .filter((c) => c.hq);
  status.textContent = state.companies.length ? "" : "아직 등록된 기업 위치가 없어요.";
  status.hidden = Boolean(state.companies.length);
  buildMarkers();
  buildFilters();
  renderList();
}

function buildMarkers() {
  // 같은 건물에 있는 회사(현대차·기아 등)는 살짝 떨어뜨려 겹치지 않게
  const seen = new Map();
  for (const c of state.companies) {
    const key = `${c.hq.lat.toFixed(4)},${c.hq.lng.toFixed(4)}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const offset = n * 0.0012;
    c.nudged = n > 0; // 표시 위치만 옮겼고 실제 좌표·주소는 그대로
    const marker = L.circleMarker([c.hq.lat + offset, c.hq.lng + offset], {
      radius: 8,
      color: "#ffffff",
      weight: 2,
      dashArray: c.hq.precision === "approx" ? "3 3" : null,
      fillColor: colorOf(c.industry),
      fillOpacity: 0.95,
    })
      .addTo(map)
      .bindTooltip(c.name, { direction: "top", offset: [0, -8] })
      .bindPopup(() => popupContent(c), { maxWidth: 280, minWidth: 220 });
    marker.on("popupopen", () => selectCompany(c, false));
    state.markers.set(c.id, marker);
  }
}

function popupContent(c) {
  const symbol = parseSymbolId(c.symbol_id);
  const price = el("p", { class: "pop-price" }, "시세 불러오는 중…");
  if (c.symbol_id) {
    fetchQuotes([c.symbol_id])
      .then((r) => {
        const q = r[c.symbol_id]?.quote;
        if (!q) return price.replaceChildren("시세 없음");
        const time = r[c.symbol_id].fetchedAt ? new Date(r[c.symbol_id].fetchedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "";
        price.replaceChildren(
          el("strong", {}, formatPrice(q.price, symbol.market)),
          " ",
          el("span", { class: toneOf(q.changePercent) }, formatPercent(q.changePercent)),
          el("small", { class: "pop-price-note" }, [state.priceLabel, time && `${time} 기준`].filter(Boolean).join(" · ")),
        );
      })
      .catch(() => price.replaceChildren("시세를 불러오지 못했어요"));
  }
  const verified = new Date(c.hq.verified_at).toLocaleDateString("ko-KR");
  return el(
    "div",
    { class: "pop" },
    el("p", { class: "pop-sector", style: `color:${colorOf(c.industry)}` }, c.industry),
    el("p", { class: "pop-name" }, c.name),
    price,
    el("p", { class: "pop-addr" }, c.hq.address, c.hq.precision === "approx" && el("span", { class: "approx-tag" }, "위치 근사")),
    c.nudged && el("p", { class: "pop-desc" }, "같은 주소의 다른 회사와 겹치지 않게 표시 위치만 살짝 옮겼어요."),
    c.description && el("p", { class: "pop-desc" }, c.description),
    el(
      "p",
      { class: "pop-links" },
      c.symbol_id && el("a", { href: `/stock?id=${encodeURIComponent(c.symbol_id)}` }, "종목 보기"),
      el(
        "a",
        { href: c.hq.source_url, target: "_blank", rel: "noopener noreferrer", title: `주소 출처 · ${verified} 확인 (새 창)` },
        c.country === "KR" ? "KIND 기업개황" : "SEC EDGAR",
        icon("external", 11),
        el("span", { class: "sr-only" }, " (새 창)"),
      ),
    ),
  );
}

// ----- 필터와 목록 -----

function buildFilters() {
  const sectors = [...new Set(state.companies.map((c) => c.industry))].sort((a, b) => a.localeCompare(b, "ko"));
  const chips = [["all", "전체"], ...sectors.map((s) => [s, s])].map(([id, label]) =>
    el(
      "button",
      {
        type: "button",
        class: "chip",
        "aria-pressed": String(id === state.sector),
        dataset: { sector: id },
        onclick: () => {
          state.sector = id;
          chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.sector === id)));
          applyFilter();
        },
      },
      id !== "all" && el("span", { class: "dot", style: `background:${colorOf(id)}`, "aria-hidden": "true" }),
      label,
    ),
  );
  $("sector-filter").replaceChildren(...chips);
  $("legend").replaceChildren(
    ...sectors.map((s) => el("li", {}, el("span", { class: "dot", style: `background:${colorOf(s)}`, "aria-hidden": "true" }), s)),
    el("li", {}, el("span", { class: "dot dashed", "aria-hidden": "true" }), "점선 = 위치 근사"),
  );
}

$("company-search").addEventListener("input", (e) => {
  state.query = e.target.value.trim().toLowerCase();
  applyFilter();
});

const matches = (c) =>
  (state.sector === "all" || c.industry === state.sector) &&
  (!state.query || c.name.toLowerCase().includes(state.query) || c.industry.toLowerCase().includes(state.query));

/** 필터에 맞지 않는 표시는 지도에서 숨긴다 */
function applyFilter() {
  for (const c of state.companies) {
    const marker = state.markers.get(c.id);
    if (matches(c)) marker.addTo(map);
    else marker.remove();
  }
  renderList();
}

function renderList() {
  // 목록은 지금 보고 있는 지역(한국·미국) 기준, 전체면 모두
  const shown = state.companies.filter((c) => matches(c) && (state.region === "ALL" || c.country === state.region));
  $("list-count").textContent = `${shown.length}곳`;
  $("company-list").replaceChildren(
    ...(shown.length
      ? shown.map((c) =>
          el(
            "li",
            {},
            el(
              "button",
              {
                type: "button",
                class: "company-item",
                "aria-current": state.selected === c.id ? "true" : null,
                onclick: () => selectCompany(c, true),
              },
              el("span", { class: "dot", style: `background:${colorOf(c.industry)}`, "aria-hidden": "true" }),
              el(
                "span",
                { class: "company-text" },
                el("strong", {}, c.name),
                el("small", {}, c.industry, c.hq.precision === "approx" ? " · 위치 근사" : ""),
              ),
              icon("chevronRight", 14),
            ),
          ),
        )
      : [el("li", { class: "empty" }, state.companies.length ? "조건에 맞는 기업이 없어요." : "등록된 기업이 없어요.")]),
  );
}

function selectCompany(c, fly) {
  state.selected = c.id;
  if (fly) {
    const marker = state.markers.get(c.id);
    // 다른 나라 회사를 고르면 지역 버튼도 맞춘다
    if (state.region !== "ALL" && state.region !== c.country) {
      state.region = c.country;
      regionButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.region === c.country)));
    }
    map.flyTo(marker.getLatLng(), 13, { duration: 0.8 });
    map.once("moveend", () => marker.openPopup());
  }
  renderList();
}

load();
