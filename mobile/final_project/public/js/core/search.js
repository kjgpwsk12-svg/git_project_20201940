// 종목 검색 콤보박스. "/" 또는 Ctrl+K로 열고, 방향키로 이동, Enter로 종목 화면을 연다.
import { searchCatalog, symbolId } from "/shared/symbols.js";
import { el, icon } from "./dom.js";
import { marketBadge } from "./ui.js";

export function createSearch() {
  const listId = "global-search-results";
  const input = el("input", {
    type: "search",
    role: "combobox",
    "aria-expanded": "false",
    "aria-controls": listId,
    "aria-autocomplete": "list",
    "aria-label": "종목 검색",
    placeholder: "종목명·코드 검색 (삼성전자, AAPL)",
    autocomplete: "off",
  });
  const list = el("ul", { class: "search-results", id: listId, role: "listbox", hidden: true });
  const root = el("div", { class: "search" }, icon("search", 15), input, el("span", { class: "kbd" }, "/"), list);

  let results = [];
  let active = 0;

  const go = (index) => {
    const entry = results[index];
    if (entry) location.href = `/stock?id=${encodeURIComponent(symbolId(entry.symbol))}`;
  };

  const close = () => {
    results = [];
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };

  const render = () => {
    const query = input.value.trim();
    if (!query) return close();
    list.hidden = false;
    input.setAttribute("aria-expanded", String(results.length > 0));
    input.removeAttribute("aria-activedescendant");
    if (results.length === 0) {
      list.replaceChildren(el("li", { class: "empty-row", "aria-disabled": "true" }, "주요 종목 목록에서 찾지 못했어요."));
      return;
    }
    list.replaceChildren(
      ...results.map((entry, i) => {
        const id = `${listId}-${i}`;
        if (i === active) input.setAttribute("aria-activedescendant", id);
        return el(
          "li",
          {
            id,
            role: "option",
            "aria-selected": String(i === active),
            onmousedown: (e) => {
              e.preventDefault();
              go(i);
            },
            onmouseenter: () => {
              active = i;
              render();
            },
          },
          marketBadge(entry.symbol.market),
          el("span", { style: "font-weight:600" }, entry.name),
          el("span", { class: "sym-code", style: "margin-left:auto" }, entry.symbol.code),
        );
      }),
    );
  };

  input.addEventListener("input", () => {
    results = searchCatalog(input.value);
    active = 0;
    render();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      close();
      input.blur();
      return;
    }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = (active + 1) % results.length;
      render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = (active - 1 + results.length) % results.length;
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(active);
    }
  });

  input.addEventListener("blur", close);

  // 단축키: "/" 또는 Ctrl+K
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
    if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      input.focus();
    }
  });

  return root;
}
