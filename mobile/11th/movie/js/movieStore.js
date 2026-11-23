// 영화 데이터 저장/조회와 이용 통계를 담당하는 파일.
// 화면(view)은 이 파일의 함수만 호출한다. → 나중에 서버 API로 바꿀 때 "데이터 소스" 부분만 교체하면 된다.

// ---------- 데이터 소스 (현재: 브라우저 localStorage + 샘플 데이터) ----------
// 서버 API로 교체하려면 load()/save() 를 fetch 호출로 바꾸면 된다.
const movieDataSource = {
  // 영화 목록을 불러오는 함수 (저장된 값이 없거나 깨졌으면 샘플 데이터 복사본)
  load() {
    try {
      const saved = localStorage.getItem(MOVIE_CONFIG.storageKeys.movies);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (error) {
      // 저장소를 못 쓰면 샘플 데이터를 사용한다
    }
    return JSON.parse(JSON.stringify(SAMPLE_MOVIES));   // 깊은 복사 (원본 보호)
  },

  // 영화 목록을 저장하는 함수
  save(movies) {
    try {
      localStorage.setItem(MOVIE_CONFIG.storageKeys.movies, JSON.stringify(movies));
      return true;
    } catch (error) {
      return false;                                     // 용량 초과 등
    }
  },

  // 저장된 수정 내용을 지우는 함수 (샘플로 되돌리기)
  clear() {
    try { localStorage.removeItem(MOVIE_CONFIG.storageKeys.movies); } catch (error) { /* 무시 */ }
  }
};

// ---------- 영화 목록 메모리 캐시 ----------
let cachedMovies = null;

// 전체 영화 목록을 돌려주는 함수
function getAllMovies() {
  if (!cachedMovies) cachedMovies = movieDataSource.load();
  return cachedMovies;
}

// id 로 영화 한 편을 찾는 함수 (없으면 undefined)
function getMovieById(movieId) {
  return getAllMovies().find((movie) => movie.id === movieId);
}

// 영화를 추가하거나(새 id) 수정하는(기존 id) 함수. 저장 성공 여부를 돌려준다
function saveMovie(movie) {
  const movies = getAllMovies();
  const index = movies.findIndex((item) => item.id === movie.id);
  movie.updatedAt = toDateText(new Date());             // 수정일 갱신
  if (index >= 0) movies[index] = movie; else movies.unshift(movie);
  return movieDataSource.save(movies);
}

// 영화를 삭제하는 함수
function deleteMovie(movieId) {
  cachedMovies = getAllMovies().filter((movie) => movie.id !== movieId);
  return movieDataSource.save(cachedMovies);
}

// 샘플 데이터로 되돌리는 함수
function resetMovies() {
  movieDataSource.clear();
  cachedMovies = null;
}

// 영화 목록 전체를 JSON 문자열로 내보내는 함수 (백업/이전용)
function exportMoviesAsJson() {
  return JSON.stringify(getAllMovies(), null, 2);
}

// JSON 문자열에서 영화 목록을 가져오는 함수. 형식이 맞지 않으면 오류를 던진다
function importMoviesFromJson(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error("영화 목록(배열) 형식이 아닙니다.");
  const valid = parsed.every((item) => item && typeof item.id === "string" && typeof item.title === "string");
  if (!valid) throw new Error("각 영화에는 id 와 title 이 필요합니다.");
  cachedMovies = parsed;
  return movieDataSource.save(cachedMovies);
}

// ---------- 이용 통계 (핵심 지표: 상세 조회 대비 관련 사이트 이동 비율) ----------

// 통계를 읽는 함수 (형태: { views: {영화id: 횟수}, clicks: {영화id: 횟수} })
function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOVIE_CONFIG.storageKeys.stats));
    if (saved && saved.views && saved.clicks) return saved;
  } catch (error) { /* 무시 */ }
  return { views: {}, clicks: {} };
}

// 통계를 저장하는 함수
function saveStats(stats) {
  try { localStorage.setItem(MOVIE_CONFIG.storageKeys.stats, JSON.stringify(stats)); } catch (error) { /* 무시 */ }
}

// 상세 화면 조회를 1회 기록하는 함수
function recordDetailView(movieId) {
  const stats = loadStats();
  stats.views[movieId] = (stats.views[movieId] || 0) + 1;
  saveStats(stats);
}

// 관련 사이트로 이동(클릭)한 것을 1회 기록하는 함수
function recordOutboundClick(movieId) {
  const stats = loadStats();
  stats.clicks[movieId] = (stats.clicks[movieId] || 0) + 1;
  saveStats(stats);
}

// 전체 통계 요약을 계산하는 함수: 조회수 합, 이동수 합, 이동 비율(%)
function summarizeStats() {
  const stats = loadStats();
  const sum = (object) => Object.values(object).reduce((total, count) => total + count, 0);
  const views = sum(stats.views);
  const clicks = sum(stats.clicks);
  return { views, clicks, rate: views === 0 ? 0 : (clicks / views) * 100 };
}

// 통계를 초기화하는 함수
function resetStats() {
  saveStats({ views: {}, clicks: {} });
}

// ---------- KOBIS 연동 ----------

// KOBIS 영화코드로 운영자가 등록한 영화를 찾는 함수 (없으면 undefined)
function findMovieByKobisCd(kobisCd) {
  return getAllMovies().find((movie) => movie.kobisCd === kobisCd);
}

// KOBIS 영화 정보로 "운영자 관리용 영화" 초안을 만드는 함수 (아직 저장하지 않음 → 편집 화면에서 저장)
function createManagedDraftFromKobis(kobisMovie) {
  return {
    id: createMovieId(),
    kobisCd: kobisMovie.kobisCd,
    title: kobisMovie.title,
    originalTitle: kobisMovie.originalTitle,
    status: kobisMovie.status,
    releaseDate: kobisMovie.releaseDate,
    runtime: kobisMovie.runtime,
    ageRating: kobisMovie.ageRating,
    genres: kobisMovie.genres,
    director: kobisMovie.director,
    cast: kobisMovie.cast,
    synopsis: "",
    posterColors: kobisMovie.posterColors.map(() => "#2d3a63"),   // 색상 입력칸은 #RRGGBB 만 받으므로 기본색으로
    posterUrl: "",
    ratings: [],
    reviews: [],
    links: kobisMovie.links
  };
}
