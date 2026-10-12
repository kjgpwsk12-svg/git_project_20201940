// 앱 골격: 사이드바(메뉴, 장 운영 상태), 상단바(검색, 테마, 계정), 데모 안내, 푸터.
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
      { href: "/", label: "경제 홈", icon: "home", ready: true },
      { href: "/stocks", label: "주식", icon: "candles", ready: true, match: ["/stocks", "/stock"] },
      { href: "/news", label: "뉴스", icon: "news", ready: false },
      { href: "/events", label: "경제 일정", icon: "clock", ready: false },
      { href: "/map", label: "경제 지도", icon: "map", ready: false },
    ],
  },
  {
    label: "내 투자",
    items: [{ href: "/calendar", label: "투자 캘린더", icon: "calendar", ready: false }],
  },
  {
    label: "커뮤니티",
    items: [
      { href: "/feed", label: "피드", icon: "users", ready: false },
      { href: "/board", label: "게시판", icon: "board", ready: false },
    ],
  },
];

function isCurrent(item) {
  const path = location.pathname.replace(/\.html$/, "");
  if (item.href === "/") return path === "/" || path === "/index";
  return (item.match ?? [item.href]).some((p) => path === p);
}

export function initShell() {
  renderSidebar();
  renderTopbar();
  renderFooter();
  getStatus().then((s) => {
    if (s?.isDemo) $("topbar").after(el("div", { class: "demo-banner", role: "status" }, "데모 모드 · 화면 확인용 가상 데이터입니다. 실제 시세와 기사가 아닙니다."));
    const source = $("data-source");
    if (s && source) source.textContent = `시세: ${s.marketLabel}`;
  });
  renderAccount();
}

// ----- 사이드바 -----

function renderSidebar() {
  const sidebar = $("sidebar");
  if (!sidebar) return;
  sidebar.className = "sidebar";
  sidebar.setAttribute("aria-label", "주 메뉴");

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
              ? el(
                  "a",
                  { class: "nav-item", href: item.href, "aria-current": isCurrent(item) ? "page" : null },
                  icon(item.icon),
                  item.label,
                )
              : el(
                  "span",
                  { class: "nav-item", "aria-disabled": "true" },
                  icon(item.icon),
                  item.label,
                  el("span", { class: "nav-soon" }, "준비 중"),
                ),
          ),
        ),
      ),
    ),
  );

  const status = el("div", { class: "market-status", "aria-live": "off" });
  const drawStatus = () => {
    status.replaceChildren(
      el("p", { class: "nav-label", style: "padding:0" }, "장 운영"),
      ...["KR", "US"].map((market) => {
        const s = marketStatus(market);
        return el(
          "div",
          { class: "status-row", title: `${s.detail} · 공휴일 미반영` },
          el("span", {}, el("span", { class: `status-dot ${s.state}` }), market === "KR" ? "한국" : "미국"),
          el("span", { class: s.state === "open" ? "" : "muted" }, s.label),
        );
      }),
    );
  };
  drawStatus();
  setInterval(drawStatus, 60_000);

  sidebar.replaceChildren(
    el(
      "a",
      { class: "brand", href: "/", "aria-label": "이코노바 홈" },
      el("span", { class: "brand-mark" }, icon("logo", 16)),
      el("span", {}, el("span", { class: "brand-name" }, "ECONOVA"), el("span", { class: "brand-sub" }, "이코노바 · 주식·경제 분석")),
    ),
    el("nav", { class: "nav", "aria-label": "주 메뉴" }, ...groups),
    el("div", { class: "sidebar-foot" }, status),
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

function currentTheme() {
  const set = document.documentElement.dataset.theme;
  if (set) return set;
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function renderTopbar() {
  const topbar = $("topbar");
  if (!topbar) return;
  topbar.className = "topbar";

  const themeButton = el("button", { class: "icon-btn", type: "button" });
  const drawTheme = () => {
    const theme = currentTheme();
    themeButton.replaceChildren(icon(theme === "dark" ? "sun" : "moon", 17));
    themeButton.setAttribute("aria-label", theme === "dark" ? "밝은 테마로 바꾸기" : "어두운 테마로 바꾸기");
  };
  themeButton.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("econova-theme", next);
    } catch {
      // 저장하지 못해도 현재 화면에는 적용된다
    }
    drawTheme();
    window.dispatchEvent(new CustomEvent("themechange"));
  });
  drawTheme();

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
    el("div", { class: "topbar-actions" }, themeButton, el("div", { id: "account", style: "display:flex;gap:8px" })),
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("sidebar")?.classList.contains("open")) toggleSidebar(false);
  });
}

/** 상단바 계정 영역: 로그인 상태에 따라 바뀐다 */
async function renderAccount() {
  const box = $("account");
  if (!box) return;
  const client = await getSupabase();
  if (!client) return;

  const draw = async (user) => {
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search);
      box.replaceChildren(
        el("a", { class: "btn ghost sm hide-sm", href: `/login?next=${next}` }, "로그인"),
        el("a", { class: "btn primary sm", href: "/signup" }, "회원가입"),
      );
      return;
    }
    const profile = await getMyProfile().catch(() => null);
    const name = profile?.nickname ?? "내 계정";
    box.replaceChildren(
      el(
        "a",
        { class: "account-chip", href: "/mypage", title: "마이페이지" },
        el("span", { class: "avatar", "aria-hidden": "true" }, name.slice(0, 1)),
        el("span", { class: "hide-sm" }, name),
      ),
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
