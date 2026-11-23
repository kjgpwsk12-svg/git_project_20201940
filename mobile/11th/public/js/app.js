// 앱의 흐름(시작 → 현재 위치 날씨 → 검색 → 장소 선택)을 담당하는 메인 파일

// 장소 정보({name, description, latitude, longitude})를 받아 날씨를 가져와 화면에 표시하는 함수
// (모든 흐름이 이 함수로 모인다)
async function showWeatherForPlace(place) {
  showMessage(APP_CONFIG.messages.loading);                    // 로딩 안내
  try {
    // 날씨와 대기질을 동시에 요청해 대기 시간을 줄인다
    const [weather, air] = await Promise.all([
      fetchWeatherByCoordinates(place.latitude, place.longitude),
      fetchAirQualityByCoordinates(place.latitude, place.longitude)
    ]);
    hideMessage();                                             // 성공하면 안내 숨김

    renderHero(place, weather);                                // 대표 카드
    renderAdvice(buildAdviceList(weather, air));               // 생활 조언
    renderHighlights(weather);                                 // 세부 날씨 타일
    renderTemperatureChart(weather.hourly);                    // 기온 그래프
    renderHourlyForecast(weather.hourly);                      // 시간대별 예보
    renderDailyForecast(weather.daily);                        // 7일 예보
    renderAirQuality(air);                                     // 대기질
    renderSunTimes(weather.daily[0]);                          // 일출/일몰
    renderSource(weather.sourceName);                          // 출처
    showDashboard();                                           // 대시보드 표시
  } catch (error) {
    showMessage(APP_CONFIG.messages.weatherFailed, true);      // 실패 안내
  }
}

// 현재 위치의 날씨를 보여주는 함수 (앱을 열 때 자동 실행, "내 위치" 버튼에서도 사용)
async function showWeatherForCurrentLocation() {
  showMessage(APP_CONFIG.messages.loading);
  try {
    const { latitude, longitude } = await getCurrentCoordinates();           // 위치 권한 요청
    const name = await findPlaceNameByCoordinates(latitude, longitude);      // 장소 이름 찾기
    await showWeatherForPlace({ name: name, description: "현재 위치", latitude, longitude });
  } catch (error) {
    // 위치 실패 원인에 따라 알맞은 안내 문구 선택
    const messages = APP_CONFIG.messages;
    const text =
      error.code === "denied" ? messages.locationDenied :
      error.code === "unsupported" ? messages.locationUnsupported :
      messages.locationFailed;
    showMessage(text, true);
  }
}

// 사용자가 검색 결과에서 장소를 선택했을 때 실행되는 함수
function handlePlaceSelected(place) {
  hideSearchResults();                                         // 목록 닫기
  byId("search-input").value = place.name;                     // 입력창에 선택한 이름 표시
  const recentPlaces = addRecentPlace(place);                  // 최근 검색에 저장
  renderRecentPlaces(recentPlaces, handlePlaceSelected);       // 칩 갱신
  showWeatherForPlace(place);                                  // 날씨 표시
}

// 검색 버튼을 눌렀을 때 실행되는 함수
async function handleSearchSubmit(event) {
  event.preventDefault();                                      // 페이지 새로고침 방지
  const keyword = byId("search-input").value.trim();           // 앞뒤 공백 제거
  if (!keyword) {                                              // 빈 검색어 처리
    showMessage(APP_CONFIG.messages.searchEmpty, true);
    return;
  }
  try {
    const places = await searchPlacesByName(keyword);          // 장소 검색
    if (places.length === 0) {                                 // 결과 없음
      hideSearchResults();
      showMessage(APP_CONFIG.messages.searchNoResult, true);
    } else if (places.length === 1) {                          // 결과가 하나면 바로 날씨 표시 (단계 축소)
      handlePlaceSelected(places[0]);
    } else {                                                   // 여러 개면 사용자가 선택
      hideMessage();
      renderSearchResults(places, handlePlaceSelected);
    }
  } catch (error) {
    showMessage(APP_CONFIG.messages.searchFailed, true);
  }
}

// 검색 영역 바깥을 누르면 결과 목록을 닫는 함수
function handleOutsideClick(event) {
  if (!event.target.closest(".search-wrap")) hideSearchResults();
}

// 앱 시작 함수: 이벤트를 연결하고 현재 위치 날씨를 불러온다
function startApp() {
  byId("search-form").addEventListener("submit", handleSearchSubmit);         // 검색
  byId("locate-button").addEventListener("click", showWeatherForCurrentLocation); // 내 위치 버튼
  byId("home-button").addEventListener("click", showWeatherForCurrentLocation);   // 로고 버튼
  document.addEventListener("click", handleOutsideClick);                    // 바깥 클릭 시 목록 닫기
  renderRecentPlaces(loadRecentPlaces(), handlePlaceSelected);               // 저장된 최근 검색 표시
  showWeatherForCurrentLocation();                                           // 자동으로 현재 위치 날씨 표시
}

// 페이지 로딩이 끝나면 앱을 시작한다
document.addEventListener("DOMContentLoaded", startApp);
