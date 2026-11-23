// 메인 화면 맨 위의 "옆으로 넘기는 캐러셀"을 만드는 파일.
// 헤더(메뉴)가 이 캐러셀 위에 겹쳐 보이도록 화면 폭 전체를 사용한다.
//
// 슬라이드 한 장의 데이터 모양(item):
// {
//   eyebrow: "박스오피스 1위 · 2026.11.15 기준",   // 제목 위 작은 문구
//   title:   "영화 제목",
//   meta:    "2026.09.30 개봉 · 개봉 47일째",       // 제목 아래 한 줄 정보
//   stats:   [{ label: "일 관객", value: "4.6만" }], // 수치 칸 (여러 개)
//   rank:    1,                                      // 큰 순위 숫자 (없으면 null)
//   href:    "#/kobis/20261807",                     // 상세 화면 주소
//   poster:  { title, posterColors, posterUrl },     // 오른쪽 포스터용 정보
//   compare: { id, title } 또는 null                 // 비교 담기 버튼용 정보
// }

// 자동으로 다음 슬라이드로 넘어가는 간격(밀리초)
const HERO_SLIDE_MS = 7000;

// 로딩 중에 보여주는 빈 캐러셀 (데이터가 오면 교체된다)
function createHeroSkeleton() {
  return createElement("section", { class: "hero-carousel hero-skeleton", attrs: { "aria-busy": "true", "aria-label": "추천 영화 불러오는 중" } },
    createElement("div", { class: "container hc-inner" },
      createElement("div", { class: "hc-content" },
        createElement("div", { class: "skeleton skeleton-line short" }),
        createElement("div", { class: "skeleton skeleton-title" }),
        createElement("div", { class: "skeleton skeleton-line" }),
        createElement("div", { class: "skeleton skeleton-line short" })
      )
    )
  );
}

// 슬라이드 한 장을 만드는 함수
function createHeroSlide(item) {
  const [colorA, colorB] = item.poster.posterColors;
  // 제목을 글자 단위로 나눠 하나씩 떠오르게 한다 (스크린리더는 aria-label 로 전체 제목을 읽는다)
  const title = createElement("h2", { class: "hc-title", attrs: { "aria-label": item.title } },
    ...[...item.title].map((char, i) => createElement("span", {
      class: "hc-char", text: char === " " ? " " : char, attrs: { "aria-hidden": "true" }, style: { "--d": String(Math.min(i, 30)) }
    })));

  // 수치 칸들
  const stats = createElement("div", { class: "hc-stats" },
    ...item.stats.map((stat) => createElement("div", { class: "hc-stat" },
      createElement("strong", { text: stat.value }),
      createElement("span", { text: stat.label }))));

  const actions = createElement("div", { class: "hc-actions" },
    createElement("a", { class: "btn-primary", text: "상세 정보 보기", attrs: { href: item.href } }),
    item.compare ? createCompareButton(item.compare.id, item.compare.title) : null
  );

  return createElement("div", { class: "hc-slide", style: { "--a": colorA, "--b": colorB } },
    createElement("div", { class: "hc-backdrop" }),                                        // 색상 배경
    item.rank ? createElement("div", { class: "hc-watermark", text: String(item.rank), attrs: { "aria-hidden": "true" } }) : null, // 거대한 순위 글자
    createElement("div", { class: "hc-shade" }),                                          // 글자가 읽히도록 어둡게
    createElement("div", { class: "container hc-inner" },
      createElement("div", { class: "hc-content" },
        createElement("span", { class: "hc-eyebrow", text: item.eyebrow }),
        title,
        createElement("p", { class: "hc-meta", text: item.meta }),
        stats,
        actions
      ),
      createElement("div", { class: "hc-poster-wrap" },
        createPoster(item.poster),
        item.rank ? createElement("span", { class: "hc-rank-badge", text: `${item.rank}위` }) : null)
    )
  );
}

// 캐러셀 전체를 만드는 함수. 마우스 드래그, 터치 스와이프, 화살표, 키보드, 자동 넘김을 지원한다
function createHeroCarousel(items) {
  const slides = items.map(createHeroSlide);
  const track = createElement("div", { class: "hc-track" }, ...slides);
  const viewport = createElement("div", { class: "hc-viewport" }, track);

  // 하단 진행 막대(점)
  const dots = items.map((item, index) => createElement("button", {
    class: "hc-dot", attrs: { type: "button", "aria-label": `${index + 1}번째: ${item.title}` },
    on: { click: () => { goTo(index); startAutoPlay(); } }
  }, createElement("span")));

  // 오른쪽 아래 "다음 영화" 미리보기 목록
  const nextList = createElement("div", { class: "hc-next-list" });
  const nextPanel = createElement("aside", { class: "hc-next", attrs: { "aria-label": "다음 추천 영화" } },
    createElement("p", { class: "hc-next-title", text: "NEXT UP" }), nextList);

  const root = createElement("section", {
    class: "hero-carousel", attrs: { "aria-roledescription": "carousel", "aria-label": "추천 영화", tabindex: "0" },
    style: { "--slide-ms": `${HERO_SLIDE_MS}ms` }
  },
    viewport,
    createElement("button", { class: "hc-arrow hc-prev", text: "‹", attrs: { type: "button", "aria-label": "이전 영화" }, on: { click: () => { goTo(index - 1); startAutoPlay(); } } }),
    createElement("button", { class: "hc-arrow hc-next-btn", text: "›", attrs: { type: "button", "aria-label": "다음 영화" }, on: { click: () => { goTo(index + 1); startAutoPlay(); } } }),
    createElement("div", { class: "hc-dots" }, ...dots),
    items.length > 1 ? nextPanel : null
  );

  let index = 0;          // 지금 보이는 슬라이드 번호
  let timerId = null;     // 자동 넘김 타이머
  let dragging = false;   // 드래그 중인지
  let dragMoved = false;  // 실제로 움직였는지 (클릭과 구분)
  let startX = 0;
  let deltaX = 0;

  // 트랙 위치를 현재 번호(+ 드래그 이동량)에 맞추는 함수
  function updatePosition(extraPixels = 0) {
    track.style.transform = `translate3d(calc(${-index * 100}% + ${extraPixels}px), 0, 0)`;
  }

  // 다음 영화 미리보기 목록을 현재 번호 기준으로 다시 그리는 함수 (현재 다음 3편)
  function renderNextList() {
    clearElement(nextList);
    for (let step = 1; step <= Math.min(3, items.length - 1); step++) {
      const target = (index + step) % items.length;
      const item = items[target];
      nextList.appendChild(createElement("button", {
        class: "hc-next-item", attrs: { type: "button" },
        on: { click: () => { goTo(target); startAutoPlay(); } }
      },
        createElement("span", { class: "hc-next-rank", text: item.rank ? String(item.rank) : "•" }),
        createElement("span", { class: "hc-next-name", text: item.title }),
        createElement("span", { class: "hc-next-info", text: item.stats[0] ? `${item.stats[0].label} ${item.stats[0].value}` : "" })
      ));
    }
  }

  // n번째 슬라이드로 이동하는 함수 (끝에서는 처음으로 이어서 돈다)
  function goTo(target) {
    index = (target + slides.length) % slides.length;
    updatePosition(0);
    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === index);                  // 활성 슬라이드만 등장 애니메이션
      slide.setAttribute("aria-hidden", String(i !== index));
      slide.querySelectorAll("a, button").forEach((control) => { control.tabIndex = i === index ? 0 : -1; });
    });
    dots.forEach((dot, i) => {
      dot.classList.remove("active");
      if (i === index) { void dot.offsetWidth; dot.classList.add("active"); }   // 진행 막대 애니메이션 재시작
    });
    renderNextList();
  }

  // 자동 넘김 시작/정지
  function stopAutoPlay() { clearInterval(timerId); timerId = null; }
  function startAutoPlay() {
    stopAutoPlay();
    if (slides.length < 2 || prefersReducedMotion) return;
    timerId = setInterval(() => {
      if (!root.isConnected) { stopAutoPlay(); return; }               // 다른 화면으로 가면 정리
      if (document.hidden) return;                                      // 탭이 숨겨져 있으면 넘기지 않음
      goTo(index + 1);
    }, HERO_SLIDE_MS);
  }

  // ---- 드래그/스와이프 ----
  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;   // 마우스 왼쪽 버튼만
    dragging = true; dragMoved = false; startX = event.clientX; deltaX = 0;
    stopAutoPlay();
  });
  window.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    deltaX = event.clientX - startX;
    if (Math.abs(deltaX) > 6) {                                         // 조금 이상 움직여야 드래그로 인정
      dragMoved = true;
      track.classList.add("dragging");                                  // 드래그 중에는 부드러운 전환 끄기
      updatePosition(deltaX);
    }
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("dragging");
    if (dragMoved && Math.abs(deltaX) > viewport.clientWidth * 0.15) goTo(index + (deltaX < 0 ? 1 : -1));   // 충분히 밀었으면 넘김
    else updatePosition(0);                                             // 아니면 제자리
    startAutoPlay();
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  // 드래그 직후에는 링크가 눌리지 않게 막는다
  viewport.addEventListener("click", (event) => { if (dragMoved) { event.preventDefault(); event.stopPropagation(); dragMoved = false; } }, true);
  viewport.addEventListener("dragstart", (event) => event.preventDefault());   // 이미지/링크 기본 끌기 방지

  // 키보드 좌우 방향키
  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") { goTo(index - 1); startAutoPlay(); }
    if (event.key === "ArrowRight") { goTo(index + 1); startAutoPlay(); }
  });
  // 마우스를 올려두면 멈춘다
  root.addEventListener("mouseenter", () => { root.classList.add("paused"); stopAutoPlay(); });
  root.addEventListener("mouseleave", () => { root.classList.remove("paused"); goTo(index); startAutoPlay(); });

  goTo(0);
  startAutoPlay();
  return root;
}
