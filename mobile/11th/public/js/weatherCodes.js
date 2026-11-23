// 날씨 코드(WMO 표준)를 사용자가 이해하기 쉬운 아이콘/설명으로 바꾸는 표
// 새 코드가 필요하면 아래 표에 한 줄만 추가하면 된다
const WEATHER_CODE_TABLE = {
  0:  { icon: "☀️", text: "맑음" },
  1:  { icon: "🌤️", text: "대체로 맑음" },
  2:  { icon: "⛅", text: "구름 조금" },
  3:  { icon: "☁️", text: "흐림" },
  45: { icon: "🌫️", text: "안개" },
  48: { icon: "🌫️", text: "짙은 안개" },
  51: { icon: "🌦️", text: "가벼운 이슬비" },
  53: { icon: "🌦️", text: "이슬비" },
  55: { icon: "🌦️", text: "강한 이슬비" },
  56: { icon: "🌧️", text: "어는 이슬비" },
  57: { icon: "🌧️", text: "강한 어는 이슬비" },
  61: { icon: "🌧️", text: "약한 비" },
  63: { icon: "🌧️", text: "비" },
  65: { icon: "🌧️", text: "강한 비" },
  66: { icon: "🌧️", text: "어는 비" },
  67: { icon: "🌧️", text: "강한 어는 비" },
  71: { icon: "🌨️", text: "약한 눈" },
  73: { icon: "🌨️", text: "눈" },
  75: { icon: "❄️", text: "강한 눈" },
  77: { icon: "🌨️", text: "싸락눈" },
  80: { icon: "🌦️", text: "소나기" },
  81: { icon: "🌧️", text: "강한 소나기" },
  82: { icon: "⛈️", text: "매우 강한 소나기" },
  85: { icon: "🌨️", text: "눈 소나기" },
  86: { icon: "❄️", text: "강한 눈 소나기" },
  95: { icon: "⛈️", text: "천둥번개" },
  96: { icon: "⛈️", text: "우박을 동반한 천둥번개" },
  99: { icon: "⛈️", text: "강한 우박과 천둥번개" }
};

// 코드 번호로 아이콘/설명을 찾는 함수 (표에 없으면 기본값 반환)
function findWeatherDescription(weatherCode) {
  return WEATHER_CODE_TABLE[weatherCode] || { icon: "❔", text: "알 수 없음" };
}

// 날씨 코드와 낮/밤 여부로 대표 카드 배경 테마 이름을 정하는 함수
function findWeatherTheme(weatherCode, isDay) {
  if (weatherCode >= 95) return "theme-storm";                     // 천둥번개
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return "theme-snow"; // 눈
  if (weatherCode >= 51) return "theme-rain";                      // 비/이슬비/소나기
  if (weatherCode === 45 || weatherCode === 48) return "theme-fog"; // 안개
  if (!isDay) return "theme-night";                                // 밤(맑거나 구름)
  if (weatherCode >= 2) return "theme-cloudy";                     // 구름/흐림
  return "theme-clear";                                            // 맑음
}
