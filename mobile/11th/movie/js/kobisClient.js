// KOBIS(영화진흥위원회) 데이터를 불러와 화면에서 쓰기 좋은 모양으로 바꾸는 파일.
// 브라우저는 인증키를 모른다. 우리 서버(server.js)의 /api/... 주소만 호출한다.
// → 다른 데이터 출처(TMDB 등)로 바꾸고 싶으면 이 파일의 함수들이 같은 모양의 결과를 돌려주도록 교체하면 된다.

// 불러온 박스오피스 항목을 영화코드별로 기억해 두는 메모리 (상세/비교 화면에서 재사용)
const kobisMemory = { entries: new Map() };

// ---------- 서버 API 호출 ----------

// 서버의 /api/<endpoint> 를 호출해 JSON 을 돌려주는 함수. 실패하면 code 가 붙은 오류를 던진다
//  code: NETWORK(서버 연결 실패) / NO_KEY(인증키 없음) / API(KOBIS 오류)
async function callKobisApi(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  let response;
  try {
    response = await fetch(`/api/${endpoint}?${query}`);
  } catch (error) {
    throw Object.assign(new Error("서버에 연결할 수 없습니다."), { code: "NETWORK" });
  }
  if (response.status === 503) throw Object.assign(new Error("KOBIS 인증키가 설정되지 않았습니다."), { code: "NO_KEY" });
  if (!response.ok) throw Object.assign(new Error("KOBIS 데이터를 가져오지 못했습니다."), { code: "API" });
  return response.json();
}

// 오류 코드에 맞는 사용자 안내 문구를 만드는 함수
function describeKobisError(error) {
  if (error.code === "NO_KEY") return "KOBIS 인증키가 설정되지 않았어요. 프로젝트 폴더의 .env 파일에 KOBIS_KEY 를 넣고 서버를 다시 시작해 주세요.";
  if (error.code === "NETWORK") return "서버에 연결하지 못했어요. npm start 로 서버를 켠 뒤 http://localhost:3000/movie/ 로 열어 주세요.";
  return "실시간 박스오피스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
}

// ---------- 박스오피스 ----------

// 박스오피스 기간 종류 → 호출 정보 (새 기간을 추가하려면 한 줄 추가)
const BOXOFFICE_PERIODS = {
  daily:   { label: "일별",  endpoint: "boxoffice",        extra: {},             listKey: "dailyBoxOfficeList",  defaultDaysAgo: 1 },
  weekly:  { label: "주간",  endpoint: "boxoffice-weekly", extra: { weekGb: "0" }, listKey: "weeklyBoxOfficeList", defaultDaysAgo: 7 },
  weekend: { label: "주말",  endpoint: "boxoffice-weekly", extra: { weekGb: "1" }, listKey: "weeklyBoxOfficeList", defaultDaysAgo: 7 }
};

// 기간 종류에 맞는 기본 조회 날짜(어제 또는 일주일 전)를 돌려주는 함수
function getDefaultBoxOfficeDate(period) {
  return addDaysToText(toDateText(getToday()), -BOXOFFICE_PERIODS[period].defaultDaysAgo);
}

// KOBIS 박스오피스 한 줄을 화면에서 쓰기 쉬운 모양(숫자 변환 포함)으로 바꾸는 함수
function normalizeBoxOfficeEntry(raw) {
  return {
    movieCd: raw.movieCd,
    title: raw.movieNm,
    rank: Number(raw.rank),
    rankChange: Number(raw.rankInten),             // 전일 대비 순위 증감 (+면 상승)
    isNew: raw.rankOldAndNew === "NEW",            // 신규 진입 여부
    openDate: raw.openDt,                          // "2026-09-30"
    sales: Number(raw.salesAmt),                   // 매출액
    salesShare: Number(raw.salesShare),            // 매출 점유율(%)
    salesChange: Number(raw.salesChange),          // 매출 증감률(%)
    salesAcc: Number(raw.salesAcc),                // 누적 매출
    audience: Number(raw.audiCnt),                 // 관객수
    audienceDelta: Number(raw.audiInten),          // 관객수 증감(명)
    audienceChange: Number(raw.audiChange),        // 관객수 증감률(%)
    audienceAcc: Number(raw.audiAcc),              // 누적 관객수
    screens: Number(raw.scrnCnt),                  // 스크린 수
    shows: Number(raw.showCnt),                    // 상영 횟수
    posterColors: makePosterColors(raw.movieNm),
    posterUrl: ""
  };
}

// 박스오피스를 조회하는 함수.
// options: { period: daily|weekly|weekend, date: "YYYY-MM-DD", nation: ""|K|F, multi: ""|Y|N }
// 결과: { rangeText: "2026.11.15", list: [항목...] }
async function fetchBoxOffice(options) {
  const period = BOXOFFICE_PERIODS[options.period] || BOXOFFICE_PERIODS.daily;
  const params = { ...period.extra, targetDt: options.date.replaceAll("-", ""), itemPerPage: "10" };
  if (options.nation) params.repNationCd = options.nation;      // K 한국 / F 외국
  if (options.multi) params.multiMovieYn = options.multi;       // Y 다양성 / N 상업
  const data = await callKobisApi(period.endpoint, params);

  const result = data.boxOfficeResult || {};
  const list = (result[period.listKey] || []).map(normalizeBoxOfficeEntry);
  list.forEach((entry) => kobisMemory.entries.set(entry.movieCd, entry));      // 기억해 두기
  // "20261115~20261115" → "2026.11.15" 또는 "2026.11.09 ~ 2026.11.15"
  const [from, to] = String(result.showRange || "").split("~").map(kobisDateToText);
  const rangeText = from && to && from !== to ? `${formatDate(from)} ~ ${formatDate(to)}` : formatDate(from || options.date);
  return { rangeText, list };
}

// ---------- 영화 목록 / 검색 ----------

// "12세이상관람가" 같은 등급 이름을 짧게 줄이는 함수
function shortenAgeRating(name) {
  if (!name) return "미정";
  if (name.includes("전체")) return "전체";
  if (name.includes("12")) return "12세";
  if (name.includes("15")) return "15세";
  if (name.includes("청소년관람불가") || name.includes("18") || name.includes("19")) return "19세";
  return name;
}

// 영화 목록 API 의 한 줄을 카드용 모양으로 바꾸는 함수
function normalizeMovieListItem(raw) {
  return {
    movieCd: raw.movieCd,
    title: raw.movieNm,
    titleEn: raw.movieNmEn || "",
    year: raw.prdtYear,
    openDate: kobisDateToText(raw.openDt),
    genres: String(raw.genreAlt || "").split(",").map((g) => g.trim()).filter(Boolean),
    nation: raw.nationAlt || raw.repNationNm || "",
    director: (raw.directors && raw.directors[0] && raw.directors[0].peopleNm) || "",
    productionStatus: raw.prdtStatNm || "",
    type: raw.typeNm || "",
    posterColors: makePosterColors(raw.movieNm),
    posterUrl: ""
  };
}

// 앞으로 개봉할 영화 목록(개봉예정작)을 가져오는 함수.
// KOBIS 영화 목록 API 는 개봉일 조건을 "연도(YYYY)" 단위로만 받으므로, 올해(필요하면 내년) 목록을 받아 오늘 이후 개봉작만 골라낸다
async function fetchUpcomingMovies(daysAhead = 60) {
  const today = toDateText(getToday());
  const limit = addDaysToText(today, daysAhead);
  const years = [...new Set([today.slice(0, 4), limit.slice(0, 4)])];             // 기간이 해를 넘기면 내년도 함께 조회
  const responses = await Promise.all(years.map((year) =>
    callKobisApi("movie-list", { openStartDt: year, openEndDt: year, itemPerPage: "100" })));
  const list = responses.flatMap((data) => (data.movieListResult && data.movieListResult.movieList) || []).map(normalizeMovieListItem);
  return list
    .filter((movie) => movie.type === "장편" && movie.openDate > today && movie.openDate <= limit)   // 장편 + 기간 내 개봉
    .filter((movie) => !movie.genres.includes("성인물(에로)"))
    .sort((a, b) => a.openDate.localeCompare(b.openDate))
    .slice(0, 14);
}

// 영화 제목으로 검색하는 함수
async function searchKobisMovies(keyword) {
  const data = await callKobisApi("movie-list", { movieNm: keyword, itemPerPage: "30" });
  const list = ((data.movieListResult && data.movieListResult.movieList) || []).map(normalizeMovieListItem);
  // 개봉일이 있는 작품을 먼저, 그 안에서는 최신순
  return list.sort((a, b) => b.openDate.localeCompare(a.openDate));
}

// ---------- 영화 상세 ----------

// 영화 제목으로 만든 기본 관련 사이트 목록 (예매처 첫 화면 + 제목 검색 링크). 작품별 주소는 운영자가 교체할 수 있다
function buildDefaultLinks(title) {
  const checkedAt = toDateText(new Date());
  return [
    { type: "예매", label: "CGV에서 예매", source: "CGV", url: "https://www.cgv.co.kr", checkedAt },
    { type: "예매", label: "롯데시네마에서 예매", source: "롯데시네마", url: "https://www.lottecinema.co.kr", checkedAt },
    { type: "예매", label: "메가박스에서 예매", source: "메가박스", url: "https://www.megabox.co.kr", checkedAt },
    { type: "공식 정보", label: "영화관입장권통합전산망", source: "KOBIS", url: "https://www.kobis.or.kr", checkedAt },
    { type: "평가 원문", label: `"${title}" 평점·후기 검색`, source: "네이버 검색", url: `https://search.naver.com/search.naver?query=${encodeURIComponent(title + " 평점")}`, checkedAt },
    { type: "예고편", label: `"${title}" 예고편 검색`, source: "YouTube", url: `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " 예고편")}`, checkedAt }
  ];
}

// KOBIS 영화 상세 응답을 앞에서 쓰던 "영화 객체" 모양으로 바꾸는 함수
function normalizeMovieInfo(info, boxOfficeEntry) {
  const releaseDate = kobisDateToText(info.openDt) || (boxOfficeEntry ? boxOfficeEntry.openDate : "");
  const daysSinceOpen = releaseDate ? -diffInDays(getToday(), parseDateText(releaseDate)) : 9999;
  // 상영 상태: 개봉 전 / 박스오피스에 있거나 개봉 60일 이내 = 상영중 / 그 외 종영
  let status = "ended";
  if (releaseDate && daysSinceOpen < 0) status = "upcoming";
  else if (boxOfficeEntry || daysSinceOpen <= 60) status = "showing";
  return {
    id: `k-${info.movieCd}`,
    kobisCd: info.movieCd,
    title: info.movieNm,
    originalTitle: info.movieNmEn || info.movieNmOg || "",
    status,
    releaseDate,
    runtime: Number(info.showTm) || 0,
    ageRating: shortenAgeRating(info.audits && info.audits[0] && info.audits[0].watchGradeNm),
    genres: (info.genres || []).map((genre) => genre.genreNm),
    director: (info.directors || []).map((person) => person.peopleNm).slice(0, 2).join(", "),
    cast: (info.actors || []).map((person) => person.peopleNm).slice(0, 8),
    nations: (info.nations || []).map((nation) => nation.nationNm),
    distributors: (info.companys || []).filter((company) => company.companyPartNm === "배급사").map((company) => company.companyNm),
    synopsis: "",
    posterColors: makePosterColors(info.movieNm),
    posterUrl: "",
    ratings: [],
    reviews: [],
    links: buildDefaultLinks(info.movieNm),
    boxOffice: boxOfficeEntry || null
  };
}

// 영화코드로 상세 정보를 가져오는 함수.
// 운영자가 같은 영화를 관리 목록에 등록해 두었다면 그 평점·작품평·링크·줄거리·포스터를 합친다
async function getKobisMovie(movieCd) {
  const data = await callKobisApi("movie-info", { movieCd });
  const info = data.movieInfoResult && data.movieInfoResult.movieInfo;
  if (!info) throw Object.assign(new Error("영화 정보를 찾을 수 없습니다."), { code: "API" });

  // 박스오피스 기억이 없으면 오늘의 일별 순위를 한 번 불러와 순위 정보를 채운다 (실패해도 무시)
  if (kobisMemory.entries.size === 0) {
    try { await fetchBoxOffice({ period: "daily", date: getDefaultBoxOfficeDate("daily") }); } catch (error) { /* 무시 */ }
  }
  const movie = normalizeMovieInfo(info, kobisMemory.entries.get(movieCd));

  const managed = findMovieByKobisCd(movieCd);       // 운영자가 등록한 정보
  if (managed) {
    movie.managedId = managed.id;
    movie.ratings = managed.ratings || [];
    movie.reviews = managed.reviews || [];
    if (managed.links && managed.links.length > 0) movie.links = managed.links;
    if (managed.synopsis) movie.synopsis = managed.synopsis;
    if (managed.posterUrl) movie.posterUrl = managed.posterUrl;
  }
  return movie;
}
