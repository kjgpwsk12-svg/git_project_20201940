// 앱 시작 파일: 헤더 효과, 비교 막대, 라우터를 시작한다

// 화면 아래 "비교 담기 막대"를 현재 담긴 영화에 맞게 다시 그리는 함수
function renderCompareBar() {
  const bar = document.getElementById("compare-bar");
  const items = getCompareItems();
  // 담긴 영화가 없거나, 이미 비교 화면이면 숨긴다
  if (items.length === 0 || getCurrentPath() === "/compare") { bar.hidden = true; return; }

  clearElement(bar);
  bar.appendChild(createElement("div", { class: "compare-bar-items" },
    ...items.map((item) => createElement("span", { class: "compare-pill" },
      item.title,
      createElement("button", { class: "pill-remove", text: "×", attrs: { type: "button", "aria-label": `${item.title} 빼기` },
        on: { click: () => toggleCompare(item.id, item.title) } })
    ))
  ));
  bar.appendChild(createElement("a", { class: "btn-primary", text: `비교하기 (${items.length})`, attrs: { href: "#/compare" } }));
  bar.hidden = false;
}

// 스크롤하면 헤더 배경이 생기게 하는 함수 (맨 위에서는 캐러셀 위에 투명하게 겹쳐 보인다)
function updateHeaderOnScroll() {
  document.getElementById("site-header").classList.toggle("scrolled", window.scrollY > 24);
}

// 앱 시작 함수
function startApp() {
  window.addEventListener("compare-changed", renderCompareBar);  // 담기가 바뀌면 막대 갱신
  window.addEventListener("hashchange", renderCompareBar);       // 화면이 바뀌면 막대 갱신
  window.addEventListener("scroll", updateHeaderOnScroll, { passive: true });
  updateHeaderOnScroll();
  startRouter();                                                 // 첫 화면 그리기
  renderCompareBar();                                            // 막대 첫 표시
}

// 페이지가 준비되면 시작
document.addEventListener("DOMContentLoaded", startApp);
