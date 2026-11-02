/* =====================================================
 * 로또 번호 생성기
 * - 1~45 중 중복 없는 6개 번호를 뽑아 공으로 하나씩 보여준다.
 * - 오름차순 정렬, 초기화, 생성 횟수, 내 번호와 비교 기능 포함.
 * ===================================================== */

/* ---------- 1. 상수 ---------- */

const MIN_NUMBER = 1;      // 뽑을 수 있는 가장 작은 번호
const MAX_NUMBER = 45;     // 뽑을 수 있는 가장 큰 번호
const PICK_COUNT = 6;      // 한 번에 뽑는 번호 개수
const BALL_DELAY_MS = 650; // 공이 하나씩 나타나는 간격(밀리초)

/* ---------- 2. 상태 변수 ---------- */

let drawCount = 0;         // 지금까지 번호를 뽑은 횟수
let currentNumbers = [];   // 가장 최근에 뽑힌 번호들 (오름차순)
let userPicks = new Set(); // 사용자가 직접 고른 번호들 (중복 불가라 Set 사용)
let isDrawing = false;     // 공이 나오는 중인지 여부 (중복 클릭 방지용)

/* ---------- 3. HTML 요소 ---------- */

const ballsEl = document.querySelector("#balls");        // 공이 들어가는 영역
const countEl = document.querySelector("#count");        // 생성 횟수 숫자
const compareEl = document.querySelector("#compare");    // 내 번호와 비교한 결과 문구
const drawBtn = document.querySelector("#draw-btn");     // 번호 뽑기 버튼
const resetBtn = document.querySelector("#reset-btn");   // 초기화 버튼
const pickerEl = document.querySelector("#picker");      // 1~45 번호판
const pickedInfoEl = document.querySelector("#picked-info"); // "n / 6" 표시

const statsEl = document.querySelector("#stats");           // 번호별 출현 횟수 막대 목록
const statsTopEl = document.querySelector("#stats-top");     // 가장 많이/적게 나온 번호 요약
const statsInfoEl = document.querySelector("#stats-info");   // 집계 회차 범위 표시
const tabEls = document.querySelectorAll(".tab");            // 정렬 방식 탭 버튼
const rangeChartEl = document.querySelector("#range-chart"); // 구간별 가로 막대 그래프 영역
const mascotEl = document.querySelector("#dororong");    // 마스코트 도로롱 (SVG)
const speechEl = document.querySelector("#speech");      // 도로롱의 말풍선
const sparklesEl = document.querySelector("#sparkles");  // 배경 반짝이 장식이 들어가는 영역

/* ---------- 3-1. 마스코트 도로롱 / 배경 장식 ---------- */

/**
 * 도로롱의 기분(표정+움직임)과 말풍선 문구를 바꾼다.
 * CSS가 data-mood 값을 보고 표정과 애니메이션을 고른다.
 * @param {"sleep"|"awake"|"happy"} mood 자는 중 / 깨어남 / 기쁨
 * @param {string} text 말풍선에 보여줄 문구
 */
function setMood(mood, text) {
  mascotEl.dataset.mood = mood;
  speechEl.textContent = text;
}

/**
 * 배경에 둥둥 떠다니며 반짝이는 별·하트·꽃 장식을 무작위 위치에 만든다.
 * 크기, 색, 반짝이는 속도, 시작 시점을 CSS 변수로 하나씩 다르게 준다.
 */
function createSparkles() {
  const shapes = ["✦", "★", "♡", "✿", "✧"];                          // 장식 모양들
  const colors = ["#fff", "#fff6b8", "#ffb3d4", "#b9a8ff", "#a8e6ff"]; // 파스텔 색들
  for (let i = 0; i < 22; i++) {
    const s = document.createElement("span");
    s.className = "sparkle";
    s.textContent = shapes[i % shapes.length];
    s.style.left = `${Math.random() * 100}%`;
    s.style.top = `${Math.random() * 85}%`;
    s.style.setProperty("--s", `${12 + Math.random() * 18}px`);
    s.style.setProperty("--c", colors[Math.floor(Math.random() * colors.length)]);
    s.style.setProperty("--d", `${2 + Math.random() * 3}s`);
    s.style.animationDelay = `${-Math.random() * 4}s`;
    sparklesEl.append(s);
  }
}

/* ---------- 4. 번호 생성 ---------- */

/**
 * 1~45 중 중복 없는 6개 번호를 뽑아 오름차순으로 반환한다.
 * 1~45 배열을 만들어 피셔-예이츠 방식으로 섞은 뒤 앞의 6개를 사용하므로
 * 같은 번호가 두 번 나올 수 없다.
 * @returns {number[]} 오름차순으로 정렬된 6개의 번호
 */
function pickNumbers() {
  // 1부터 45까지 들어 있는 배열 만들기
  const pool = Array.from({ length: MAX_NUMBER - MIN_NUMBER + 1 }, (_, i) => i + MIN_NUMBER);

  // 뒤에서부터 무작위 위치와 자리를 바꾸며 섞는다 (피셔-예이츠 셔플)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // 0 ~ i 사이 무작위 위치
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // 앞에서 6개만 가져와 작은 수부터 큰 수 순서로 정렬
  return pool.slice(0, PICK_COUNT).sort((a, b) => a - b);
}

/**
 * 번호의 범위에 맞는 공 색상 클래스 이름을 반환한다.
 * @param {number} n 공에 적힌 번호
 * @returns {string} CSS 클래스 이름 (c1 ~ c5)
 */
function colorClass(n) {
  if (n <= 10) return "c1"; // 노랑
  if (n <= 20) return "c2"; // 파랑
  if (n <= 30) return "c3"; // 빨강
  if (n <= 40) return "c4"; // 회색
  return "c5";              // 초록
}

/* ---------- 5. 화면 그리기 ---------- */

/**
 * 지정한 시간(밀리초)만큼 기다리는 Promise를 만든다.
 * 공을 하나씩 천천히 보여주기 위해 사용한다.
 * @param {number} ms 기다릴 시간
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 번호가 적힌 공 요소 하나를 만들어 반환한다.
 * @param {number} n 공에 적을 번호
 * @returns {HTMLElement} 공 모양의 div 요소
 */
function createBall(n) {
  const ball = document.createElement("div");
  ball.className = `ball ${colorClass(n)}`; // 번호 구간에 맞는 색
  ball.textContent = n;
  ball.dataset.number = n;                  // 나중에 일치 여부를 표시할 때 사용
  return ball;
}

/**
 * 번호 뽑기 버튼을 눌렀을 때 실행된다.
 * 이전 결과를 지우고, 새 번호를 뽑아 공을 하나씩 애니메이션과 함께 보여준다.
 */
async function drawLotto() {
  if (isDrawing) return; // 이미 뽑는 중이면 무시
  isDrawing = true;
  drawBtn.disabled = true;
  resetBtn.disabled = true;

  // 이전 결과 정리
  ballsEl.replaceChildren();
  compareEl.textContent = "";

  currentNumbers = pickNumbers();
  setMood("awake", "으음? 번호가 나온다!"); // 도로롱이 잠에서 깨어난다

  // 오름차순으로 정렬된 번호를 순서대로 하나씩 화면에 추가
  for (const n of currentNumbers) {
    ballsEl.append(createBall(n));
    await sleep(BALL_DELAY_MS);
  }

  // 모든 공이 나온 뒤 횟수 증가 및 결과 확인
  drawCount++;
  countEl.textContent = drawCount;
  updateCompare();

  isDrawing = false;
  drawBtn.disabled = false;
  resetBtn.disabled = false;
}

/* ---------- 6. 초기화 ---------- */

/**
 * 초기화 버튼: 공, 결과 문구, 생성 횟수, 내가 고른 번호를 모두 처음 상태로 되돌린다.
 */
function resetAll() {
  if (isDrawing) return;

  drawCount = 0;
  currentNumbers = [];
  userPicks.clear();

  ballsEl.replaceChildren();   // 공 모두 제거 (영역이 비어 안내 문구가 다시 보임)
  countEl.textContent = 0;
  compareEl.textContent = "";
  refreshPicker();
  setMood("sleep", "쿨쿨... 번호를 뽑아줘~"); // 도로롱이 다시 잠든다
}

/* ---------- 7. 내 번호 고르기 / 비교 ---------- */

/**
 * 1~45 번호판 버튼을 만든다. 페이지가 열릴 때 한 번만 호출한다.
 */
function buildPicker() {
  for (let n = MIN_NUMBER; n <= MAX_NUMBER; n++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = n;
    btn.dataset.number = n;
    pickerEl.append(btn);
  }
}

/**
 * 번호판 버튼을 눌렀을 때 내 번호를 선택/해제한다.
 * 이미 6개를 골랐다면 더 고를 수 없다.
 * @param {number} n 누른 번호
 */
function togglePick(n) {
  if (userPicks.has(n)) {
    userPicks.delete(n);               // 이미 골랐다면 해제
  } else if (userPicks.size < PICK_COUNT) {
    userPicks.add(n);                  // 아직 6개 미만이면 추가
  }
  refreshPicker();
  updateCompare();
}

/**
 * 번호판의 색(선택됨/당첨됨)과 "n / 6" 표시를 현재 상태에 맞게 갱신한다.
 */
function refreshPicker() {
  for (const btn of pickerEl.children) {
    const n = Number(btn.dataset.number);
    btn.classList.toggle("selected", userPicks.has(n));
    // 내가 고른 번호가 이번에 뽑힌 번호이기도 하면 "hit" 색상
    btn.classList.toggle("hit", userPicks.has(n) && currentNumbers.includes(n));
  }
  pickedInfoEl.textContent = `${userPicks.size} / ${PICK_COUNT}`;
  markStats(); // 통계 목록의 하이라이트도 함께 갱신
}

/**
 * 뽑힌 번호와 내가 고른 번호를 비교해서 일치하는 공을 반짝이게 하고 결과 문구를 보여준다.
 * 아직 번호를 뽑지 않았거나, 내 번호를 하나도 안 골랐다면 문구를 비운다.
 */
function updateCompare() {
  // 일치 표시를 먼저 모두 지운 뒤 다시 계산
  for (const ball of ballsEl.children) ball.classList.remove("match");

  if (!currentNumbers.length || ballsEl.children.length < PICK_COUNT) {
    compareEl.textContent = "";
    refreshPicker();
    return;
  }
  if (!userPicks.size) {
    compareEl.textContent = "아래에서 내 번호를 골라 비교해 보세요!";
    setMood("awake", "도로롱~ 내 번호도 골라봐!");
    refreshPicker();
    return;
  }

  // 겹치는 번호만 추려낸다
  const matched = currentNumbers.filter((n) => userPicks.has(n));
  for (const ball of ballsEl.children) {
    if (matched.includes(Number(ball.dataset.number))) ball.classList.add("match");
  }

  compareEl.textContent = matched.length
    ? `🎉 ${matched.length}개 일치! (${matched.join(", ")})`
    : "아쉽게도 일치하는 번호가 없어요.";
  // 하나라도 맞으면 도로롱이 신나서 뛰고, 아니면 아쉬워한다
  if (matched.length) setMood("happy", `와아! ${matched.length}개나 맞았다!!`);
  else setMood("awake", "아쉽다... 한 번 더?");
  refreshPicker();
}

/* ---------- 7-1. 역대 당첨번호 출현 횟수 ---------- */

let statsSort = "number"; // 통계 정렬 방식: "number"(번호순) 또는 "count"(많이 나온 순)

/**
 * lotto-data.js 의 집계 데이터로 1~45번 출현 횟수 막대 목록을 그린다.
 * 가장 많이 나온 번호의 막대를 100% 길이로 두고 나머지는 비율로 표시한다.
 */
function renderStats() {
  const { totalDraws, lastDraw, lastDate, counts } = LOTTO_STATS;
  // [번호, 횟수] 쌍 목록으로 바꾼다
  let rows = Object.entries(counts).map(([n, c]) => [Number(n), c]);
  const max = Math.max(...rows.map((r) => r[1]));

  // 요약: 가장 많이/적게 나온 번호 (동점이면 작은 번호 우선)
  const byCount = [...rows].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const top = byCount[0], low = byCount[byCount.length - 1];
  statsInfoEl.textContent = `1~${lastDraw}회 (${totalDraws}회차, ${lastDate} 기준)`;
  statsTopEl.textContent = `🔥 가장 많이 나온 번호 ${top[0]}번 (${top[1]}회) · ❄️ 가장 적게 나온 번호 ${low[0]}번 (${low[1]}회)`;

  if (statsSort === "count") rows = byCount; // 많이 나온 순

  statsEl.replaceChildren(
    ...rows.map(([n, c]) => {
      const row = document.createElement("div");
      row.className = "stat-row";
      row.dataset.number = n;
      row.innerHTML =
        `<span class="mini ${colorClass(n)}">${n}</span>` +
        `<div class="bar-wrap"><div class="bar" style="width:${(c / max) * 100}%"></div></div>` +
        `<span class="stat-count">${c}</span>`;
      return row;
    }),
  );
  markStats();
}

/**
 * 번호를 1~10, 11~20, 21~30, 31~40, 41~45 구간으로 묶어
 * 구간별 출현 횟수 합계를 가로 막대 그래프로 그린다.
 * 막대 길이는 합계가 가장 큰 구간을 100%로 둔 비율이다.
 */
function renderRangeChart() {
  const { counts } = LOTTO_STATS;
  // [시작 번호, 끝 번호] 구간 목록 (색은 공 색상 클래스와 같은 규칙)
  const ranges = [[1, 10], [11, 20], [21, 30], [31, 40], [41, 45]];

  // 구간마다 속한 번호들의 출현 횟수를 모두 더한다
  const sums = ranges.map(([from, to]) => {
    let sum = 0;
    for (let n = from; n <= to; n++) sum += counts[n];
    return { from, to, sum };
  });
  const total = sums.reduce((acc, r) => acc + r.sum, 0); // 전체 합 (백분율 계산용)
  const max = Math.max(...sums.map((r) => r.sum));

  rangeChartEl.replaceChildren(
    ...sums.map((r) => {
      const row = document.createElement("div");
      row.className = "range-row";
      row.innerHTML =
        `<span class="range-label">${r.from}~${r.to}</span>` +
        `<div class="range-track"><div class="range-bar ${colorClass(r.from)}" data-w="${(r.sum / max) * 100}"></div></div>` +
        `<span class="range-value">${r.sum}회<small>${((r.sum / total) * 100).toFixed(1)}%</small></span>`;
      return row;
    }),
  );

  // 다음 프레임에 길이를 적용해야 0%에서 늘어나는 애니메이션이 보인다
  requestAnimationFrame(() => {
    for (const bar of rangeChartEl.querySelectorAll(".range-bar")) bar.style.width = `${bar.dataset.w}%`;
  });
}

/**
 * 방금 뽑힌 번호에 해당하는 통계 줄을 하이라이트한다.
 */
function markStats() {
  // 공이 6개 모두 나온 뒤에만 표시한다 (뽑는 도중에 미리 알려주지 않기 위해)
  const done = ballsEl.children.length === PICK_COUNT;
  for (const row of statsEl.children) {
    row.classList.toggle("now", done && currentNumbers.includes(Number(row.dataset.number)));
  }
}

/* ---------- 8. 이벤트 연결과 시작 ---------- */

drawBtn.addEventListener("click", drawLotto);
resetBtn.addEventListener("click", resetAll);

// 번호판은 버튼이 45개라서 부모에 이벤트를 한 번만 달아 처리 (이벤트 위임)
pickerEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (btn) togglePick(Number(btn.dataset.number));
});

// 정렬 탭: 누른 방식으로 통계를 다시 그린다
tabEls.forEach((tab) => {
  tab.addEventListener("click", () => {
    statsSort = tab.dataset.sort;
    tabEls.forEach((t) => t.classList.toggle("on", t === tab));
    renderStats();
  });
});

buildPicker();
renderRangeChart();
renderStats();
refreshPicker();
createSparkles();
