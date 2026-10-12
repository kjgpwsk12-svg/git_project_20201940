// 관심 종목. 로그인하면 계정(DB, 본인만 접근)에, 로그인하지 않으면 이 브라우저에 저장한다.
import { parseSymbolId, symbolId } from "/shared/symbols.js";
import { getSupabase, getUser, koreanError } from "./auth.js";

const STORAGE_KEY = "econova-watchlist";
const DEFAULT_LOCAL = ["KR.005930", "KR.000660", "US.NAS.AAPL", "US.NAS.NVDA"];

let ids = [];
let mode = "local";
let loading = null;
const listeners = new Set();

function sanitize(value) {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.map(parseSymbolId).filter(Boolean).map(symbolId))];
}

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? [...DEFAULT_LOCAL] : (sanitize(JSON.parse(raw)) ?? [...DEFAULT_LOCAL]);
  } catch {
    return [...DEFAULT_LOCAL];
  }
}

function writeLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 저장 공간이 막힌 환경에서도 현재 화면은 동작하게 둔다
  }
}

const notify = () => listeners.forEach((fn) => fn(ids));

async function load() {
  const client = await getSupabase();
  const user = client ? await getUser() : null;
  if (!user) {
    mode = "local";
    ids = readLocal();
    return;
  }
  mode = "db";
  const { data, error } = await client.from("watchlists").select("symbol_id").order("position").order("created_at");
  if (error) throw new Error(koreanError(error));
  ids = sanitize(data.map((r) => r.symbol_id)) ?? [];
}

/** 처음 한 번 불러온다. 로그인 상태가 바뀌면 다시 불러온다. */
export function initWatchlist() {
  loading ??= (async () => {
    await load();
    const client = await getSupabase();
    client?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") load().then(notify).catch(console.error);
    });
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY && mode === "local") {
        ids = readLocal();
        notify();
      }
    });
  })();
  return loading;
}

export const watchlistIds = () => ids;
export const watchlistMode = () => mode;
export const isWatched = (id) => ids.includes(id);

export function onWatchlistChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function addToWatchlist(id) {
  await initWatchlist();
  if (ids.includes(id)) return;
  if (mode === "db") {
    const client = await getSupabase();
    const { error } = await client.from("watchlists").insert({ symbol_id: id, position: ids.length });
    if (error) throw new Error(koreanError(error));
  }
  ids = [...ids, id];
  if (mode === "local") writeLocal();
  notify();
}

export async function removeFromWatchlist(id) {
  await initWatchlist();
  if (mode === "db") {
    const client = await getSupabase();
    const { error } = await client.from("watchlists").delete().eq("symbol_id", id);
    if (error) throw new Error(koreanError(error));
  }
  ids = ids.filter((x) => x !== id);
  if (mode === "local") writeLocal();
  notify();
}

export async function toggleWatchlist(id) {
  return isWatched(id) ? removeFromWatchlist(id) : addToWatchlist(id);
}
