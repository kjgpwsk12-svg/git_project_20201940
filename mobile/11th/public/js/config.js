// 앱 전체에서 공유하는 설정 값 모음 (수정이 필요하면 이 파일만 고치면 된다)
const APP_CONFIG = {
  // 사용할 날씨 제공자 이름 (weatherProvider.js 의 WEATHER_PROVIDERS 키와 같아야 한다)
  weatherProvider: "openMeteo",

  // 시간대별 예보에 보여줄 시간 개수
  hourlyCount: 24,

  // 일별 예보 일수
  dailyCount: 7,

  // 위치 정보를 기다릴 최대 시간(밀리초)
  locationTimeoutMs: 8000,

  // 장소 검색 시 가져올 최대 결과 개수
  searchResultCount: 6,

  // 최근 검색 장소를 저장할 최대 개수
  recentPlaceLimit: 6,

  // 화면에 표시할 안내 문구 모음 (문구 수정/다국어 확장 시 여기만 변경)
  messages: {
    loading: "날씨를 불러오는 중입니다...",
    locationDenied: "위치 권한이 거부되었습니다. 검색창에서 장소를 직접 검색해 주세요.",
    locationUnsupported: "이 브라우저는 위치 정보를 지원하지 않습니다. 장소를 검색해 주세요.",
    locationFailed: "현재 위치를 확인하지 못했습니다. 장소를 검색해 주세요.",
    weatherFailed: "날씨 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    searchEmpty: "검색어를 입력해 주세요.",
    searchNoResult: "검색 결과가 없습니다. 다른 이름으로 검색해 보세요.",
    searchFailed: "검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    airUnavailable: "대기질 정보를 불러오지 못했습니다."
  }
};
