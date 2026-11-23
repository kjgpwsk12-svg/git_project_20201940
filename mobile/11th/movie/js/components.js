// 여러 화면에서 재사용하는 화면 조각(컴포넌트) 모음

// 영화 포스터를 만드는 함수. 이미지 주소가 있으면 이미지, 없거나 실패하면 색상 그라데이션 + 제목
function createPoster(movie) {
  const [colorA, colorB] = movie.posterColors || ["#333", "#666"];
  const poster = createElement("div", {
    class: "poster",
    style: { background: `linear-gradient(160deg, ${colorA}, ${colorB})` }
  });
  // 이미지가 없을 때 보이는 제목 글자 (이미지가 있으면 가려진다)
  poster.appendChild(createElement("span", { class: "poster-title", text: movie.title }));
  if (movie.posterUrl && isSafeHttpUrl(movie.posterUrl)) {
    const image = createElement("img", {
      attrs: { src: movie.posterUrl, alt: `${movie.title} 포스터`, loading: "lazy" },
      on: { error: () => image.remove() }              // 이미지가 깨지면 제거하고 그라데이션 유지
    });
    poster.appendChild(image);
  }
  return poster;
}

// 평점 배지(별 + 점수)를 만드는 함수. 평점이 없으면 "평점 없음"
function createScoreBadge(score) {
  if (score === null || score === undefined) {
    return createElement("span", { class: "score-badge none", text: "평점 없음" });
  }
  return createElement("span", { class: `score-badge ${findScoreLevel(score)}`, text: `★ ${formatScore(score)}` });
}

// 상영 상태 배지를 만드는 함수 (상영중/개봉예정/종영)
function createStatusBadge(movie) {
  return createElement("span", {
    class: `status-badge status-${movie.status}`,
    text: MOVIE_CONFIG.statusLabels[movie.status] || movie.status
  });
}

// 영화 카드(목록의 한 칸)를 만드는 함수
function createMovieCard(movie) {
  const card = createElement("article", { class: "movie-card" });

  // 포스터 + 제목 영역 전체를 상세 화면 링크로 만든다
  const link = createElement("a", { class: "card-link", attrs: { href: `#/movie/${movie.id}`, "aria-label": `${movie.title} 상세 보기` } });
  const posterWrap = createElement("div", { class: "card-poster" }, createPoster(movie), createStatusBadge(movie));
  link.appendChild(posterWrap);
  link.appendChild(createElement("h3", { class: "card-title", text: movie.title }));
  link.appendChild(createElement("p", { class: "card-meta", text: `${movie.genres.join("·")} · ${movie.ageRating}` }));

  // 평점 + 개봉 안내
  const footer = createElement("div", { class: "card-footer" },
    createScoreBadge(calcAverageScore(movie)),
    createElement("span", { class: "card-release", text: formatReleaseLabel(movie) })
  );
  link.appendChild(footer);
  card.appendChild(link);

  // 비교 담기 버튼 (링크 바깥에 둔다)
  card.appendChild(createCompareButton(movie.id, movie.title));
  return card;
}

// 비교 담기/빼기 버튼을 만드는 함수 (누를 때마다 문구가 바뀐다)
function createCompareButton(movieId, title) {
  const button = createElement("button", { class: "btn-compare", attrs: { type: "button" } });
  // 현재 담김 여부에 맞게 문구/스타일을 갱신하는 내부 함수
  const refresh = () => {
    const selected = isInCompare(movieId);
    button.textContent = selected ? "✓ 비교 담김" : "+ 비교 담기";
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  };
  button.addEventListener("click", () => { toggleCompare(movieId, title); refresh(); });
  window.addEventListener("compare-changed", () => { if (button.isConnected) refresh(); }); // 다른 곳에서 바뀌어도 반영
  refresh();
  return button;
}

// 외부 사이트 이동 링크를 만드는 함수. 클릭 시 이동 횟수를 기록한다.
function createExternalLink(movie, link) {
  const stale = daysSince(link.checkedAt) > MOVIE_CONFIG.staleLinkDays;     // 확인일이 오래됐는지
  const icon = MOVIE_CONFIG.linkTypes[link.type] || "🔗";

  // 주소가 안전하지 않으면 이동 불가 상태로 표시
  if (!isSafeHttpUrl(link.url)) {
    return createElement("div", { class: "ext-link disabled", text: `${icon} ${link.label} (잘못된 주소)` });
  }
  const anchor = createElement("a", {
    class: "ext-link",
    attrs: { href: link.url, target: "_blank", rel: "noopener noreferrer" },  // 새 탭으로, 보안 속성 포함
    on: { click: () => recordOutboundClick(movie.id) }                        // 핵심 지표 기록
  },
    createElement("span", { class: "ext-icon", text: icon }),
    createElement("span", { class: "ext-body" },
      createElement("strong", { text: link.label }),
      createElement("small", { text: `출처: ${link.source} · 확인일 ${formatDate(link.checkedAt)}${stale ? " · 오래됨" : ""}` })
    ),
    createElement("span", { class: "ext-arrow", text: "↗" })
  );
  if (stale) anchor.classList.add("stale");
  return anchor;
}

// 빈 상태(결과 없음) 안내 상자를 만드는 함수
function createEmptyState(title, description) {
  return createElement("div", { class: "empty-state" },
    createElement("p", { class: "empty-title", text: title }),
    description ? createElement("p", { class: "empty-desc", text: description }) : null
  );
}

// ---------- 박스오피스 / KOBIS 전용 컴포넌트 ----------

// 순위 변동 배지를 만드는 함수 (NEW / ▲2 / ▼1 / -)
function createRankChange(entry) {
  if (entry.isNew) return createElement("span", { class: "rank-change new", text: "NEW" });
  if (entry.rankChange > 0) return createElement("span", { class: "rank-change up", text: `▲${entry.rankChange}` });
  if (entry.rankChange < 0) return createElement("span", { class: "rank-change down", text: `▼${-entry.rankChange}` });
  return createElement("span", { class: "rank-change same", text: "-" });
}

// 박스오피스 순위 카드(큰 순위 숫자 + 포스터 + 관객수)를 만드는 함수
function createRankCard(entry) {
  return createElement("a", { class: "rank-card", attrs: { href: `#/kobis/${entry.movieCd}`, "aria-label": `${entry.rank}위 ${entry.title}` } },
    createElement("span", { class: "rank-num", text: String(entry.rank), attrs: { "aria-hidden": "true" } }),
    createElement("div", { class: "rank-poster" }, createPoster(entry), createRankChange(entry)),
    createElement("h3", { class: "rank-title", text: entry.title }),
    createElement("p", { class: "rank-meta", text: `관객 ${formatCount(entry.audience)}명` }),
    createElement("p", { class: "rank-sub", text: `누적 ${formatCount(entry.audienceAcc)}명` })
  );
}

// 개봉예정/검색 결과용 영화 카드(KOBIS 영화 목록 한 줄)를 만드는 함수
function createKobisListCard(item) {
  const days = item.openDate ? diffInDays(getToday(), parseDateText(item.openDate)) : null;
  const label = days === null ? "개봉일 미정" : days > 0 ? `D-${days} 개봉` : days === 0 ? "오늘 개봉" : `${formatDate(item.openDate)} 개봉`;
  const badgeClass = days !== null && days > 0 ? "status-upcoming" : "status-ended";
  return createElement("a", { class: "kobis-card", attrs: { href: `#/kobis/${item.movieCd}` } },
    createElement("div", { class: "card-poster" }, createPoster(item),
      createElement("span", { class: `status-badge ${badgeClass}`, text: label })),
    createElement("h3", { class: "card-title", text: item.title }),
    createElement("p", { class: "card-meta", text: [item.genres.slice(0, 2).join("·"), item.nation].filter(Boolean).join(" · ") || "정보 없음" }),
    createElement("p", { class: "card-meta", text: item.director ? `감독 ${item.director}` : item.year ? `${item.year}년 제작` : "" })
  );
}

// 로딩 중에 보이는 반짝이는 빈 상자를 만드는 함수 (count 개)
function createSkeletonCards(count) {
  return Array.from({ length: count }, () => createElement("div", { class: "skeleton-card" },
    createElement("div", { class: "skeleton skeleton-poster" }),
    createElement("div", { class: "skeleton skeleton-line" }),
    createElement("div", { class: "skeleton skeleton-line short" })
  ));
}
