// 비교 화면: 담아 둔 영화들을 표로 나란히 비교한다 (운영자 등록 영화 + KOBIS 영화 모두 가능)

// 비교 표의 행 정의. 항목을 추가/삭제하려면 이 목록만 고치면 된다.
// value: 영화에서 보여줄 글자를 만드는 함수, best: 값이 클수록 좋은 항목이면 숫자를 돌려주는 함수(선택)
function getCompareRows() {
  const box = (movie) => movie.boxOffice;               // 박스오피스 정보 (없으면 null)
  const rows = [
    { label: "대표 평점", value: (m) => (calcAverageScore(m) === null ? "-" : formatScore(calcAverageScore(m))), best: (m) => calcAverageScore(m) },
    // 박스오피스 수치 (KOBIS 영화에만 있음)
    { label: "박스오피스 순위", value: (m) => (box(m) ? `${box(m).rank}위` : "-"), best: (m) => (box(m) ? -box(m).rank : null) },
    { label: "관객수(조회일)", value: (m) => (box(m) ? `${formatCount(box(m).audience)}명` : "-"), best: (m) => (box(m) ? box(m).audience : null) },
    { label: "누적 관객", value: (m) => (box(m) ? `${formatCount(box(m).audienceAcc)}명` : "-"), best: (m) => (box(m) ? box(m).audienceAcc : null) },
    { label: "스크린 수", value: (m) => (box(m) ? `${box(m).screens.toLocaleString("ko-KR")}개` : "-"), best: (m) => (box(m) ? box(m).screens : null) }
  ];
  // 출처별 평점 행을 설정된 출처 수만큼 추가
  MOVIE_CONFIG.ratingSources.forEach((source) => {
    const find = (m) => (m.ratings || []).find((rating) => rating.source === source);
    rows.push({ label: source, value: (m) => (find(m) ? formatScore(find(m).score) : "-"), best: (m) => (find(m) ? Number(find(m).score) : null) });
  });
  rows.push(
    { label: "작품평 수", value: (m) => `${m.reviews.length}건`, best: (m) => m.reviews.length },
    { label: "개봉일", value: (m) => formatDate(m.releaseDate) },
    { label: "러닝타임", value: (m) => (m.runtime ? `${m.runtime}분` : "-") },
    { label: "관람등급", value: (m) => m.ageRating },
    { label: "장르", value: (m) => m.genres.join(", ") || "-" },
    { label: "감독", value: (m) => m.director || "-" },
    { label: "관련 사이트", value: (m) => `${m.links.length}곳` }
  );
  return rows;
}

// 비교 목록의 id 하나를 영화 객체로 바꾸는 함수 (KOBIS 영화는 서버에서 불러온다). 못 찾으면 null
async function resolveCompareMovie(item) {
  try {
    if (item.id.startsWith("k-")) return await getKobisMovie(item.id.slice(2));
    return getMovieById(item.id) || null;
  } catch (error) {
    return null;
  }
}

// 비교 표를 그리는 함수
function buildCompareTable(movies) {
  const table = createElement("table", { class: "compare-table" });
  const head = createElement("tr", {}, createElement("th", { text: "" }));
  movies.forEach((movie) => {
    const href = movie.kobisCd ? `#/kobis/${movie.kobisCd}` : `#/movie/${movie.id}`;
    head.appendChild(createElement("th", {},
      createElement("a", { class: "compare-poster", attrs: { href } }, createPoster(movie)),
      createElement("a", { class: "compare-name", text: movie.title, attrs: { href } }),
      createElement("button", { class: "btn-link", text: "빼기", attrs: { type: "button" },
        on: { click: () => { toggleCompare(movie.id, movie.title); rerenderCurrentRoute(); } } })
    ));
  });
  table.appendChild(createElement("thead", {}, head));

  const body = createElement("tbody");
  getCompareRows().forEach((row) => {
    // 가장 좋은 값을 찾아 강조 (비교 대상이 2편 이상이고 값이 있을 때만)
    let bestValue = null;
    if (row.best && movies.length > 1) {
      const numbers = movies.map(row.best).filter((n) => n !== null && n !== undefined);
      if (numbers.length > 1) bestValue = Math.max(...numbers);
    }
    const tr = createElement("tr", {}, createElement("th", { text: row.label, attrs: { scope: "row" } }));
    movies.forEach((movie) => {
      const isBest = bestValue !== null && row.best(movie) === bestValue;
      tr.appendChild(createElement("td", { class: isBest ? "best" : "", text: row.value(movie) }));
    });
    body.appendChild(tr);
  });
  table.appendChild(body);
  return table;
}

// 비교 화면 전체를 그리는 함수 (라우터가 호출)
function renderCompareView(container) {
  const items = getCompareItems();
  container.appendChild(createElement("h1", { class: "section-title", text: "영화 비교하기" }));

  // 담긴 영화가 없을 때
  if (items.length === 0) {
    container.appendChild(createEmptyState("비교할 영화를 담아 주세요", `박스오피스나 상세 화면에서 "+ 비교 담기"를 눌러 최대 ${MOVIE_CONFIG.compareMax}편까지 비교할 수 있어요.`));
    container.appendChild(createElement("a", { class: "btn-primary", text: "박스오피스 보러 가기", attrs: { href: "#/" } }));
    return "영화 비교하기";
  }

  // 영화 정보를 불러오는 동안 로딩 표시
  const holder = createElement("div", {}, createElement("div", { class: "skeleton skeleton-title" }), createElement("div", { class: "skeleton skeleton-line" }));
  container.appendChild(holder);
  Promise.all(items.map(resolveCompareMovie)).then((resolved) => {
    if (!holder.isConnected) return;
    const movies = resolved.filter(Boolean);
    clearElement(holder);
    if (movies.length === 0) {
      holder.appendChild(createEmptyState("영화 정보를 불러오지 못했어요", "비교 목록을 비우고 다시 담아 주세요."));
    } else {
      holder.appendChild(createElement("div", { class: "table-scroll" }, buildCompareTable(movies)));
    }
    holder.appendChild(createElement("button", { class: "btn-secondary", text: "비교 목록 비우기", attrs: { type: "button" },
      on: { click: () => { clearCompare(); rerenderCurrentRoute(); } } }));
  });
  return "영화 비교하기";
}
