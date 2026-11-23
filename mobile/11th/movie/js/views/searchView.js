// 검색 화면: 영화 제목으로 KOBIS 영화 목록을 검색한다

// 검색 결과를 불러와 결과 영역에 그리는 함수
async function runMovieSearch(keyword, resultBox) {
  clearElement(resultBox);
  if (!keyword) {
    resultBox.appendChild(createEmptyState("영화 제목을 입력해 보세요", "예) 아바타, 기생충, 범죄도시"));
    return;
  }
  const loading = createElement("div", { class: "movie-grid" }, ...createSkeletonCards(8));
  resultBox.appendChild(loading);
  try {
    const list = await searchKobisMovies(keyword);
    if (!resultBox.isConnected) return;                       // 다른 화면으로 이동했으면 중단
    clearElement(resultBox);
    if (list.length === 0) {
      resultBox.appendChild(createEmptyState(`"${keyword}" 검색 결과가 없어요`, "띄어쓰기를 바꾸거나 더 짧은 제목으로 검색해 보세요."));
      return;
    }
    resultBox.appendChild(createElement("p", { class: "result-count", text: `"${keyword}" 검색 결과 ${list.length}편` }));
    const grid = createElement("div", { class: "movie-grid" }, ...list.map(createKobisListCard));
    resultBox.appendChild(grid);
    applyRevealEffects(grid);
  } catch (error) {
    if (!resultBox.isConnected) return;
    clearElement(resultBox);
    resultBox.appendChild(createEmptyState("검색에 실패했어요", describeKobisError(error)));
  }
}

// 검색 화면 전체를 그리는 함수 (라우터가 호출)
function renderSearchView(container) {
  const keyword = (getCurrentQuery().get("q") || "").trim();
  const input = createElement("input", { class: "search-input", attrs: { type: "search", placeholder: "영화 제목 검색", "aria-label": "영화 제목 검색", value: keyword } });
  const resultBox = createElement("div", { class: "search-results" });
  const form = createElement("form", { class: "home-search", on: { submit: (event) => {
    event.preventDefault();
    const next = input.value.trim();
    location.hash = next ? `#/search?q=${encodeURIComponent(next)}` : "#/search";
  } } }, createElement("span", { class: "search-icon", text: "🔍", attrs: { "aria-hidden": "true" } }), input,
    createElement("button", { class: "btn-primary", text: "검색", attrs: { type: "submit" } }));

  container.append(createElement("h1", { class: "section-title", text: "영화 검색" }), form, resultBox);
  runMovieSearch(keyword, resultBox);
  if (!keyword) input.focus({ preventScroll: true });
  return keyword ? `"${keyword}" 검색` : "영화 검색";
}
