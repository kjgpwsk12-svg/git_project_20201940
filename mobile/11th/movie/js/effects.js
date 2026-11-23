// 애니메이션/시각 효과를 담당하는 파일.
// 화면 구성 코드(views)와 분리해 두어, 효과를 끄거나 바꾸고 싶을 때 이 파일만 고치면 된다.

// 사용자가 "움직임 줄이기"를 켰는지 (켜져 있으면 모든 효과를 최소화한다)
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 마우스를 올릴 수 있는 기기(PC)인지 (모바일 터치 기기에서는 기울임 효과를 쓰지 않는다)
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// ---------- 화면 전환 ----------

// 화면 전환 애니메이션(CSS의 view-enter)을 처음부터 다시 재생하는 함수
function restartEnterAnimation(element) {
  element.classList.remove("view-enter");
  void element.offsetWidth;                 // 브라우저가 클래스 제거를 인식하도록 강제로 계산시킨다
  element.classList.add("view-enter");
}

// ---------- 화면에 보일 때 나타나는 효과 ----------

// 요소가 화면에 보이는 순간 callback 을 한 번만 실행하는 함수
function observeOnce(element, callback) {
  if (!("IntersectionObserver" in window)) { callback(); return; }   // 지원 안 하면 바로 실행
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      callback();
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -4% 0px" });
  observer.observe(element);
}

// 숫자가 0에서 목표값까지 올라가는 효과 (data-count 속성이 있는 요소에 적용)
function animateCountUp(element) {
  const target = Number(element.dataset.count);
  if (isNaN(target) || prefersReducedMotion) return;
  const decimals = (element.dataset.count.split(".")[1] || "").length;   // 소수점 자리수 유지
  const duration = 900;
  const startTime = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);                         // 처음 빠르고 끝에서 느리게
    element.textContent = (target * eased).toFixed(decimals);
    if (progress < 1) requestAnimationFrame(step);
  };
  element.textContent = (0).toFixed(decimals);
  requestAnimationFrame(step);
}

// 화면 안의 카드/패널 등이 스크롤하면 차례로 떠오르게 만드는 함수.
// instant 가 true 면 애니메이션 없이 바로 보이게 한다 (삭제/비교 빼기 후 다시 그릴 때 깜빡임 방지)
function applyRevealEffects(root, instant = false) {
  const selector = ".movie-card, .kobis-card, .rank-card, .panel, .stat-card, .summary-tile, .feed-card, .review, .ext-link, .section-title, .detail-top, .table-scroll, .empty-state, .toolbar, .filter-bar";
  root.querySelectorAll(selector).forEach((element) => {
    if (element.classList.contains("reveal")) return;          // 이미 처리한 요소는 건너뜀
    element.classList.add("reveal");
    // 같은 부모 안에서의 순서에 따라 시간차(최대 8단계)를 준다
    const order = Array.prototype.indexOf.call(element.parentNode.children, element);
    element.style.setProperty("--i", String(Math.min(order, 8)));
    if (instant || prefersReducedMotion) { element.classList.add("in", "instant"); return; }
    observeOnce(element, () => element.classList.add("in"));
  });
  // 숫자 올라가는 효과
  root.querySelectorAll("[data-count]").forEach((element) => {
    if (element.dataset.counted) return;
    element.dataset.counted = "1";
    if (!instant) observeOnce(element, () => animateCountUp(element));
  });
  enableTiltEffect(root);
}

// ---------- 마우스에 따라 기울어지는 포스터 ----------

// 포스터에 마우스를 올리면 3D로 살짝 기울고 빛이 따라오는 효과 (PC 전용)
function enableTiltEffect(root) {
  if (!canHover || prefersReducedMotion) return;
  root.querySelectorAll(".card-poster, .hc-poster-wrap, .rank-poster").forEach((element) => {
    if (element.dataset.tilt) return;                          // 중복 연결 방지
    element.dataset.tilt = "1";
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;      // 0 ~ 1 (왼쪽 → 오른쪽)
      const y = (event.clientY - rect.top) / rect.height;      // 0 ~ 1 (위 → 아래)
      element.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
      element.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
      element.style.setProperty("--gx", `${x * 100}%`);        // 반짝이는 빛의 위치
      element.style.setProperty("--gy", `${y * 100}%`);
    });
    element.addEventListener("pointerleave", () => {
      element.style.setProperty("--rx", "0deg");
      element.style.setProperty("--ry", "0deg");
    });
  });
}

