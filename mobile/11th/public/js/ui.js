// 화면(DOM)을 바꾸는 함수 모음. 데이터 처리는 하지 않고 "보여주기"만 담당한다.

// ---------- 공통 도우미 ----------

// id로 요소를 찾는 짧은 도우미 함수
function byId(id) {
  return document.getElementById(id);
}

// 요소를 만들고 클래스와 글자를 넣어주는 도우미 (textContent 사용으로 안전)
function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;       // 클래스가 있으면 지정
  if (text !== undefined) element.textContent = text;  // 글자가 있으면 지정
  return element;
}

// 요소 안을 모두 비우는 도우미
function clearElement(element) {
  element.innerHTML = "";
}

// 값이 없을 때 "-"를 보여주는 도우미
function orDash(value, suffix = "") {
  return value === null || value === undefined ? "-" : `${value}${suffix}`;
}

// 숫자를 반올림해 "n°" 형태 문자열로 바꾸는 함수
function formatTemperature(value) {
  return value === null || value === undefined ? "-" : `${Math.round(value)}°`;
}

// ---------- 안내 메시지 ----------

// 안내 메시지를 보여주는 함수 (isError가 true면 빨간 스타일)
function showMessage(text, isError = false) {
  const box = byId("message");
  box.textContent = text;
  box.classList.toggle("error", isError);
  box.hidden = false;
}

// 안내 메시지를 숨기는 함수
function hideMessage() {
  byId("message").hidden = true;
}

// ---------- 대표 카드 ----------

// "2026-11-16T14:00" → "2026년 11월 16일 (월) 14:00 기준" 으로 바꾸는 함수
function formatObservedTime(timeText) {
  const [datePart, timePart] = timeText.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일 (${findWeekdayName(datePart)}) ${timePart} 기준`;
}

// 대표 카드(현재 날씨)를 채우는 함수
function renderHero(place, weather) {
  const current = weather.current;
  const today = weather.daily[0];
  const desc = findWeatherDescription(current.weatherCode);

  byId("observed-at").textContent = formatObservedTime(weather.observedAt);
  byId("place-name").textContent = place.name;
  byId("place-sub").textContent = place.description || "";
  byId("weather-icon").textContent = desc.icon;
  byId("temperature").textContent = formatTemperature(current.temperature);
  byId("weather-text").textContent = `${desc.text} · 체감 ${formatTemperature(current.feelsLike)}`;
  byId("today-range").textContent =
    `오늘 최고 ${formatTemperature(today.tempMax)} / 최저 ${formatTemperature(today.tempMin)}`;

  // 날씨에 맞는 배경 테마 적용 (기존 theme-* 클래스는 제거 후 새로 추가)
  const hero = byId("hero");
  hero.className = `hero panel-hero ${findWeatherTheme(current.weatherCode, current.isDay)}`;
}

// 생활 조언 목록을 표시하는 함수
function renderAdvice(adviceTexts) {
  const list = byId("advice-list");
  clearElement(list);
  adviceTexts.forEach((text) => list.appendChild(createElement("li", "", text)));
}

// ---------- 세부 날씨 타일 ----------

// 풍향 각도(0~360)를 "북동" 같은 방위 이름으로 바꾸는 함수
function findWindDirectionName(degrees) {
  const names = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
  return names[Math.round(degrees / 45) % 8];
}

// 자외선 지수를 단계 이름으로 바꾸는 함수
function findUvLevel(uv) {
  if (uv < 3) return "낮음";
  if (uv < 6) return "보통";
  if (uv < 8) return "높음";
  if (uv < 11) return "매우 높음";
  return "위험";
}

// 가시거리(km)를 단계 이름으로 바꾸는 함수
function findVisibilityLevel(km) {
  if (km >= 10) return "매우 좋음";
  if (km >= 4) return "좋음";
  if (km >= 1) return "보통";
  return "나쁨";
}

// 타일에 들어갈 항목 목록을 만드는 함수. 항목을 추가/삭제하려면 이 목록만 고치면 된다.
function buildHighlightTiles(weather) {
  const c = weather.current;
  return [
    { label: "🌡️ 체감 온도", value: formatTemperature(c.feelsLike), note: `실제 ${formatTemperature(c.temperature)}` },
    { label: "☔ 강수확률", value: orDash(c.rainChance, "%"), note: "현재 시간대 기준" },
    { label: "💧 강수량", value: `${c.rainAmount} mm`, note: "지금 내리는 양" },
    { label: "💨 바람", value: `${c.windSpeed} m/s`, note: `${findWindDirectionName(c.windDirection)}풍 · 돌풍 ${c.windGust} m/s` },
    { label: "💦 습도", value: `${c.humidity}%`, note: c.humidity >= 70 ? "습한 편" : c.humidity <= 30 ? "건조한 편" : "쾌적한 편" },
    { label: "🕶️ 자외선", value: orDash(c.uvIndex === null ? null : Math.round(c.uvIndex * 10) / 10), note: c.uvIndex === null ? "" : findUvLevel(c.uvIndex) },
    { label: "☁️ 구름량", value: `${c.cloudCover}%`, note: c.cloudCover < 25 ? "맑은 하늘" : c.cloudCover < 75 ? "구름 많음" : "흐린 하늘" },
    { label: "👁️ 가시거리", value: `${Math.round(c.visibilityKm * 10) / 10} km`, note: findVisibilityLevel(c.visibilityKm) },
    { label: "🧭 기압", value: `${Math.round(c.pressure)} hPa`, note: c.pressure >= 1013 ? "평균 이상" : "평균 이하" }
  ];
}

// 세부 날씨 타일을 화면에 그리는 함수
function renderHighlights(weather) {
  const grid = byId("highlight-grid");
  clearElement(grid);
  buildHighlightTiles(weather).forEach((tile) => {
    const box = createElement("div", "tile");
    box.appendChild(createElement("div", "tile-label", tile.label));
    box.appendChild(createElement("div", "tile-value", tile.value));
    box.appendChild(createElement("div", "tile-note", tile.note));
    grid.appendChild(box);
  });
}

// ---------- 기온/강수 그래프 (SVG) ----------

// SVG 요소를 만드는 도우미
function createSvgElement(tagName, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

// 시간대별 기온 선 + 강수확률 막대 그래프를 그리는 함수
function renderTemperatureChart(hourlyList) {
  const box = byId("chart-box");
  clearElement(box);

  // 그래프 크기와 여백
  const width = 960, height = 240;
  const padLeft = 30, padRight = 30, padTop = 30, padBottom = 40;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  // 기온 최소/최대로 세로 범위를 정한다
  const temps = hourlyList.map((h) => h.temperature);
  const minTemp = Math.min(...temps) - 1;
  const maxTemp = Math.max(...temps) + 1;

  // 시간 순번 → 가로 위치 / 기온 → 세로 위치 변환 함수
  const stepWidth = plotWidth / (hourlyList.length - 1);
  const xOf = (i) => padLeft + i * stepWidth;
  const yOf = (t) => padTop + plotHeight * (1 - (t - minTemp) / (maxTemp - minTemp || 1));

  const svg = createSvgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "시간대별 기온 그래프" });

  // 1) 강수확률 막대 (아래쪽에 반투명 파란색)
  hourlyList.forEach((hour, i) => {
    const barHeight = ((hour.rainChance ?? 0) / 100) * plotHeight * 0.6;
    svg.appendChild(createSvgElement("rect", {
      x: xOf(i) - 8, y: padTop + plotHeight - barHeight, width: 16, height: barHeight,
      rx: 3, fill: "#2a7de1", opacity: 0.35
    }));
  });

  // 2) 기온 선
  const points = hourlyList.map((h, i) => `${xOf(i)},${yOf(h.temperature)}`).join(" ");
  svg.appendChild(createSvgElement("polyline", {
    points: points, fill: "none", stroke: "#e8743b", "stroke-width": 3,
    "stroke-linejoin": "round", "stroke-linecap": "round"
  }));

  // 3) 점, 기온 숫자(3시간마다), 시간 라벨(3시간마다)
  hourlyList.forEach((hour, i) => {
    svg.appendChild(createSvgElement("circle", { cx: xOf(i), cy: yOf(hour.temperature), r: 3.5, fill: "#e8743b" }));
    if (i % 3 === 0) {
      const tempLabel = createSvgElement("text", { x: xOf(i), y: yOf(hour.temperature) - 10, "text-anchor": "middle", class: "chart-temp-text" });
      tempLabel.textContent = formatTemperature(hour.temperature);
      svg.appendChild(tempLabel);

      const timeLabel = createSvgElement("text", { x: xOf(i), y: height - 14, "text-anchor": "middle", class: "chart-text" });
      timeLabel.textContent = `${hour.hour}시`;
      svg.appendChild(timeLabel);
    }
  });

  box.appendChild(svg);
}

// ---------- 시간대별 예보 ----------

// 시간대별 예보 목록을 채우는 함수
function renderHourlyForecast(hourlyList) {
  const list = byId("hourly-list");
  clearElement(list);
  hourlyList.forEach((hour, i) => {
    const desc = findWeatherDescription(hour.weatherCode);
    const item = createElement("li");
    item.appendChild(createElement("div", "h-time", i === 0 ? "지금" : `${hour.hour}시`));
    item.appendChild(createElement("div", "h-icon", desc.icon));
    item.appendChild(createElement("div", "h-temp", formatTemperature(hour.temperature)));
    item.appendChild(createElement("div", "h-rain", `💧${orDash(hour.rainChance, "%")}`));
    item.appendChild(createElement("div", "h-wind", `${hour.windSpeed} m/s`));
    list.appendChild(item);
  });
}

// ---------- 7일 예보 ----------

// 7일 예보 목록을 채우는 함수
function renderDailyForecast(dailyList) {
  const list = byId("daily-list");
  clearElement(list);

  // 전체 기간의 최저/최고 기온 (기온 막대의 기준 범위)
  const weekMin = Math.min(...dailyList.map((d) => d.tempMin));
  const weekMax = Math.max(...dailyList.map((d) => d.tempMax));
  const span = weekMax - weekMin || 1;

  dailyList.forEach((day, i) => {
    const desc = findWeatherDescription(day.weatherCode);
    const item = createElement("li");
    item.appendChild(createElement("span", "d-day", i === 0 ? "오늘" : `${day.weekday}요일`));
    item.appendChild(createElement("span", "d-icon", desc.icon));
    item.appendChild(createElement("span", "d-text", desc.text));
    item.appendChild(createElement("span", "d-rain", `💧${orDash(day.rainChanceMax, "%")}`));

    // 최저 ~ 최고 기온 막대
    const range = createElement("span", "d-range");
    range.appendChild(createElement("span", "", formatTemperature(day.tempMin)));
    const bar = createElement("span", "range-bar");
    const fill = createElement("span", "range-fill");
    fill.style.left = `${((day.tempMin - weekMin) / span) * 100}%`;
    fill.style.right = `${((weekMax - day.tempMax) / span) * 100}%`;
    bar.appendChild(fill);
    range.appendChild(bar);
    range.appendChild(createElement("span", "", formatTemperature(day.tempMax)));
    item.appendChild(range);

    list.appendChild(item);
  });
}

// ---------- 대기질 ----------

// 미국 AQI 값을 단계 이름으로 바꾸는 함수
function findAirQualityLevel(aqi) {
  if (aqi <= 50) return "좋음";
  if (aqi <= 100) return "보통";
  if (aqi <= 150) return "민감군 나쁨";
  if (aqi <= 200) return "나쁨";
  if (aqi <= 300) return "매우 나쁨";
  return "위험";
}

// 대기질 패널을 채우는 함수 (air가 null이면 안내 문구)
function renderAirQuality(air) {
  const box = byId("air-box");
  clearElement(box);
  if (!air || air.aqi === null || air.aqi === undefined) {
    box.appendChild(createElement("p", "tile-note", APP_CONFIG.messages.airUnavailable));
    return;
  }
  // 대표 지수와 단계
  const main = createElement("div", "air-main");
  main.appendChild(createElement("span", "air-value", String(air.aqi)));
  main.appendChild(createElement("span", "air-label", findAirQualityLevel(air.aqi)));
  box.appendChild(main);

  // 단계 막대와 현재 위치 표시 (500을 최대로 보고, 300 이상은 끝에 표시)
  const bar = createElement("div", "air-bar");
  const marker = createElement("span", "air-marker");
  marker.style.left = `calc(${Math.min(air.aqi, 300) / 300 * 100}% - 2px)`;
  bar.appendChild(marker);
  box.appendChild(bar);

  // 세부 오염물질 수치
  const items = createElement("div", "air-items");
  [
    { label: "초미세먼지 PM2.5", value: `${air.pm25} ㎍/㎥` },
    { label: "미세먼지 PM10", value: `${air.pm10} ㎍/㎥` },
    { label: "오존 O₃", value: `${air.ozone} ㎍/㎥` },
    { label: "이산화질소 NO₂", value: `${air.nitrogenDioxide} ㎍/㎥` }
  ].forEach((entry) => {
    const tile = createElement("div", "tile");
    tile.appendChild(createElement("div", "tile-label", entry.label));
    tile.appendChild(createElement("div", "tile-value", entry.value));
    items.appendChild(tile);
  });
  box.appendChild(items);
}

// ---------- 일출 일몰 ----------

// "HH:MM" 두 개 사이의 낮 길이를 "n시간 m분" 으로 계산하는 함수
function formatDaylength(sunrise, sunset) {
  const toMinutes = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));
  const diff = toMinutes(sunset) - toMinutes(sunrise);
  return `낮 길이 ${Math.floor(diff / 60)}시간 ${diff % 60}분`;
}

// 일출/일몰 패널을 채우는 함수
function renderSunTimes(today) {
  const box = byId("sun-box");
  clearElement(box);
  const row = createElement("div", "sun-row");
  [
    { label: "🌅 일출", time: today.sunrise },
    { label: "🌇 일몰", time: today.sunset }
  ].forEach((entry) => {
    const cell = createElement("div");
    cell.appendChild(createElement("div", "sun-time", entry.time));
    cell.appendChild(createElement("div", "sun-label", entry.label));
    row.appendChild(cell);
  });
  box.appendChild(row);
  box.appendChild(createElement("p", "sun-length", formatDaylength(today.sunrise, today.sunset)));
}

// ---------- 출처 / 대시보드 표시 ----------

// 데이터 출처 문구를 표시하는 함수
function renderSource(sourceName) {
  byId("source").textContent = `날씨 데이터 출처: ${sourceName} · 대기질은 미국 AQI 기준`;
}

// 대시보드 전체를 보이게 하는 함수
function showDashboard() {
  byId("dashboard").hidden = false;
}

// ---------- 검색 / 최근 검색 ----------

// 검색 결과 후보 목록을 보여주는 함수 (항목 클릭 시 onSelect 호출)
function renderSearchResults(places, onSelect) {
  const list = byId("search-results");
  clearElement(list);
  places.forEach((place) => {
    const item = createElement("li", "", place.name + " ");
    item.appendChild(createElement("small", "", place.description)); // 지역 설명(동명 지역 구분용)
    item.addEventListener("click", () => onSelect(place));
    list.appendChild(item);
  });
  list.hidden = places.length === 0;
}

// 검색 결과 목록을 숨기는 함수
function hideSearchResults() {
  byId("search-results").hidden = true;
}

// 최근 검색 장소 칩을 그리는 함수
function renderRecentPlaces(places, onSelect) {
  const list = byId("recent-list");
  clearElement(list);
  places.forEach((place) => {
    const chip = createElement("button", "chip", place.name);
    chip.type = "button";
    chip.addEventListener("click", () => onSelect(place));
    list.appendChild(chip);
  });
  byId("recent-box").hidden = places.length === 0;
}
