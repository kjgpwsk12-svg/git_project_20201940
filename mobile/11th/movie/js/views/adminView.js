// 운영자 화면: 통계 확인, 영화·평점·작품평·관련 링크 관리, 백업/복원
// ※ PIN 잠금은 브라우저에서만 확인하는 데모용이다. 실제 운영에서는 서버 로그인으로 교체해야 한다.

// ---------- 운영자 로그인 상태 ----------

// 이번 탭에서 운영자로 인증했는지 확인하는 함수
function isOperatorLoggedIn() {
  try { return sessionStorage.getItem(MOVIE_CONFIG.storageKeys.operatorSession) === "1"; } catch (error) { return false; }
}

// 운영자 로그인 상태를 저장/해제하는 함수
function setOperatorLoggedIn(loggedIn) {
  try {
    if (loggedIn) sessionStorage.setItem(MOVIE_CONFIG.storageKeys.operatorSession, "1");
    else sessionStorage.removeItem(MOVIE_CONFIG.storageKeys.operatorSession);
  } catch (error) { /* 무시 */ }
}

// PIN 입력 화면을 그리는 함수
function renderOperatorLogin(container) {
  const input = createElement("input", { class: "text-input", attrs: { type: "password", inputmode: "numeric", placeholder: "PIN 입력", autocomplete: "off", "aria-label": "운영자 PIN" } });
  const errorText = createElement("p", { class: "form-error", attrs: { role: "alert" } });
  const submit = (event) => {
    event.preventDefault();
    if (input.value === MOVIE_CONFIG.operatorPin) { setOperatorLoggedIn(true); rerenderCurrentRoute(); }
    else { errorText.textContent = "PIN 이 올바르지 않습니다."; input.select(); }
  };
  container.appendChild(createElement("section", { class: "panel login-box" },
    createElement("h1", { class: "section-title", text: "운영자 로그인" }),
    createElement("p", { class: "panel-note", text: `영화 정보와 링크를 관리하는 화면입니다. (데모 PIN: ${MOVIE_CONFIG.operatorPin})` }),
    createElement("form", { on: { submit } }, input, createElement("button", { class: "btn-primary", text: "입장", attrs: { type: "submit" } })),
    errorText
  ));
}

// ---------- 운영자 대시보드 ----------

// 숫자 요약 카드를 만드는 함수
function createStatCard(label, value, note, level) {
  return createElement("div", { class: "stat-card" + (level ? ` ${level}` : "") },
    createElement("span", { class: "stat-label", text: label }),
    createElement("strong", { class: "stat-value", text: value }),
    note ? createElement("span", { class: "stat-note", text: note }) : null
  );
}

// 확인일이 오래된 링크 목록(점검 필요)을 찾는 함수
function findStaleLinks(movies) {
  const result = [];
  movies.filter((movie) => movie.status !== "ended").forEach((movie) => {
    movie.links.forEach((link) => {
      if (daysSince(link.checkedAt) > MOVIE_CONFIG.staleLinkDays) result.push({ movie, link });
    });
  });
  return result;
}

// 통계 카드 영역을 만드는 함수
function buildStatsPanel(movies) {
  const stats = summarizeStats();
  const reached = stats.rate >= MOVIE_CONFIG.targetOutboundRate;
  const staleCount = findStaleLinks(movies).length;
  return createElement("section", { class: "stat-grid" },
    createStatCard("등록 영화", `${movies.length}편`, `상영중 ${movies.filter((m) => m.status === "showing").length}편`),
    createStatCard("상세 화면 조회", `${stats.views}회`, "이 브라우저 기준"),
    createStatCard("관련 사이트 이동", `${stats.clicks}회`, "외부 링크 클릭"),
    createStatCard("이동 비율", `${stats.rate.toFixed(1)}%`, `목표 ${MOVIE_CONFIG.targetOutboundRate}% 이상`, stats.views === 0 ? "" : reached ? "ok" : "warn"),
    createStatCard("점검 필요 링크", `${staleCount}개`, `확인일 ${MOVIE_CONFIG.staleLinkDays}일 초과`, staleCount > 0 ? "warn" : "ok")
  );
}

// 점검이 필요한 링크 목록 패널을 만드는 함수 (한 번에 확인일 갱신 가능)
function buildStaleLinkPanel(movies) {
  const stale = findStaleLinks(movies);
  if (stale.length === 0) return null;
  const list = createElement("ul", { class: "stale-list" });
  stale.forEach(({ movie, link }) => {
    list.appendChild(createElement("li", {},
      createElement("span", { text: `${movie.title} · ${link.type} · ${link.label} (확인일 ${formatDate(link.checkedAt)})` }),
      createElement("a", { class: "btn-link", text: "수정", attrs: { href: `#/admin/edit/${movie.id}` } })
    ));
  });
  return createElement("section", { class: "panel warn-panel" },
    createElement("h2", { text: "⚠️ 링크 점검이 필요해요" }),
    createElement("p", { class: "panel-note", text: "링크가 열리는지 직접 확인한 뒤, 영화 수정 화면에서 확인일을 오늘로 바꿔 주세요." }),
    list
  );
}

// 영화 관리 표를 만드는 함수
function buildMovieTable(movies) {
  const body = createElement("tbody");
  movies.forEach((movie) => {
    body.appendChild(createElement("tr", {},
      createElement("td", {}, createElement("a", { text: movie.title, attrs: { href: `#/movie/${movie.id}` } })),
      createElement("td", {}, createStatusBadge(movie)),
      createElement("td", { text: formatDate(movie.releaseDate) }),
      createElement("td", { text: String(movie.links.length) }),
      createElement("td", { class: "actions" },
        createElement("a", { class: "btn-link", text: "수정", attrs: { href: `#/admin/edit/${movie.id}` } }),
        createElement("button", { class: "btn-link danger", text: "삭제", attrs: { type: "button" },
          on: { click: () => {
            if (!confirm(`"${movie.title}" 을(를) 삭제할까요?`)) return;
            deleteMovie(movie.id);
            showToast("삭제했습니다.");
            rerenderCurrentRoute();
          } } })
      )
    ));
  });
  const head = createElement("tr", {}, ...["영화", "상태", "개봉일", "링크", ""].map((text) => createElement("th", { text })));
  return createElement("div", { class: "table-scroll" },
    createElement("table", { class: "data-table" }, createElement("thead", {}, head), body));
}

// 백업(내보내기)/복원(가져오기)/초기화 도구를 만드는 함수
function buildBackupPanel() {
  const fileInput = createElement("input", { attrs: { type: "file", accept: "application/json", hidden: "" },
    on: { change: async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        importMoviesFromJson(await file.text());
        showToast("가져오기 완료");
        rerenderCurrentRoute();
      } catch (error) {
        showToast("가져오기 실패: " + error.message);
      }
    } } });

  return createElement("section", { class: "panel" },
    createElement("h2", { text: "데이터 관리" }),
    createElement("div", { class: "button-row" },
      createElement("button", { class: "btn-secondary", text: "JSON 내보내기", attrs: { type: "button" }, on: { click: downloadMoviesJson } }),
      createElement("button", { class: "btn-secondary", text: "JSON 가져오기", attrs: { type: "button" }, on: { click: () => fileInput.click() } }),
      createElement("button", { class: "btn-secondary", text: "통계 초기화", attrs: { type: "button" },
        on: { click: () => { if (confirm("조회/이동 통계를 초기화할까요?")) { resetStats(); rerenderCurrentRoute(); } } } }),
      createElement("button", { class: "btn-secondary danger", text: "샘플 데이터로 되돌리기", attrs: { type: "button" },
        on: { click: () => { if (confirm("모든 수정 내용을 지우고 샘플로 되돌릴까요?")) { resetMovies(); showToast("샘플 데이터로 되돌렸습니다."); rerenderCurrentRoute(); } } } }),
      fileInput
    )
  );
}

// 영화 목록을 JSON 파일로 내려받게 하는 함수
function downloadMoviesJson() {
  const blob = new Blob([exportMoviesAsJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = createElement("a", { attrs: { href: url, download: `movies-${toDateText(new Date())}.json` } });
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// 운영자 메인 화면 전체를 그리는 함수
function renderAdminDashboard(container) {
  const movies = getAllMovies();
  container.appendChild(createElement("div", { class: "admin-head" },
    createElement("h1", { class: "section-title", text: "운영자 대시보드" }),
    createElement("div", { class: "button-row" },
      createElement("a", { class: "btn-primary", text: "+ 영화 추가", attrs: { href: "#/admin/new" } }),
      createElement("button", { class: "btn-secondary", text: "로그아웃", attrs: { type: "button" },
        on: { click: () => { setOperatorLoggedIn(false); rerenderCurrentRoute(); } } })
    )
  ));
  container.appendChild(buildStatsPanel(movies));
  container.appendChild(buildStaleLinkPanel(movies));
  container.appendChild(createElement("section", { class: "panel" }, createElement("h2", { text: "영화 관리" }), buildMovieTable(movies)));
  container.appendChild(buildBackupPanel());
}

// ---------- 영화 편집 폼 ----------

// 입력 칸 + 라벨 한 쌍을 만드는 함수
function createField(labelText, inputElement, hintText) {
  return createElement("label", { class: "field" },
    createElement("span", { class: "field-label", text: labelText }),
    inputElement,
    hintText ? createElement("span", { class: "field-hint", text: hintText }) : null
  );
}

// 글자 입력 칸을 만드는 함수 (type: text/number/date/url ...)
function createTextInput(type, value, extraAttrs = {}) {
  const input = createElement("input", { class: "text-input", attrs: { type, ...extraAttrs } });
  input.value = value ?? "";
  return input;
}

// 선택 상자를 만드는 함수 (options: 값 배열 또는 [값, 이름] 배열)
function createSelect(options, selectedValue) {
  const select = createElement("select", { class: "text-input" });
  options.forEach((option) => {
    const [value, label] = Array.isArray(option) ? option : [option, option];
    const node = createElement("option", { text: label, attrs: { value } });
    node.selected = value === selectedValue;
    select.appendChild(node);
  });
  return select;
}

// "행 추가/삭제"가 되는 반복 입력 영역을 만드는 함수 (평점, 작품평, 링크에 공통 사용)
// fieldDefs: [{ key, label, build(값) → 입력요소, wide }], 반환: { element, collect() → 행 객체 배열 }
function createRowEditor(title, fieldDefs, initialRows, emptyRowFactory) {
  const rowsBox = createElement("div", { class: "row-list" });
  const rows = [];                                   // 각 행의 { inputs, element }

  // 행 하나를 화면에 추가하는 내부 함수
  const addRow = (data) => {
    const inputs = {};
    const rowElement = createElement("div", { class: "row-item" });
    fieldDefs.forEach((def) => {
      inputs[def.key] = def.build(data[def.key]);
      rowElement.appendChild(createElement("div", { class: "row-cell" + (def.wide ? " wide" : "") },
        createElement("span", { class: "field-label", text: def.label }), inputs[def.key]));
    });
    const entry = { inputs, element: rowElement };
    rowElement.appendChild(createElement("button", { class: "btn-link danger row-remove", text: "삭제", attrs: { type: "button" },
      on: { click: () => { rows.splice(rows.indexOf(entry), 1); rowElement.remove(); } } }));
    rows.push(entry);
    rowsBox.appendChild(rowElement);
  };

  initialRows.forEach(addRow);
  const element = createElement("section", { class: "panel" },
    createElement("h2", { text: title }), rowsBox,
    createElement("button", { class: "btn-secondary", text: "+ 행 추가", attrs: { type: "button" }, on: { click: () => addRow(emptyRowFactory()) } })
  );
  // 입력값을 객체 배열로 모으는 함수
  const collect = () => rows.map((entry) => {
    const result = {};
    fieldDefs.forEach((def) => { result[def.key] = entry.inputs[def.key].value; });
    return result;
  });
  return { element, collect };
}

// 영화 편집/추가 화면을 그리는 함수. movieId 가 없으면 새 영화
function renderMovieForm(container, movieId) {
  const existing = movieId ? getMovieById(movieId) : null;
  if (movieId && !existing) {
    container.appendChild(createEmptyState("수정할 영화를 찾을 수 없어요"));
    container.appendChild(createElement("a", { class: "btn-primary", text: "운영자 화면으로", attrs: { href: "#/admin" } }));
    return;
  }
  // 새 영화일 때의 기본값
  const movie = existing || {
    id: createMovieId(), title: "", originalTitle: "", status: "upcoming", releaseDate: toDateText(new Date()),
    runtime: 100, ageRating: "12세", genres: [], director: "", cast: [], synopsis: "",
    posterColors: ["#2d3a63", "#c45c8a"], posterUrl: "", ratings: [], reviews: [], links: []
  };

  // --- 기본 정보 입력 칸 ---
  const inputs = {
    kobisCd: createTextInput("text", movie.kobisCd || "", { placeholder: "예: 20261807 (박스오피스 영화코드)" }),
    title: createTextInput("text", movie.title, { required: "", maxlength: "80" }),
    originalTitle: createTextInput("text", movie.originalTitle),
    status: createSelect(Object.entries(MOVIE_CONFIG.statusLabels), movie.status),
    releaseDate: createTextInput("date", movie.releaseDate, { required: "" }),
    runtime: createTextInput("number", movie.runtime, { min: "1", max: "600" }),
    ageRating: createSelect(MOVIE_CONFIG.ageRatings, movie.ageRating),
    genres: createTextInput("text", movie.genres.join(", ")),
    director: createTextInput("text", movie.director),
    cast: createTextInput("text", movie.cast.join(", ")),
    posterUrl: createTextInput("url", movie.posterUrl, { placeholder: "https://... (비워두면 색상 포스터)" }),
    colorA: createTextInput("color", movie.posterColors[0]),
    colorB: createTextInput("color", movie.posterColors[1])
  };
  const synopsis = createElement("textarea", { class: "text-input", attrs: { rows: "4" } });
  synopsis.value = movie.synopsis;

  const basicPanel = createElement("section", { class: "panel" },
    createElement("h2", { text: "기본 정보" }),
    createElement("div", { class: "form-grid" },
      createField("제목 *", inputs.title), createField("원제", inputs.originalTitle),
      createField("KOBIS 영화코드", inputs.kobisCd, "입력하면 KOBIS 상세 화면에 평점·작품평이 함께 표시돼요"),
      createField("상태", inputs.status), createField("개봉일 *", inputs.releaseDate),
      createField("러닝타임(분)", inputs.runtime), createField("관람등급", inputs.ageRating),
      createField("장르", inputs.genres, "쉼표로 구분 (예: 액션, 스릴러)"), createField("감독", inputs.director),
      createField("출연", inputs.cast, "쉼표로 구분"), createField("포스터 이미지 주소", inputs.posterUrl),
      createField("포스터 색상 1", inputs.colorA), createField("포스터 색상 2", inputs.colorB)
    ),
    createField("줄거리", synopsis)
  );

  // --- 평점 / 작품평 / 링크 반복 입력 ---
  const ratingEditor = createRowEditor("출처별 평점", [
    { key: "source", label: "출처", build: (v) => createSelect(MOVIE_CONFIG.ratingSources, v) },
    { key: "score", label: "점수(0~10)", build: (v) => createTextInput("number", v, { min: "0", max: "10", step: "0.1" }) },
    { key: "count", label: "참여 수", build: (v) => createTextInput("number", v, { min: "0" }) }
  ], movie.ratings, () => ({ source: MOVIE_CONFIG.ratingSources[0], score: "", count: "" }));

  const reviewEditor = createRowEditor("작품평", [
    { key: "source", label: "출처", build: (v) => createSelect(MOVIE_CONFIG.ratingSources, v) },
    { key: "author", label: "작성자", build: (v) => createTextInput("text", v) },
    { key: "score", label: "점수", build: (v) => createTextInput("number", v, { min: "0", max: "10", step: "0.1" }) },
    { key: "date", label: "작성일", build: (v) => createTextInput("date", v) },
    { key: "text", label: "내용", wide: true, build: (v) => { const t = createElement("textarea", { class: "text-input", attrs: { rows: "2" } }); t.value = v ?? ""; return t; } }
  ], movie.reviews, () => ({ source: MOVIE_CONFIG.ratingSources[0], author: "", score: "", date: toDateText(new Date()), text: "" }));

  const linkEditor = createRowEditor("관련 사이트", [
    { key: "type", label: "종류", build: (v) => createSelect(Object.keys(MOVIE_CONFIG.linkTypes), v) },
    { key: "label", label: "표시 이름", build: (v) => createTextInput("text", v) },
    { key: "source", label: "출처", build: (v) => createTextInput("text", v) },
    { key: "checkedAt", label: "확인일", build: (v) => createTextInput("date", v) },
    { key: "url", label: "주소 (https://...)", wide: true, build: (v) => createTextInput("url", v) }
  ], movie.links, () => ({ type: "예매", label: "", source: "", url: "", checkedAt: toDateText(new Date()) }));

  // --- 저장 처리 ---
  const errorText = createElement("p", { class: "form-error", attrs: { role: "alert" } });
  const handleSubmit = (event) => {
    event.preventDefault();
    const errors = [];
    // 평점: 점수가 비어 있는 행은 무시, 범위 확인
    const ratings = ratingEditor.collect().filter((row) => row.score !== "").map((row) => ({ source: row.source, score: Number(row.score), count: Number(row.count || 0) }));
    ratings.forEach((rating) => { if (rating.score < 0 || rating.score > 10) errors.push("평점은 0~10 사이여야 합니다."); });
    // 작품평: 내용이 있는 행만
    const reviews = reviewEditor.collect().filter((row) => row.text.trim() !== "").map((row) => ({ source: row.source, author: row.author.trim() || "익명", score: Number(row.score || 0), date: row.date, text: row.text.trim() }));
    // 링크: 주소가 있는 행만, http/https 만 허용
    const links = linkEditor.collect().filter((row) => row.url.trim() !== "" || row.label.trim() !== "").map((row) => ({ type: row.type, label: row.label.trim() || row.type, source: row.source.trim() || "-", url: row.url.trim(), checkedAt: row.checkedAt }));
    links.forEach((link) => { if (!isSafeHttpUrl(link.url)) errors.push(`링크 주소가 올바르지 않습니다: ${link.label}`); });
    if (inputs.posterUrl.value && !isSafeHttpUrl(inputs.posterUrl.value)) errors.push("포스터 이미지 주소가 올바르지 않습니다.");
    if (!inputs.title.value.trim()) errors.push("제목을 입력해 주세요.");

    if (errors.length > 0) { errorText.textContent = [...new Set(errors)].join(" / "); errorText.scrollIntoView({ behavior: "smooth", block: "center" }); return; }

    const saved = saveMovie({
      id: movie.id,
      kobisCd: inputs.kobisCd.value.trim(),
      title: inputs.title.value.trim(),
      originalTitle: inputs.originalTitle.value.trim(),
      status: inputs.status.value,
      releaseDate: inputs.releaseDate.value,
      runtime: Number(inputs.runtime.value) || 0,
      ageRating: inputs.ageRating.value,
      genres: splitByComma(inputs.genres.value),
      director: inputs.director.value.trim(),
      cast: splitByComma(inputs.cast.value),
      synopsis: synopsis.value.trim(),
      posterColors: [inputs.colorA.value, inputs.colorB.value],
      posterUrl: inputs.posterUrl.value.trim(),
      ratings, reviews, links
    });
    showToast(saved ? "저장했습니다." : "저장 공간이 부족해 저장하지 못했습니다.");
    if (saved) location.hash = "#/admin";
  };

  container.appendChild(createElement("a", { class: "back-link", text: "← 운영자 화면", attrs: { href: "#/admin" } }));
  container.appendChild(createElement("h1", { class: "section-title", text: existing ? `영화 수정: ${existing.title}` : "새 영화 추가" }));
  container.appendChild(createElement("form", { class: "admin-form", on: { submit: handleSubmit } },
    basicPanel, ratingEditor.element, reviewEditor.element, linkEditor.element, errorText,
    createElement("div", { class: "form-actions" },
      createElement("button", { class: "btn-primary", text: "저장", attrs: { type: "submit" } }),
      createElement("a", { class: "btn-secondary", text: "취소", attrs: { href: "#/admin" } })
    )
  ));
}

// ---------- 라우터가 호출하는 진입 함수 ----------

// 운영자 목록 화면 (로그인 전이면 PIN 화면)
function renderAdminView(container) {
  if (!isOperatorLoggedIn()) renderOperatorLogin(container); else renderAdminDashboard(container);
  return "운영자";
}

// 운영자 편집 화면 (movieId 없으면 새 영화)
function renderAdminEditView(container, movieId) {
  if (!isOperatorLoggedIn()) renderOperatorLogin(container); else renderMovieForm(container, movieId);
  return "운영자 - 영화 편집";
}
