// 브라우저 저장소(localStorage)를 사용해 "최근 검색 장소"를 기억하는 파일

// 저장소에서 사용할 이름표
const RECENT_PLACES_KEY = "quickWeather.recentPlaces";

// 저장된 최근 장소 목록을 읽어오는 함수 (없거나 오류면 빈 목록)
function loadRecentPlaces() {
  try {
    const saved = localStorage.getItem(RECENT_PLACES_KEY);   // 문자열로 저장되어 있음
    return saved ? JSON.parse(saved) : [];                   // 객체 목록으로 변환
  } catch (error) {
    return [];                                               // 저장소를 못 쓰는 환경 대비
  }
}

// 최근 장소 목록을 저장하는 함수
function saveRecentPlaces(places) {
  try {
    localStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(places));
  } catch (error) {
    // 저장에 실패해도 앱은 계속 동작해야 하므로 무시한다
  }
}

// 장소 하나를 최근 목록 맨 앞에 추가하는 함수 (같은 장소는 중복 제거, 최대 개수 제한)
function addRecentPlace(place) {
  const others = loadRecentPlaces().filter(
    (item) => !(item.latitude === place.latitude && item.longitude === place.longitude)
  );
  const updated = [place, ...others].slice(0, APP_CONFIG.recentPlaceLimit);
  saveRecentPlaces(updated);
  return updated;                                            // 화면 갱신용으로 돌려준다
}
