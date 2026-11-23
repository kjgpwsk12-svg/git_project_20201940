// 주소(#/...)에 따라 알맞은 화면을 보여주는 간단한 라우터

// 주소 패턴과 화면 함수 연결표. 새 화면을 만들면 한 줄만 추가하면 된다.
//  - render(container, 주소에서 뽑은 값)는 화면 제목(문자열)을 돌려준다.
//  - full: true 이면 화면 폭 전체를 쓰는 화면(홈: 캐러셀이 헤더 뒤까지 닿는다). 아니면 가운데 정렬된 본문
const ROUTES = [
  { pattern: /^\/$/,                     nav: "home",    full: true, render: (container) => renderHomeView(container) },
  { pattern: /^\/kobis\/([^/]+)$/,       nav: "home",    render: (container, id) => renderKobisDetailView(container, id) },
  { pattern: /^\/movie\/([^/]+)$/,       nav: "home",    render: (container, id) => renderDetailView(container, id) },
  { pattern: /^\/search$/,               nav: "search",  render: (container) => renderSearchView(container) },
  { pattern: /^\/compare$/,              nav: "compare", render: (container) => renderCompareView(container) },
  { pattern: /^\/admin$/,                nav: "admin",   render: (container) => renderAdminView(container) },
  { pattern: /^\/admin\/new$/,           nav: "admin",   render: (container) => renderAdminEditView(container, null) },
  { pattern: /^\/admin\/edit\/([^/]+)$/, nav: "admin",   render: (container, id) => renderAdminEditView(container, id) }
];

// 현재 주소 경로를 읽는 함수 ("#/search?q=abc" → "/search")
function getCurrentPath() {
  const path = location.hash.replace(/^#/, "").split("?")[0];
  return path || "/";
}

// 현재 주소의 검색어 부분을 읽는 함수 ("#/search?q=abc" → q=abc)
function getCurrentQuery() {
  const index = location.hash.indexOf("?");
  return new URLSearchParams(index >= 0 ? location.hash.slice(index + 1) : "");
}

// 상단/하단 메뉴에서 현재 화면에 해당하는 항목을 강조하는 함수
function highlightNavigation(navName) {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const active = link.dataset.nav === navName;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
}

// 현재 주소에 맞는 화면을 그리는 함수
// scrollToTop: 맨 위로 이동할지 / animate: 화면 전환·등장 애니메이션을 재생할지(기본은 scrollToTop 과 같음)
function renderCurrentRoute(scrollToTop = true, animate = scrollToTop) {
  const container = document.getElementById("view");
  const path = getCurrentPath();
  clearElement(container);

  let title = "페이지를 찾을 수 없음";
  let navName = "";
  let isHome = false;
  const route = ROUTES.find((item) => item.pattern.test(path));
  if (route) {
    const match = path.match(route.pattern);
    // 홈은 화면 폭 전체, 나머지는 가운데 정렬된 본문(.container.page) 안에 그린다
    const target = route.full ? container : createElement("div", { class: "container page" });
    if (!route.full) container.appendChild(target);
    title = route.render(target, match[1] ? decodeURIComponent(match[1]) : undefined);
    navName = route.nav;
    isHome = !!route.full;
  } else {
    const page = createElement("div", { class: "container page" },
      createEmptyState("페이지를 찾을 수 없어요"),
      createElement("a", { class: "btn-primary", text: "홈으로", attrs: { href: "#/" } }));
    container.appendChild(page);
  }
  document.body.dataset.page = isHome ? "home" : "other";   // 헤더 모양을 화면에 맞게 바꾸는 용도 (CSS)
  document.title = `${title} - ${MOVIE_CONFIG.siteName}`;
  highlightNavigation(navName);
  if (animate) restartEnterAnimation(container);      // 화면 전환 애니메이션
  applyRevealEffects(container, !animate);            // 카드/패널 등장 효과 (다시 그리기일 땐 즉시 표시)
  if (scrollToTop) window.scrollTo(0, 0);
}

// 같은 화면을 다시 그리는 함수 (삭제/로그아웃 등 이후 사용, 스크롤 위치 유지)
function rerenderCurrentRoute() {
  const scrollY = window.scrollY;
  renderCurrentRoute(false);
  window.scrollTo(0, scrollY);
}

// 라우터 시작: 주소가 바뀔 때마다 화면을 다시 그린다
function startRouter() {
  window.addEventListener("hashchange", () => {
    renderCurrentRoute(true);
    document.getElementById("view").focus({ preventScroll: true });   // 키보드/스크린리더 사용자를 위해 포커스 이동
  });
  renderCurrentRoute(false, true);   // 첫 화면은 전환 애니메이션을 재생한다
}
