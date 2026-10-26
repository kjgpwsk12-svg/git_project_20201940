// 관련 종목 고르기: 입력하면 종목 목록에서 찾아 하나를 고른다 (글쓰기, 피드에서 사용)
import { findCatalogEntry, parseSymbolId, searchCatalog, symbolId } from "/shared/symbols.js";
import { el, icon } from "../core/dom.js";

const codeText = (symbol) => (symbol.market === "US" ? `${symbol.exchange} · ${symbol.code}` : symbol.code);

/**
 * @param {HTMLElement} container 비어 있는 자리. 입력창과 목록을 여기에 만든다.
 * @param {{ id: string, initialId?: string | null, placeholder?: string, compact?: boolean, onChange?: () => void }} options
 *   id: 입력창 id (label의 for와 맞춘다)
 */
export function createStockPicker(container, { id, initialId = null, placeholder = "종목명·코드 (예: 삼성전자, AAPL)", compact = false, onChange }) {
  const listId = `${id}-options`;
  const input = el("input", {
    class: `input${compact ? " sm" : ""}`,
    id,
    autocomplete: "off",
    role: "combobox",
    "aria-expanded": "false",
    "aria-controls": listId,
    "aria-autocomplete": "list",
    placeholder,
  });
  const options = el("ul", { class: "stock-options", id: listId, role: "listbox", "aria-label": "종목 검색 결과", hidden: true });
  const picker = el("div", { class: "stock-picker" }, input, options);
  const selectedBox = el("div", { class: "stock-selected-box" });
  container.replaceChildren(picker, selectedBox);

  let selected = initialId && parseSymbolId(initialId) ? initialId : null;
  let results = [];
  let active = -1;

  const close = () => {
    options.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  };

  const choose = (value) => {
    selected = value;
    input.value = "";
    close();
    paintSelected();
    onChange?.();
  };

  function paintSelected() {
    picker.hidden = Boolean(selected);
    if (!selected) {
      selectedBox.replaceChildren();
      return;
    }
    const symbol = parseSymbolId(selected);
    const name = findCatalogEntry(symbol)?.name ?? symbol.code;
    selectedBox.replaceChildren(
      el(
        "span",
        { class: `stock-selected${compact ? " sm" : ""}` },
        el("span", {}, name, el("small", {}, ` ${codeText(symbol)}`)),
        el(
          "button",
          {
            class: "icon-btn",
            type: "button",
            "aria-label": `관련 종목 ${name} 빼기`,
            onclick: () => {
              choose(null);
              input.focus();
            },
          },
          icon("x", 14),
        ),
      ),
    );
  }

  function paintOptions() {
    options.replaceChildren(
      ...(results.length
        ? results.map((entry, i) =>
            el(
              "li",
              {
                id: `${listId}-${i}`,
                role: "option",
                "aria-selected": String(i === active),
                onmousedown: (event) => {
                  event.preventDefault();
                  choose(symbolId(entry.symbol));
                },
              },
              entry.name,
              el("small", {}, codeText(entry.symbol)),
            ),
          )
        : [el("li", { class: "empty-option" }, "목록에 없는 종목이에요.")]),
    );
    options.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (active >= 0) input.setAttribute("aria-activedescendant", `${listId}-${active}`);
    else input.removeAttribute("aria-activedescendant");
  }

  input.addEventListener("input", () => {
    results = searchCatalog(input.value, 6);
    active = results.length ? 0 : -1;
    if (!input.value.trim()) close();
    else paintOptions();
  });
  input.addEventListener("keydown", (event) => {
    if (options.hidden) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      active = (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      paintOptions();
    } else if (event.key === "Enter") {
      event.preventDefault(); // 종목을 고르는 Enter로 글이 등록되지 않게
      if (results[active]) choose(symbolId(results[active].symbol));
    } else if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  });
  input.addEventListener("blur", close);

  paintSelected();
  return {
    value: () => selected,
    clear: () => {
      selected = null;
      input.value = "";
      close();
      paintSelected();
    },
  };
}
