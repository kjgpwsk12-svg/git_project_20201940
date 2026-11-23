// 개발/배포용 웹 서버 (외부 패키지 없이 Node.js 기본 기능만 사용)
//  - 화면 파일 제공: /(날씨), /movie/(영화)
//  - KOBIS(영화진흥위원회) API 중계: /api/...  ← 인증키는 서버(.env)에만 두고 브라우저에는 노출하지 않는다
const http = require("http");   // 웹 서버 기본 모듈
const fs = require("fs");       // 파일 읽기 기본 모듈
const path = require("path");   // 파일 경로 기본 모듈

// 서버 포트 번호 (환경변수 PORT가 있으면 그 값을 사용)
const PORT = process.env.PORT || 3000;
// 날씨 사이트 파일 폴더 / 영화 사이트 파일 폴더
const PUBLIC_DIR = path.join(__dirname, "public");
const MOVIE_DIR = path.join(__dirname, "movie");

// ---------- .env 파일에서 설정(KOBIS_KEY)을 읽는다 ----------
function loadEnvFile() {
  try {
    const lines = fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/);
    const entries = lines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))          // 빈 줄/주석 제외
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
      });
    return Object.fromEntries(entries);
  } catch (error) {
    return {};                                                                          // 파일이 없으면 빈 설정
  }
}
const ENV = loadEnvFile();
const KOBIS_KEY = process.env.KOBIS_KEY || ENV.KOBIS_KEY || "";

// ---------- KOBIS API 중계 설정 ----------
const KOBIS_BASE = "http://www.kobis.or.kr/kobisopenapi/webservice/rest";
// 허용하는 API 목록. allowed: 브라우저가 넘길 수 있는 파라미터, ttl: 서버 캐시 시간(밀리초)
const API_ROUTES = {
  "/api/boxoffice":        { path: "/boxoffice/searchDailyBoxOfficeList.json",  allowed: ["targetDt", "itemPerPage", "multiMovieYn", "repNationCd", "wideAreaCd"], ttl: 10 * 60 * 1000 },
  "/api/boxoffice-weekly": { path: "/boxoffice/searchWeeklyBoxOfficeList.json", allowed: ["targetDt", "weekGb", "itemPerPage", "multiMovieYn", "repNationCd", "wideAreaCd"], ttl: 30 * 60 * 1000 },
  "/api/movie-info":       { path: "/movie/searchMovieInfo.json",               allowed: ["movieCd"], ttl: 24 * 60 * 60 * 1000 },
  "/api/movie-list":       { path: "/movie/searchMovieList.json",               allowed: ["movieNm", "openStartDt", "openEndDt", "itemPerPage", "curPage", "repNationCd"], ttl: 60 * 60 * 1000 }
};
const apiCache = new Map();   // 같은 요청을 반복하지 않도록 잠시 기억 (KOBIS 호출 한도 보호)

// JSON 응답을 보내는 도우미
function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

// /api/... 요청을 KOBIS 로 전달하고 결과를 돌려주는 함수
async function handleApiRequest(requestUrl, response) {
  const route = API_ROUTES[requestUrl.pathname];
  if (!route) return sendJson(response, 404, { error: "NOT_FOUND" });
  if (!KOBIS_KEY) return sendJson(response, 503, { error: "KOBIS_KEY_MISSING" });   // 키가 설정되지 않음

  // 허용된 파라미터만 골라서 전달 (길이 제한으로 이상한 요청 차단)
  const params = new URLSearchParams();
  for (const name of route.allowed) {
    const value = requestUrl.searchParams.get(name);
    if (value === null) continue;
    if (value.length > 60) return sendJson(response, 400, { error: "BAD_PARAM" });
    params.set(name, value);
  }
  const cacheKey = route.path + "?" + params.toString();      // 키는 캐시 이름에 넣지 않는다
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return sendJson(response, 200, cached.data);

  params.set("key", KOBIS_KEY);                               // 인증키는 여기서만 붙인다
  try {
    const upstream = await fetch(`${KOBIS_BASE}${route.path}?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) return sendJson(response, 502, { error: "UPSTREAM_ERROR", status: upstream.status });
    const data = await upstream.json();
    if (data.faultInfo) return sendJson(response, 502, { error: "KOBIS_ERROR", message: data.faultInfo.message });
    apiCache.set(cacheKey, { data, expires: Date.now() + route.ttl });   // 성공한 결과만 캐시
    sendJson(response, 200, data);
  } catch (error) {
    sendJson(response, 504, { error: "TIMEOUT" });
  }
}

// ---------- 정적 파일 제공 ----------
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

// 요청이 들어올 때마다 실행되는 함수
function handleRequest(request, response) {
  const requestUrl = new URL(request.url, "http://localhost");
  // API 요청은 중계 함수로
  if (requestUrl.pathname.startsWith("/api/")) { handleApiRequest(requestUrl, response); return; }

  let urlPath = decodeURIComponent(requestUrl.pathname);
  // 영화 사이트(/movie/)는 movie 폴더에서 제공한다. "/movie" 는 상대 경로가 맞도록 "/movie/" 로 이동
  let rootDir = PUBLIC_DIR;
  if (urlPath === "/movie") {
    response.writeHead(301, { Location: "/movie/" });
    response.end();
    return;
  }
  if (urlPath.startsWith("/movie/")) {
    rootDir = MOVIE_DIR;
    urlPath = urlPath.slice("/movie".length);      // "/movie/css/a.css" → "/css/a.css"
  }
  const requestedFile = urlPath === "/" ? "/index.html" : urlPath;
  // 제공 폴더 밖으로 나가는 요청("../")은 차단
  const filePath = path.normalize(path.join(rootDir, requestedFile));
  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {                                   // 파일이 없으면 404
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("페이지를 찾을 수 없습니다.");
      return;
    }
    const type = CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream";
    // 개발 중 수정 내용이 바로 보이도록 캐시를 쓰지 않는다
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    response.end(content);
  });
}

// 서버를 시작하고 접속 주소를 안내
http.createServer(handleRequest).listen(PORT, () => {
  console.log(`날씨 웹사이트 실행 중: http://localhost:${PORT}`);
  console.log(`영화 웹사이트 실행 중: http://localhost:${PORT}/movie/`);
  console.log(KOBIS_KEY ? "KOBIS API 키: 설정됨" : "KOBIS API 키: 없음 (.env 에 KOBIS_KEY=... 를 넣어 주세요)");
});
