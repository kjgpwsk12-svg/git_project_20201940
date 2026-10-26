// 앱 골격: 사이드바(로고, 메뉴, 장 운영 상태, 계정), 상단바(검색, 날짜, 테마 스위치), 데모 안내, 푸터.
// 각 페이지는 #sidebar, #topbar, #footer 자리만 두고 initShell()을 호출한다.
import { marketStatus } from "/shared/market-hours.js";
import { getStatus } from "./api.js";
import { getMyProfile, getSupabase, signOut } from "./auth.js";
import { $, el, icon } from "./dom.js";
import { createSearch } from "./search.js";

/** 메뉴. 개발 단계에 따라 ready를 켠다. 준비 중인 메뉴는 "준비 중" 표시와 함께 비활성. */
export const MENU = [
  {
    label: "마켓",
    items: [
      { href: "/", label: "홈", icon: "home", ready: true },
      { href: "/stocks", label: "주식", icon: "candles", ready: true, match: ["/stocks", "/stock"] },
      { href: "/news", label: "뉴스", icon: "news", ready: true },
      { href: "/indicators", label: "경제지표", icon: "chart", ready: true },
      { href: "/events", label: "경제 일정", icon: "clock", ready: true },
      { href: "/map", label: "경제 지도", icon: "map", ready: true },
    ],
  },
  {
    label: "내 투자",
    items: [{ href: "/portfolio", label: "포트폴리오", icon: "briefcase", ready: true }],
  },
  {
    label: "커뮤니티",
    items: [
      { href: "/feed", label: "커뮤니티", icon: "users", ready: true, match: ["/feed", "/user"] },
      { href: "/board", label: "게시판", icon: "board", ready: true, match: ["/board", "/post", "/write"] },
    ],
  },
];

/** ECONOVA 로고 이미지 (흰 글자, 어두운 바탕용) */
export function logoImage(height = 30) {
  return el("img", { src: "/images/logo.webp", alt: "ECONOVA", height, style: `height:${height}px;width:auto;display:block` });
}

function isCurrent(item) {
  const path = location.pathname.replace(/\.html$/, "");
  if (item.href === "/") return path === "/" || path === "/index";
  return (item.match ?? [item.href]).some((p) => path === p);
}

export function initShell() {
  renderSidebar();
  renderTopbar();
  renderFooter();
  // 데이터 출처는 푸터에만 표시한다 (데모 안내 배너는 쓰지 않음)
  getStatus().then((s) => {
    const source = $("data-source");
    if (s && source) source.textContent = `시세: ${s.marketLabel}`;
  });
  renderAccount();
  // 화면 배너 오른쪽 아래 로고
  document.querySelectorAll("[data-hero-logo]").forEach((slot) => slot.replaceChildren(logoImage(26)));
}

// ----- 사이드바 -----

function renderSidebar() {
  const sidebar = $("sidebar");
  if (!sidebar) return;
  sidebar.className = "sidebar";

  const groups = MENU.map((group) =>
    el(
      "div",
      { class: "nav-group" },
      el("p", { class: "nav-label" }, group.label),
      el(
        "ul",
        {},
        ...group.items.map((item) =>
          el(
            "li",
            {},
            item.ready
              ? el("a", { class: "nav-item", href: item.href, "aria-current": isCurrent(item) ? "page" : null }, icon(item.icon, 18), item.label)
              : el(
                  "span",
                  { class: "nav-item", "aria-disabled": "true" },
                  icon(item.icon, 18),
                  item.label,
                  el("span", { class: "nav-soon" }, "준비 중"),
                ),
          ),
        ),
      ),
    ),
  );

  const status = el("div", { class: "market-status" });
  const drawStatus = () => {
    status.replaceChildren(
      ...["KR", "US"].map((market) => {
        const s = marketStatus(market);
        return el(
          "div",
          { class: "status-row", title: `${s.detail} · 공휴일 미반영` },
          el("span", {}, el("span", { class: `status-dot ${s.state}` }), el("strong", {}, market === "KR" ? "한국" : "미국")),
          el("span", {}, s.label),
        );
      }),
    );
  };
  drawStatus();
  setInterval(drawStatus, 60_000);

  sidebar.replaceChildren(
    el("a", { class: "brand", href: "/", "aria-label": "ECONOVA 홈" }, logoImage(30)),
    el("nav", { class: "nav", "aria-label": "주 메뉴" }, ...groups),
    el("div", { class: "sidebar-foot" }, status, el("div", { id: "side-account" })),
  );
}

function toggleSidebar(open) {
  const sidebar = $("sidebar");
  const button = document.querySelector(".menu-btn");
  sidebar.classList.toggle("open", open);
  button?.setAttribute("aria-expanded", String(open));
  document.querySelector(".scrim")?.remove();
  if (open) {
    document.body.append(el("div", { class: "scrim", onclick: () => toggleSidebar(false) }));
    sidebar.querySelector("a")?.focus();
  }
}

// ----- 상단바 -----

const isDark = () => document.documentElement.dataset.theme === "dark";

function renderTopbar() {
  const topbar = $("topbar");
  if (!topbar) return;
  topbar.className = "topbar";

  const knob = el("span", { class: "knob" });
  const themeSwitch = el("button", { class: "theme-switch", type: "button", role: "switch" }, knob);
  const drawTheme = () => {
    knob.replaceChildren(icon(isDark() ? "moon" : "sun", 13));
    themeSwitch.setAttribute("aria-checked", String(isDark()));
    themeSwitch.setAttribute("aria-label", "다크 모드");
  };
  themeSwitch.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    if (next === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("econova-theme", next);
    } catch {
      // 저장하지 못해도 현재 화면에는 적용된다
    }
    drawTheme();
    window.dispatchEvent(new CustomEvent("themechange"));
  });
  drawTheme();

  const today = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }).format(new Date());

  topbar.replaceChildren(
    el("a", { class: "sr-only", href: "#main" }, "본문으로 건너뛰기"),
    el(
      "button",
      {
        class: "icon-btn menu-btn",
        type: "button",
        "aria-label": "메뉴 열기",
        "aria-expanded": "false",
        "aria-controls": "sidebar",
        onclick: () => toggleSidebar(!$("sidebar").classList.contains("open")),
      },
      icon("menu", 18),
    ),
    createSearch(),
    el("div", { class: "topbar-actions" }, el("span", { class: "topbar-date num" }, today), themeSwitch, el("div", { id: "account", style: "display:flex;gap:4px" })),
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("sidebar")?.classList.contains("open")) toggleSidebar(false);
  });
}

/** 계정: 사이드바 아래 프로필, 상단바 로그아웃 버튼 */
async function renderAccount() {
  const side = $("side-account");
  const top = $("account");
  const client = await getSupabase();
  if (!client) return;

  const draw = async (user) => {
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search);
      side?.replaceChildren(
        el(
          "div",
          { class: "side-auth" },
          el("a", { class: "login", href: `/login?next=${next}` }, "로그인"),
          el("a", { class: "signup", href: "/signup" }, "회원가입"),
        ),
      );
      top?.replaceChildren();
      return;
    }
    const profile = await getMyProfile().catch(() => null);
    const name = profile?.nickname ?? "내 계정";
    side?.replaceChildren(
      el(
        "a",
        { class: "profile", href: "/mypage", title: "마이페이지" },
        el("span", { class: "avatar", "aria-hidden": "true" }, name.slice(0, 1)),
        el("span", {}, el("span", { class: "profile-name" }, name), el("span", { class: "profile-sub" }, profile?.role === "admin" ? "관리자" : "마이페이지")),
      ),
    );
    top?.replaceChildren(
      el("a", { class: "icon-btn", href: "/mypage", "aria-label": "마이페이지", title: "마이페이지" }, icon("user", 17)),
      el(
        "button",
        {
          class: "icon-btn",
          type: "button",
          "aria-label": "로그아웃",
          title: "로그아웃",
          onclick: async () => {
            await signOut();
            location.href = "/";
          },
        },
        icon("logout", 17),
      ),
    );
    window.dispatchEvent(new CustomEvent("profileloaded", { detail: profile }));
  };

  const { data } = await client.auth.getSession();
  await draw(data.session?.user ?? null);
  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") draw(session?.user ?? null);
  });
}

// ----- 푸터 -----

function renderFooter() {
  const footer = $("footer");
  if (!footer) return;
  footer.className = "footer";
  footer.replaceChildren(
    el("p", {}, el("span", { id: "data-source" }), " · 이 사이트의 정보는 참고용이며 투자 권유가 아닙니다. 시세는 지연되거나 부정확할 수 있습니다."),
    el(
      "p",
      { class: "footer-links" },
      el("span", {}, "© ECONOVA"),
      el("a", { href: "/terms" }, "이용약관"),
      el("a", { href: "/privacy" }, "개인정보 처리방침"),
    ),
  );
}
