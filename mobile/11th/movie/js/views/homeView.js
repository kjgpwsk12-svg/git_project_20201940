// 홈 화면: 캐러셀 → 요약 지표 → 영화 검색 → 박스오피스 → 하이라이트 → 개봉예정 → 운영자 등록 영화/작품평
// 데이터는 KOBIS 실시간 박스오피스를 사용하고, 불러오지 못하면 운영자 등록(샘플) 영화로 대신 보여준다.

// 박스오피스 조회 조건 (사용자가 바꾸면 이 값이 바뀌고 다시 조회한다)
const boxOfficeState = { period: "daily", date: "", nation: "", multi: "" };

// 운영자 등록 영화 목록 필터 조건 (검색/상태/장르/정렬)
const homeFilterState = { keyword: "", status: "all", genre: "전체", sort: "rating" };

// ---------- 운영자 등록 영화 목록 도구 (필터/정렬) ----------

// 상태 탭 목록 (맨 앞에 "전체" 추가)
function getStatusTabs() {
  return [["all", "전체"], ...Object.entries(MOVIE_CONFIG.statusLabels)];
}

// 모든 영화에서 장르 이름을 모아 중복 없이 돌려주는 함수
function collectGenres(movies) {
  return ["전체", ...new Set(movies.flatMap((movie) => movie.genres))];
}

// 조건에 맞는 영화만 골라내는 함수
function filterMovies(movies, filter) {
  const keyword = filter.keyword.trim().toLowerCase();
  return movies.filter((movie) => {
    if (filter.status !== "all" && movie.status !== filter.status) return false;
    if (filter.genre !== "전체" && !movie.genres.includes(filter.genre)) return false;
    if (!keyword) return true;
    const haystack = [movie.title, movie.originalTitle, movie.director, ...movie.cast, ...movie.genres].join(" ").toLowerCase();
    return haystack.includes(keyword);
  });
}

// 정렬 기준에 맞게 영화 목록을 정렬하는 함수 (원본은 건드리지 않는다)
function sortMovies(movies, sortKey) {
  const comparators = {
    rating: (a, b) => (calcAverageScore(b) ?? -1) - (calcAverageScore(a) ?? -1),
    release: (a, b) => b.releaseDate.localeCompare(a.releaseDate),
    reviews: (a, b) => b.reviews.length - a.reviews.length,
    title: (a, b) => a.title.localeCompare(b.title, "ko")
  };
  return [...movies].sort(comparators[sortKey] || comparators.rating);
}

// ---------- 캐러셀 / 요약 지표 데이터 만들기 ----------

// 박스오피스 항목 → 캐러셀 슬라이드 데이터
function buildHeroItemFromEntry(entry, rangeText) {
  const days = entry.openDate ? -diffInDays(getToday(), parseDateText(entry.openDate)) : null;
  return {
    eyebrow: `🏆 박스오피스 ${entry.rank}위 · ${rangeText} 기준`,
    title: entry.title,
    meta: `${formatDate(entry.openDate)} 개봉${days !== null && days >= 0 ? ` · 개봉 ${days + 1}일째` : ""}`,
    stats: [
      { label: "관객수", value: `${formatCount(entry.audience)}명` },
      { label: "누적 관객", value: `${formatCount(entry.audienceAcc)}명` },
      { label: "스크린", value: `${entry.screens.toLocaleString("ko-KR")}개` },
      { label: "매출 점유율", value: `${entry.salesShare}%` }
    ],
    rank: entry.rank,
    href: `#/kobis/${entry.movieCd}`,
    poster: entry,
    compare: { id: `k-${entry.movieCd}`, title: entry.title }
  };
}

// 운영자 등록 영화 → 캐러셀 슬라이드 데이터 (KOBIS 를 못 불러왔을 때 사용)
function buildHeroItemFromMovie(movie, index) {
  const average = calcAverageScore(movie);
  return {
    eyebrow: `추천 영화 · ${movie.genres.join(" · ")}`,
    title: movie.title,
    meta: `${formatDate(movie.releaseDate)} 개봉 · ${formatReleaseLabel(movie)}`,
    stats: [
      { label: "평균 평점", value: average === null ? "-" : `★ ${formatScore(average)}` },
      { label: "러닝타임", value: `${movie.runtime}분` },
      { label: "관람등급", value: movie.ageRating },
      { label: "작품평", value: `${movie.reviews.length}건` }
    ],
    rank: index + 1,
    href: `#/movie/${movie.id}`,
    poster: movie,
    compare: { id: movie.id, title: movie.title }
  };
}

// 요약 지표 한 칸을 만드는 함수
function createSummaryTile(icon, label, value, note) {
  return createElement("div", { class: "summary-tile" },
    createElement("span", { class: "summary-icon", text: icon }),
    createElement("div", {},
      createElement("span", { class: "summary-label", text: label }),
      createElement("strong", { class: "summary-value", text: value }),
      note ? createElement("span", { class: "summary-note", text: note }) : null
    )
  );
}

// 박스오피스 TOP10 의 핵심 수치를 보여주는 요약 띠를 만드는 함수
function buildSummaryStrip(list, rangeText) {
  const totalAudience = list.reduce((sum, entry) => sum + entry.audience, 0);
  const totalDelta = list.reduce((sum, entry) => sum + entry.audienceDelta, 0);
  const newEntries = list.filter((entry) => entry.isNew);
  const top = list[0];
  return createElement("section", { class: "summary-strip", attrs: { "aria-label": "박스오피스 요약" } },
    createSummaryTile("📅", "조회 기준", rangeText, "KOBIS 영화관입장권통합전산망"),
    createSummaryTile("👥", "TOP10 관객 합계", `${formatCount(totalAudience)}명`, `전일 대비 ${totalDelta >= 0 ? "+" : "-"}${formatCount(Math.abs(totalDelta))}명`),
    createSummaryTile("🆕", "신규 진입", `${newEntries.length}편`, newEntries.length > 0 ? newEntries.map((entry) => entry.title).slice(0, 2).join(", ") : "이번에는 신규 진입작이 없어요"),
    createSummaryTile("🥇", "1위 매출 점유율", top ? `${top.salesShare}%` : "-", top ? top.title : "")
  );
}

// ---------- 하이라이트 (순위 변동 / 누적 관객 / 스크린) ----------

// 막대가 있는 순위 목록 한 줄을 만드는 함수
function createBarRow(entry, valueText, ratio) {
  return createElement("a", { class: "bar-row", attrs: { href: `#/kobis/${entry.movieCd}` } },
    createElement("span", { class: "bar-title", text: entry.title }),
    createElement("span", { class: "bar-track" }, createElement("i", { style: { width: `${Math.max(4, Math.round(ratio * 100))}%` } })),
    createElement("span", { class: "bar-value", text: valueText })
  );
}

// 일별 박스오피스 데이터로 하이라이트 패널 3개를 만드는 함수
function buildHighlights(list) {
  const risers = list.filter((entry) => entry.rankChange > 0 && !entry.isNew).sort((a, b) => b.rankChange - a.rankChange).slice(0, 3);
  const newcomers = list.filter((entry) => entry.isNew).slice(0, 3);
  const byAcc = [...list].sort((a, b) => b.audienceAcc - a.audienceAcc).slice(0, 5);
  const byScreens = [...list].sort((a, b) => b.screens - a.screens).slice(0, 5);

  // 패널 1: 순위 변동
  const changeList = createElement("div", { class: "change-list" });
  newcomers.forEach((entry) => changeList.appendChild(createElement("a", { class: "change-row", attrs: { href: `#/kobis/${entry.movieCd}` } },
    createRankChange(entry), createElement("span", { text: `${entry.rank}위 ${entry.title}` }))));
  risers.forEach((entry) => changeList.appendChild(createElement("a", { class: "change-row", attrs: { href: `#/kobis/${entry.movieCd}` } },
    createRankChange(entry), createElement("span", { text: `${entry.rank}위 ${entry.title}` }))));
  if (changeList.children.length === 0) changeList.appendChild(createElement("p", { class: "panel-note", text: "전일 대비 순위 변동이 없어요." }));

  // 패널 2, 3: 막대 순위
  const maxAcc = Math.max(1, ...byAcc.map((entry) => entry.audienceAcc));
  const maxScreens = Math.max(1, ...byScreens.map((entry) => entry.screens));

  return createElement("section", { class: "highlight-grid", attrs: { "aria-label": "박스오피스 하이라이트" } },
    createElement("div", { class: "panel" }, createElement("h3", { text: "🔥 순위 변동" }), changeList),
    createElement("div", { class: "panel" }, createElement("h3", { text: "👥 누적 관객 TOP5" }),
      ...byAcc.map((entry) => createBarRow(entry, `${formatCount(entry.audienceAcc)}명`, entry.audienceAcc / maxAcc))),
    createElement("div", { class: "panel" }, createElement("h3", { text: "🖥️ 스크린 수 TOP5" }),
      ...byScreens.map((entry) => createBarRow(entry, `${entry.screens.toLocaleString("ko-KR")}개`, entry.screens / maxScreens)))
  );
}

// ---------- 검색 바로가기 ----------

// 홈의 검색 입력창 (검색 화면으로 이동)
function buildHomeSearch() {
  const input = createElement("input", { class: "search-input", attrs: { type: "search", placeholder: "영화 제목으로 검색 (예: 아바타, 기생충)", "aria-label": "영화 제목 검색" } });
  const form = createElement("form", { class: "home-search", on: { submit: (event) => {
    event.preventDefault();
    const keyword = input.value.trim();
    location.hash = keyword ? `#/search?q=${encodeURIComponent(keyword)}` : "#/search";
  } } }, createElement("span", { class: "search-icon", text: "🔍", attrs: { "aria-hidden": "true" } }), input,
    createElement("button", { class: "btn-primary", text: "검색", attrs: { type: "submit" } }));
  return form;
}

// ---------- 박스오피스 섹션 ----------

// 박스오피스 상세 표를 만드는 함수 (순위, 관객, 매출, 점유율, 스크린, 누적)
function buildBoxOfficeTable(list) {
  const head = createElement("tr", {}, ...["순위", "영화", "개봉일", "관객수", "매출액", "점유율", "스크린/상영", "누적 관객"].map((text) => createElement("th", { text })));
  const body = createElement("tbody");
  list.forEach((entry) => {
    body.appendChild(createElement("tr", {},
      createElement("td", { class: "td-rank" }, createElement("strong", { text: String(entry.rank) }), createRankChange(entry)),
      createElement("td", {}, createElement("a", { class: "td-title", text: entry.title, attrs: { href: `#/kobis/${entry.movieCd}` } })),
      createElement("td", { text: formatDate(entry.openDate) }),
      createElement("td", {}, createElement("strong", { text: `${formatCount(entry.audience)}명` }),
        createElement("small", { class: entry.audienceChange >= 0 ? "pos" : "neg", text: `${entry.audienceChange >= 0 ? "+" : ""}${entry.audienceChange}%` })),
      createElement("td", { text: formatMoney(entry.sales) }),
      createElement("td", {}, createElement("span", { class: "share-bar" }, createElement("i", { style: { width: `${Math.min(100, entry.salesShare)}%` } })), createElement("small", { text: `${entry.salesShare}%` })),
      createElement("td", { text: `${entry.screens.toLocaleString("ko-KR")} / ${entry.shows.toLocaleString("ko-KR")}` }),
      createElement("td", { text: `${formatCount(entry.audienceAcc)}명` })
    ));
  });
  return createElement("div", { class: "table-scroll" }, createElement("table", { class: "data-table box-table" }, createElement("thead", {}, head), body));
}

// 박스오피스 섹션(기간/날짜/필터 + 순위 카드 + 상세 표)을 만드는 함수.
// firstPromise: 첫 조회 결과 (홈에서 이미 요청한 것을 재사용해 중복 호출을 막는다)
function buildBoxOfficeSection(firstPromise) {
  const rail = createElement("div", { class: "rank-rail" });
  const tableHolder = createElement("div", { class: "box-table-holder" });
  const rangeLabel = createElement("span", { class: "range-label" });
  const periodBox = createElement("div", { class: "chip-row" });
  const nationBox = createElement("div", { class: "chip-row" });
  const multiBox = createElement("div", { class: "chip-row" });
  const dateInput = createElement("input", { class: "date-input", attrs: { type: "date", "aria-label": "조회 날짜", max: addDaysToText(toDateText(getToday()), -1) } });
  let requestId = 0;      // 오래된 요청의 결과가 최신 화면을 덮어쓰지 않도록 번호로 구분

  // 선택 상태가 보이는 칩 묶음을 그리는 함수
  const drawChips = (box, options, key) => {
    clearElement(box);
    options.forEach(([value, label]) => box.appendChild(createElement("button", {
      class: "chip" + (boxOfficeState[key] === value ? " active" : ""), text: label,
      attrs: { type: "button", "aria-pressed": String(boxOfficeState[key] === value) },
      on: { click: () => {
        boxOfficeState[key] = value;
        if (key === "period") { boxOfficeState.date = getDefaultBoxOfficeDate(value); }   // 기간이 바뀌면 기본 날짜로
        redrawControls(); load();
      } }
    })));
  };
  const redrawControls = () => {
    drawChips(periodBox, Object.entries(BOXOFFICE_PERIODS).map(([key, period]) => [key, period.label]), "period");
    drawChips(nationBox, [["", "전체"], ["K", "한국영화"], ["F", "외국영화"]], "nation");
    drawChips(multiBox, [["", "전체"], ["N", "상업영화"], ["Y", "다양성영화"]], "multi");
    dateInput.value = boxOfficeState.date;
  };

  // 날짜를 하루(주간은 7일)씩 옮기는 함수
  const shiftDate = (direction) => {
    const step = boxOfficeState.period === "daily" ? 1 : 7;
    const next = addDaysToText(boxOfficeState.date, direction * step);
    if (next > dateInput.max) return;                         // 오늘 이후는 조회할 수 없음
    boxOfficeState.date = next; redrawControls(); load();
  };
  dateInput.addEventListener("change", () => { if (dateInput.value) { boxOfficeState.date = dateInput.value; load(); } });

  // 조회 결과를 화면에 그리는 함수
  const showResult = (result) => {
    clearElement(rail); clearElement(tableHolder);
    rangeLabel.textContent = `${result.rangeText} 기준`;
    if (result.list.length === 0) {
      rail.appendChild(createEmptyState("조건에 맞는 박스오피스 결과가 없어요", "날짜나 필터를 바꿔 보세요."));
      return;
    }
    result.list.forEach((entry) => rail.appendChild(createRankCard(entry)));
    tableHolder.appendChild(buildBoxOfficeTable(result.list));
    applyRevealEffects(rail, true);
  };

  // 조회해서 그리는 함수 (promise 가 없으면 현재 조건으로 새로 조회)
  async function load(promise) {
    const myId = ++requestId;
    clearElement(rail); clearElement(tableHolder);
    rail.append(...createSkeletonCards(6));
    try {
      const result = await (promise || fetchBoxOffice({ ...boxOfficeState }));
      if (myId === requestId && rail.isConnected) showResult(result);
    } catch (error) {
      if (myId !== requestId) return;
      clearElement(rail);
      rail.appendChild(createEmptyState("박스오피스를 불러오지 못했어요", describeKobisError(error)));
    }
  }

  redrawControls();
  load(firstPromise);

  return createElement("section", { class: "section", attrs: { id: "boxoffice" } },
    createElement("div", { class: "section-head" },
      createElement("h2", { class: "section-title", text: "박스오피스" }),
      createElement("div", { class: "date-control" },
        createElement("button", { class: "icon-btn", text: "‹", attrs: { type: "button", "aria-label": "이전" }, on: { click: () => shiftDate(-1) } }),
        dateInput,
        createElement("button", { class: "icon-btn", text: "›", attrs: { type: "button", "aria-label": "다음" }, on: { click: () => shiftDate(1) } }),
        rangeLabel)
    ),
    createElement("div", { class: "filter-bar" }, periodBox, nationBox, multiBox),
    rail,
    tableHolder
  );
}

// ---------- 개봉 예정 ----------

// 개봉 예정작 가로 목록 섹션을 만드는 함수 (스스로 불러온다)
function buildUpcomingSection() {
  const rail = createElement("div", { class: "h-rail" }, ...createSkeletonCards(6));
  const section = createElement("section", { class: "section", attrs: { id: "upcoming" } },
    createElement("div", { class: "section-head" }, createElement("h2", { class: "section-title", text: "개봉 예정작" }),
      createElement("span", { class: "range-label", text: "앞으로 60일 이내" })),
    rail);
  fetchUpcomingMovies().then((list) => {
    clearElement(rail);
    if (list.length === 0) { section.hidden = true; return; }
    list.forEach((item) => rail.appendChild(createKobisListCard(item)));
    applyRevealEffects(rail);
  }).catch(() => { section.hidden = true; });          // 실패하면 섹션을 숨긴다 (박스오피스 쪽에서 안내함)
  return section;
}

// ---------- 운영자 등록 영화 / 최근 작품평 ----------

// 영화 상세 화면 주소를 돌려주는 함수 (KOBIS 와 연결된 영화는 KOBIS 상세로)
function getMovieDetailHref(movie) {
  return movie.kobisCd ? `#/kobis/${movie.kobisCd}` : `#/movie/${movie.id}`;
}

// 운영자 등록 영화의 최근 작품평 모음을 만드는 함수
function buildRecentReviews(movies) {
  const reviews = movies.flatMap((movie) => movie.reviews.map((review) => ({ movie, review })))
    .sort((a, b) => b.review.date.localeCompare(a.review.date)).slice(0, 6);
  if (reviews.length === 0) return null;
  const grid = createElement("div", { class: "review-feed" });
  reviews.forEach(({ movie, review }) => grid.appendChild(createElement("a", { class: "feed-card", attrs: { href: getMovieDetailHref(movie) } },
    createElement("div", { class: "review-head" }, createElement("strong", { text: movie.title }), createScoreBadge(Number(review.score))),
    createElement("p", { class: "review-text", text: review.text }),
    createElement("p", { class: "feed-foot", text: `${review.source} · ${review.author} · ${formatDate(review.date)}` })
  )));
  return createElement("div", {}, createElement("h3", { class: "sub-title", text: "최근 작품평" }), grid);
}

// 검색/필터/정렬 도구 막대를 만드는 함수
function buildToolbar(movies, onChange) {
  const toolbar = createElement("div", { class: "toolbar", attrs: { "aria-label": "검색과 필터" } });
  const searchInput = createElement("input", {
    class: "search-input", attrs: { type: "search", placeholder: "등록된 영화에서 검색", "aria-label": "등록 영화 검색", value: homeFilterState.keyword },
    on: { input: (event) => { homeFilterState.keyword = event.target.value; onChange(); } }
  });
  const sortSelect = createElement("select", { class: "sort-select", attrs: { "aria-label": "정렬" }, on: { change: (event) => { homeFilterState.sort = event.target.value; onChange(); } } });
  Object.entries(MOVIE_CONFIG.sortOptions).forEach(([value, label]) => {
    const option = createElement("option", { text: label, attrs: { value } });
    option.selected = value === homeFilterState.sort;
    sortSelect.appendChild(option);
  });
  toolbar.appendChild(createElement("div", { class: "toolbar-row" }, searchInput, sortSelect));
  const statusBox = createElement("div", { class: "chip-row", attrs: { role: "tablist", "aria-label": "상영 상태" } });
  const genreBox = createElement("div", { class: "chip-row", attrs: { "aria-label": "장르" } });
  const drawChips = () => {
    clearElement(statusBox);
    getStatusTabs().forEach(([value, label]) => statusBox.appendChild(createElement("button", {
      class: "chip" + (homeFilterState.status === value ? " active" : ""), text: label,
      attrs: { type: "button", role: "tab", "aria-selected": String(homeFilterState.status === value) },
      on: { click: () => { homeFilterState.status = value; drawChips(); onChange(); } }
    })));
    clearElement(genreBox);
    collectGenres(movies).forEach((genre) => genreBox.appendChild(createElement("button", {
      class: "chip" + (homeFilterState.genre === genre ? " active" : ""), text: genre,
      attrs: { type: "button", "aria-pressed": String(homeFilterState.genre === genre) },
      on: { click: () => { homeFilterState.genre = genre; drawChips(); onChange(); } }
    })));
  };
  drawChips();
  toolbar.append(statusBox, genreBox);
  return toolbar;
}

// 운영자 등록 영화 섹션을 만드는 함수. liveMode 면 KOBIS 와 연결된 영화만, 아니면 전체(샘플 포함)
function buildManagedSection(liveMode) {
  const all = getAllMovies();
  const movies = liveMode ? all.filter((movie) => movie.kobisCd) : all;
  const title = liveMode ? "평점·작품평이 등록된 영화" : "등록된 영화 (샘플 데이터)";
  const section = createElement("section", { class: "section", attrs: { id: "managed" } },
    createElement("div", { class: "section-head" }, createElement("h2", { class: "section-title", text: title })));

  if (movies.length === 0) {
    // 아직 운영자가 등록한 영화가 없음
    section.appendChild(createElement("div", { class: "panel" },
      createElement("p", { class: "panel-note", text: "아직 평점·작품평이 등록된 영화가 없어요. 운영자 화면에서 영화를 등록하면 여기에 표시됩니다." }),
      createElement("a", { class: "btn-secondary", text: "운영자 화면으로", attrs: { href: "#/admin" } })));
    return section;
  }
  const grid = createElement("div", { class: "movie-grid" });
  const resultCount = createElement("p", { class: "result-count" });
  const refresh = () => {
    const result = sortMovies(filterMovies(movies, homeFilterState), homeFilterState.sort);
    clearElement(grid);
    resultCount.textContent = `총 ${result.length}편`;
    if (result.length === 0) { grid.appendChild(createEmptyState("조건에 맞는 영화가 없어요", "검색어나 필터를 바꿔 보세요.")); return; }
    result.forEach((movie) => grid.appendChild(createMovieCard(movie)));
    applyRevealEffects(grid);
  };
  if (movies.length > 6) section.appendChild(buildToolbar(movies, refresh));
  section.append(resultCount, grid);
  refresh();
  const reviews = buildRecentReviews(movies);
  if (reviews) section.appendChild(reviews);
  return section;
}

// ---------- 홈 화면 조립 ----------

// 홈 화면 전체를 그리는 함수 (라우터가 호출). 맨 위 캐러셀은 화면 폭 전체를 쓴다
function renderHomeView(container) {
  // 처음 조회 조건: 어제 일별 박스오피스
  Object.assign(boxOfficeState, { period: "daily", date: getDefaultBoxOfficeDate("daily"), nation: "", multi: "" });
  const dailyPromise = fetchBoxOffice({ ...boxOfficeState });

  const heroHolder = createElement("div", { class: "hero-holder" }, createHeroSkeleton());
  const summaryHolder = createElement("div", { class: "summary-holder" });
  const highlightHolder = createElement("div", {});
  const managedHolder = createElement("div", {});
  const noticeHolder = createElement("div", {});

  const body = createElement("div", { class: "container home-body" },
    summaryHolder,
    noticeHolder,
    buildHomeSearch(),
    buildBoxOfficeSection(dailyPromise),
    highlightHolder,
    buildUpcomingSection(),
    managedHolder
  );
  container.append(heroHolder, body);

  // 박스오피스를 불러오면 캐러셀 / 요약 / 하이라이트를 채운다
  dailyPromise.then((result) => {
    if (!container.isConnected) return;
    if (result.list.length === 0) throw Object.assign(new Error("empty"), { code: "API" });
    heroHolder.replaceChildren(createHeroCarousel(result.list.slice(0, 5).map((entry) => buildHeroItemFromEntry(entry, result.rangeText))));
    summaryHolder.appendChild(buildSummaryStrip(result.list, result.rangeText));
    highlightHolder.appendChild(buildHighlights(result.list));
    managedHolder.appendChild(buildManagedSection(true));
    applyRevealEffects(body);
  }).catch((error) => {
    if (!container.isConnected) return;
    // 실패하면 운영자 등록(샘플) 영화로 캐러셀을 채우고 안내 문구를 보여준다
    const featured = sortMovies(getAllMovies().filter((movie) => movie.status === "showing"), "rating").slice(0, 5);
    heroHolder.replaceChildren(featured.length > 0 ? createHeroCarousel(featured.map(buildHeroItemFromMovie)) : createElement("div", { class: "hero-holder-empty" }));
    noticeHolder.appendChild(createElement("div", { class: "notice-bar", attrs: { role: "status" } },
      createElement("strong", { text: "실시간 박스오피스 연결 안 됨" }), createElement("span", { text: describeKobisError(error) })));
    managedHolder.appendChild(buildManagedSection(false));
    applyRevealEffects(body);
  });

  return "박스오피스";
}
