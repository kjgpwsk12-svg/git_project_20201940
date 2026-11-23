// 여러 화면에서 함께 쓰는 작은 도구 함수 모음

// ---------- 화면 요소 만들기 ----------

// HTML 요소를 쉽게 만드는 함수.
// 사용 예: createElement("div", { class: "box", text: "안녕" }, 자식1, 자식2)
function createElement(tagName, options = {}, ...children) {
  const node = document.createElement(tagName);                 // 요소 생성
  if (options.class) node.className = options.class;            // 클래스 지정
  if (options.text !== undefined) node.textContent = options.text; // 글자 지정 (안전하게 textContent 사용)
  if (options.attrs) {                                          // 속성 지정 (href, type 등)
    Object.entries(options.attrs).forEach(([name, value]) => {
      if (value !== undefined && value !== null) node.setAttribute(name, value);
    });
  }
  if (options.style) {                                          // 인라인 스타일 지정 (CSS 변수 포함)
    Object.entries(options.style).forEach(([name, value]) => node.style.setProperty(name, value));
  }
  if (options.on) {                                             // 이벤트 연결 (click 등)
    Object.entries(options.on).forEach(([name, handler]) => node.addEventListener(name, handler));
  }
  children.flat().forEach((child) => {                          // 자식 요소/글자 붙이기
    if (child === null || child === undefined || child === false) return;
    node.appendChild(typeof child === "object" ? child : document.createTextNode(String(child)));
  });
  return node;
}

// 요소 안을 모두 비우는 함수
function clearElement(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

// 잠깐 나타났다 사라지는 알림 메시지를 보여주는 함수
let toastTimerId = null;
function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimerId);                                   // 이전 타이머 취소
  toastTimerId = setTimeout(() => { toast.hidden = true; }, 2600);
}

// ---------- 날짜 ----------

// Date 객체를 "YYYY-MM-DD" 문자열로 바꾸는 함수 (브라우저 현지 날짜 기준)
function toDateText(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// "YYYY-MM-DD" 문자열을 Date 객체로 바꾸는 함수 (시차 문제 없이 현지 자정으로 생성)
function parseDateText(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// 오늘 날짜의 자정 Date 를 돌려주는 함수
function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// 두 날짜 사이의 일수 차이 (b - a)
function diffInDays(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// "2026-11-05" → "2026.11.05" 로 보기 좋게 바꾸는 함수
function formatDate(dateText) {
  return dateText ? dateText.replaceAll("-", ".") : "-";
}

// 개봉일 기준 "개봉 D+12" / "D-5 개봉" 문구를 만드는 함수
function formatReleaseLabel(movie) {
  const days = diffInDays(getToday(), parseDateText(movie.releaseDate));
  if (days > 0) return `D-${days} 개봉`;
  if (days === 0) return "오늘 개봉";
  return `개봉 ${-days}일째`;
}

// 확인일이 며칠 전인지 계산하는 함수 (날짜가 없으면 매우 오래된 것으로 처리)
function daysSince(dateText) {
  return dateText ? diffInDays(parseDateText(dateText), getToday()) : 9999;
}

// ---------- 평점 계산 ----------

// 평점 숫자를 "8.4" 형태로 보여주는 함수
function formatScore(score) {
  return Number(score).toFixed(1);
}

// 영화의 대표 평점(출처별 평점의 평균)을 계산하는 함수. 평점이 없으면 null
function calcAverageScore(movie) {
  const scores = (movie.ratings || []).map((rating) => Number(rating.score)).filter((score) => !isNaN(score));
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

// 점수에 따라 색상 단계(good / mid / low)를 정하는 함수
function findScoreLevel(score) {
  if (score >= 8) return "good";
  if (score >= 6) return "mid";
  return "low";
}

// ---------- 안전 ----------

// http/https 주소만 허용하는 함수 (javascript: 같은 위험한 주소 차단)
function isSafeHttpUrl(text) {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

// 새 영화 id 를 만드는 함수
function createMovieId() {
  return "m-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 쉼표로 구분된 글자를 배열로 바꾸는 함수 ("액션, 스릴러" → ["액션","스릴러"])
function splitByComma(text) {
  return String(text || "").split(",").map((item) => item.trim()).filter(Boolean);
}

// ---------- 박스오피스용 표시 도구 ----------

// 제목 같은 글자로 항상 같은 포스터 색상 두 개를 만드는 함수 (실제 포스터가 없을 때 사용)
function makePosterColors(seedText) {
  let hash = 0;
  for (const char of String(seedText)) hash = (hash * 31 + char.charCodeAt(0)) % 360000;   // 간단한 해시
  const hue = hash % 360;
  return [`hsl(${hue}, 55%, 24%)`, `hsl(${(hue + 45) % 360}, 70%, 46%)`];
}

// 관객수를 "4.6만" / "294.9만" / "1.2억" 처럼 짧게 보여주는 함수
function formatCount(value) {
  const number = Number(value) || 0;
  if (number >= 100000000) return `${(number / 100000000).toFixed(1)}억`;
  if (number >= 10000) return `${(number / 10000).toFixed(1)}만`;
  return number.toLocaleString("ko-KR");
}

// 매출액(원)을 "4.6억원" / "3,200만원" 처럼 보여주는 함수
function formatMoney(won) {
  const number = Number(won) || 0;
  if (number >= 100000000) return `${(number / 100000000).toFixed(1)}억원`;
  if (number >= 10000) return `${Math.round(number / 10000).toLocaleString("ko-KR")}만원`;
  return `${number.toLocaleString("ko-KR")}원`;
}

// 증감 숫자 앞에 + 부호를 붙이는 함수 (0 이면 "-")
function formatSigned(value, suffix = "") {
  const number = Number(value) || 0;
  if (number === 0) return "-";
  return `${number > 0 ? "+" : ""}${number.toLocaleString("ko-KR")}${suffix}`;
}

// Date → "20261115" (KOBIS 날짜 형식)
function toKobisDate(date) {
  return toDateText(date).replaceAll("-", "");
}

// "20261115" → "2026-11-15"
function kobisDateToText(text) {
  const digits = String(text || "").replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : "";
}

// 날짜 문자열에 일수를 더한 새 날짜 문자열을 돌려주는 함수
function addDaysToText(dateText, days) {
  const date = parseDateText(dateText);
  date.setDate(date.getDate() + days);
  return toDateText(date);
}
