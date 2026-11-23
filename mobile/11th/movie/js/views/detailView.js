// 작품 상세 화면: 기본 정보 → 출처별 평점 → 작품평 → 관련 사이트 이동

// 출처별 평점 막대 영역을 만드는 함수
function buildRatingSection(movie) {
  const section = createElement("section", { class: "panel" }, createElement("h2", { text: "출처별 평점" }));
  const average = calcAverageScore(movie);
  if (average === null) {
    section.appendChild(createEmptyState("아직 등록된 평점이 없어요", "개봉 후 평점이 등록되면 표시됩니다."));
    return section;
  }
  // 대표 평점(출처 평균)
  section.appendChild(createElement("div", { class: "avg-box" },
    createElement("span", { class: `avg-number ${findScoreLevel(average)}`, text: formatScore(average), attrs: { "data-count": formatScore(average) } }),   // 숫자가 올라가는 효과 대상
    createElement("span", { class: "avg-note", text: `/ 10 · ${movie.ratings.length}개 출처 평균` })
  ));
  // 출처별 막대
  movie.ratings.forEach((rating) => {
    const percent = Math.max(0, Math.min(100, (rating.score / 10) * 100));       // 0~100% 로 제한
    section.appendChild(createElement("div", { class: "rating-row" },
      createElement("span", { class: "rating-source", text: rating.source }),
      createElement("div", { class: "rating-track" },
        createElement("div", { class: `rating-fill ${findScoreLevel(rating.score)}`, style: { width: `${percent}%` } })
      ),
      createElement("span", { class: "rating-score", text: formatScore(rating.score) }),
      createElement("span", { class: "rating-count", text: `${Number(rating.count || 0).toLocaleString("ko-KR")}명` })
    ));
  });
  return section;
}

// 작품평 영역을 만드는 함수 (출처별로 걸러볼 수 있다)
function buildReviewSection(movie) {
  const section = createElement("section", { class: "panel" }, createElement("h2", { text: "작품평" }));
  if (movie.reviews.length === 0) {
    section.appendChild(createEmptyState("등록된 작품평이 없어요"));
    return section;
  }
  const sources = ["전체", ...new Set(movie.reviews.map((review) => review.source))];
  let selectedSource = "전체";
  const tabBox = createElement("div", { class: "chip-row" });
  const list = createElement("ul", { class: "review-list" });

  // 선택한 출처의 작품평만 다시 그리는 함수
  const draw = () => {
    clearElement(tabBox);
    sources.forEach((source) => {
      tabBox.appendChild(createElement("button", {
        class: "chip" + (source === selectedSource ? " active" : ""), text: source,
        attrs: { type: "button", "aria-pressed": String(source === selectedSource) },
        on: { click: () => { selectedSource = source; draw(); } }
      }));
    });
    clearElement(list);
    movie.reviews
      .filter((review) => selectedSource === "전체" || review.source === selectedSource)
      .forEach((review) => {
        list.appendChild(createElement("li", { class: "review" },
          createElement("div", { class: "review-head" },
            createElement("span", { class: "review-source", text: review.source }),
            createElement("strong", { text: review.author }),
            createScoreBadge(Number(review.score)),
            createElement("span", { class: "review-date", text: formatDate(review.date) })
          ),
          createElement("p", { class: "review-text", text: review.text })
        ));
      });
  };
  draw();
  section.appendChild(tabBox);
  section.appendChild(list);
  return section;
}

// 관련 사이트 영역을 만드는 함수 (종류별로 묶어서 표시)
function buildLinkSection(movie) {
  const section = createElement("section", { class: "panel", attrs: { id: "related-links" } },
    createElement("h2", { text: "관련 사이트로 이동" }),
    createElement("p", { class: "panel-note", text: "아래 링크는 외부 사이트로 연결되며, 출처와 마지막 확인일을 함께 표시합니다." })
  );
  if (movie.links.length === 0) {
    section.appendChild(createEmptyState("등록된 관련 사이트가 없어요"));
    return section;
  }
  // 링크 종류(예매/공식 정보/...) 순서대로 묶기
  Object.keys(MOVIE_CONFIG.linkTypes).forEach((type) => {
    const links = movie.links.filter((link) => link.type === type);
    if (links.length === 0) return;
    section.appendChild(createElement("h3", { class: "link-group-title", text: type }));
    const group = createElement("div", { class: "link-group" });
    links.forEach((link) => group.appendChild(createExternalLink(movie, link)));
    section.appendChild(group);
  });
  return section;
}

// 같은 장르의 다른 영화를 추천하는 영역을 만드는 함수
function buildRelatedMovies(movie) {
  const related = getAllMovies()
    .filter((other) => other.id !== movie.id && other.status !== "ended")
    .filter((other) => other.genres.some((genre) => movie.genres.includes(genre)))
    .slice(0, 4);
  if (related.length === 0) return null;
  const grid = createElement("div", { class: "movie-grid small" });
  related.forEach((other) => grid.appendChild(createMovieCard(other)));
  return createElement("section", { class: "related" }, createElement("h2", { class: "section-title", text: "비슷한 장르의 영화" }), grid);
}

// 박스오피스 수치 패널 (KOBIS 영화에 순위 정보가 있을 때)
function buildBoxOfficePanel(entry) {
  const tiles = [
    ["순위", `${entry.rank}위`, entry.isNew ? "신규 진입" : entry.rankChange > 0 ? `전일 대비 ▲${entry.rankChange}` : entry.rankChange < 0 ? `전일 대비 ▼${-entry.rankChange}` : "순위 변동 없음"],
    ["관객수", `${formatCount(entry.audience)}명`, `전일 대비 ${formatSigned(entry.audienceChange, "%")}`],
    ["누적 관객", `${formatCount(entry.audienceAcc)}명`, "개봉일부터 합계"],
    ["매출액", formatMoney(entry.sales), `점유율 ${entry.salesShare}%`],
    ["누적 매출", formatMoney(entry.salesAcc), ""],
    ["스크린 · 상영", `${entry.screens.toLocaleString("ko-KR")}개`, `${entry.shows.toLocaleString("ko-KR")}회 상영`]
  ];
  const grid = createElement("div", { class: "tile-grid" });
  tiles.forEach(([label, value, note]) => grid.appendChild(createElement("div", { class: "tile" },
    createElement("div", { class: "tile-label", text: label }),
    createElement("div", { class: "tile-value", text: value }),
    note ? createElement("div", { class: "tile-note", text: note }) : null)));
  return createElement("section", { class: "panel" }, createElement("h2", { text: "🏆 박스오피스" }), grid);
}

// 영화 객체 하나를 상세 화면으로 그리는 공통 함수 (운영자 등록 영화와 KOBIS 영화 모두 사용)
// options: { fromKobis: KOBIS 에서 불러온 영화인지 }
function renderMovieDetail(container, movie, options = {}) {
  recordDetailView(movie.id);   // 핵심 지표: 상세 조회 기록

  container.appendChild(createElement("a", { class: "back-link", text: "← 박스오피스로", attrs: { href: "#/" } }));

  // 기본 정보 목록 (값이 있는 항목만 표시)
  const facts = [
    ["개봉일", formatDate(movie.releaseDate)],
    ["러닝타임", movie.runtime ? `${movie.runtime}분` : "-"],
    ["관람등급", movie.ageRating],
    ["장르", movie.genres.join(", ")],
    ["감독", movie.director],
    ["출연", movie.cast.join(", ")],
    movie.nations && movie.nations.length ? ["제작 국가", movie.nations.join(", ")] : null,
    movie.distributors && movie.distributors.length ? ["배급", movie.distributors.join(", ")] : null
  ].filter(Boolean);

  // 운영자 로그인 상태면 관리 목록 등록/수정 버튼을 보여준다 (KOBIS 영화 전용)
  let operatorButton = null;
  if (options.fromKobis && isOperatorLoggedIn()) {
    operatorButton = createElement("button", { class: "btn-secondary", attrs: { type: "button" },
      text: movie.managedId ? "✏️ 평점·작품평 수정" : "➕ 평점·작품평 등록",
      on: { click: () => {
        if (movie.managedId) { location.hash = "#/admin/edit/" + movie.managedId; return; }
        const draft = createManagedDraftFromKobis(movie);   // KOBIS 정보로 초안을 만들어 저장한 뒤 편집 화면으로
        saveMovie(draft);
        location.hash = "#/admin/edit/" + draft.id;
      } } });
  }

  const info = createElement("div", { class: "detail-info" },
    createElement("div", { class: "detail-badges" }, createStatusBadge(movie), movie.releaseDate ? createElement("span", { class: "card-release", text: formatReleaseLabel(movie) }) : null),
    createElement("h1", { class: "detail-title", text: movie.title }),
    movie.originalTitle ? createElement("p", { class: "detail-original", text: movie.originalTitle }) : null,
    createElement("div", { class: "detail-score" }, createScoreBadge(calcAverageScore(movie)),
      createElement("span", { class: "avg-note", text: `작품평 ${movie.reviews.length}건` })),
    createElement("dl", { class: "facts" },
      ...facts.map(([label, value]) => createElement("div", {}, createElement("dt", { text: label }), createElement("dd", { text: value || "-" })))
    ),
    createElement("div", { class: "detail-actions" },
      createElement("a", { class: "btn-primary", text: "🎟️ 관련 사이트 바로가기", attrs: { href: "#related-links" },
        on: { click: (event) => { event.preventDefault(); const target = document.getElementById("related-links"); if (target) target.scrollIntoView({ behavior: "smooth" }); } } }),
      createCompareButton(movie.id, movie.title),
      operatorButton
    )
  );
  // 포스터 색상으로 상단 영역 뒤에 은은한 조명 효과를 준다
  container.appendChild(createElement("section", { class: "detail-top", style: { "--glow": movie.posterColors[0] } },
    createElement("div", { class: "detail-poster" }, createPoster(movie)), info));

  // 박스오피스 수치 (KOBIS 영화이면서 순위 정보가 있을 때)
  if (movie.boxOffice) container.appendChild(buildBoxOfficePanel(movie.boxOffice));

  // 줄거리 (KOBIS 는 줄거리를 제공하지 않으므로 안내 문구)
  container.appendChild(createElement("section", { class: "panel" },
    createElement("h2", { text: "작품 소개" }),
    movie.synopsis
      ? createElement("p", { class: "synopsis", text: movie.synopsis })
      : createElement("p", { class: "panel-note", text: "등록된 줄거리가 없어요. KOBIS 는 줄거리를 제공하지 않아, 운영자가 직접 등록해야 표시됩니다." })));

  // 평점 / 작품평 / 관련 사이트: 넓은 화면에서는 2열
  container.appendChild(createElement("div", { class: "detail-columns" },
    createElement("div", {}, buildRatingSection(movie), buildReviewSection(movie)),
    createElement("div", {}, buildLinkSection(movie))
  ));

  if (!options.fromKobis) {
    const related = buildRelatedMovies(movie);
    if (related) container.appendChild(related);
  }
  return movie.title;
}

// 운영자 등록 영화 상세 화면 (라우터가 호출). 영화가 없으면 안내 화면
function renderDetailView(container, movieId) {
  const movie = getMovieById(movieId);
  if (!movie) {
    container.appendChild(createEmptyState("영화를 찾을 수 없어요", "삭제되었거나 잘못된 주소입니다."));
    container.appendChild(createElement("a", { class: "btn-primary", text: "박스오피스로", attrs: { href: "#/" } }));
    return "영화를 찾을 수 없음";
  }
  return renderMovieDetail(container, movie);
}

// KOBIS 영화 상세 화면 (라우터가 호출). 정보를 불러오는 동안 로딩 표시를 하고, 끝나면 화면을 채운다
function renderKobisDetailView(container, movieCd) {
  const path = getCurrentPath();
  container.appendChild(createElement("div", { class: "detail-loading" },
    createElement("div", { class: "skeleton skeleton-title" }), createElement("div", { class: "skeleton skeleton-line" }), createElement("div", { class: "skeleton skeleton-line short" })));

  getKobisMovie(movieCd).then((movie) => {
    if (!container.isConnected || getCurrentPath() !== path) return;      // 그 사이 다른 화면으로 이동했으면 중단
    clearElement(container);
    const title = renderMovieDetail(container, movie, { fromKobis: true });
    document.title = `${title} - ${MOVIE_CONFIG.siteName}`;
    applyRevealEffects(container);
  }).catch((error) => {
    if (!container.isConnected) return;
    clearElement(container);
    container.appendChild(createEmptyState("영화 정보를 불러오지 못했어요", describeKobisError(error)));
    container.appendChild(createElement("a", { class: "btn-primary", text: "박스오피스로", attrs: { href: "#/" } }));
  });
  return "영화 정보";
}
