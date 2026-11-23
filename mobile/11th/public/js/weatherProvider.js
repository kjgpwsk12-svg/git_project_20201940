// 날씨 데이터 제공자 모음.
// 제공자는 모두 fetchWeather(위도, 경도) 함수를 가지며 "같은 모양의 결과"를 돌려준다.
// → 나중에 기상청(KMA) 등 국가 기상 API를 추가할 때, 아래에 제공자 하나만 더 등록하면 된다.
//
// 공통 결과 모양:
// {
//   sourceName, timezone, observedAt("YYYY-MM-DDTHH:MM", 해당 장소의 현지 시각),
//   current: { temperature, feelsLike, weatherCode, isDay, rainChance, rainAmount,
//              windSpeed, windGust, windDirection, humidity, pressure, cloudCover, visibilityKm, uvIndex },
//   hourly:  [ { timeText, hour, temperature, weatherCode, rainChance, windSpeed } ... ],
//   daily:   [ { dateText, weekday, weatherCode, tempMax, tempMin, rainChanceMax, rainSum,
//                sunrise("HH:MM"), sunset("HH:MM"), uvIndexMax } ... ]
// }

// ---------- 제공자 1: Open-Meteo (API 키 불필요) ----------
const openMeteoProvider = {
  // 화면에 표시할 출처 이름
  sourceName: "Open-Meteo",

  // 위도/경도로 날씨를 가져오는 함수
  async fetchWeather(latitude, longitude) {
    // 요청 주소와 조회할 항목을 조립 (항목을 늘리려면 여기에 이름만 추가)
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${latitude}&longitude=${longitude}` +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,is_day," +
        "wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover" +
      "&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,uv_index,visibility" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum," +
        "precipitation_probability_max,sunrise,sunset,uv_index_max" +
      `&wind_speed_unit=ms&timezone=auto&forecast_days=${APP_CONFIG.dailyCount}`;

    // 서버에 요청
    const response = await fetch(url);
    // 응답이 실패(404, 500 등)면 오류를 던져 호출한 쪽에서 안내 메시지를 보이게 한다
    if (!response.ok) throw new Error("날씨 서버 응답 오류");
    // JSON 본문을 객체로 변환
    const data = await response.json();

    // 현재 시각에 해당하는 시간별 데이터의 위치(index)를 찾는다
    const nowIndex = findCurrentHourIndex(data.hourly.time, data.current.time);

    // 시간대별 예보 목록 만들기 (현재 시각부터 설정된 개수만큼)
    const hourly = data.hourly.time
      .slice(nowIndex, nowIndex + APP_CONFIG.hourlyCount)
      .map((timeText, i) => ({
        timeText: timeText,
        hour: Number(timeText.slice(11, 13)),                 // "2026-11-16T14:00" → 14
        temperature: data.hourly.temperature_2m[nowIndex + i],
        weatherCode: data.hourly.weather_code[nowIndex + i],
        rainChance: data.hourly.precipitation_probability[nowIndex + i],
        windSpeed: data.hourly.wind_speed_10m[nowIndex + i]
      }));

    // 일별 예보 목록 만들기
    const daily = data.daily.time.map((dateText, i) => ({
      dateText: dateText,
      weekday: findWeekdayName(dateText),
      weatherCode: data.daily.weather_code[i],
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      rainChanceMax: data.daily.precipitation_probability_max[i],
      rainSum: data.daily.precipitation_sum[i],
      sunrise: data.daily.sunrise[i].slice(11, 16),           // "HH:MM" 만 사용
      sunset: data.daily.sunset[i].slice(11, 16),
      uvIndexMax: data.daily.uv_index_max[i]
    }));

    // 공통 결과 모양으로 변환해서 반환
    return {
      sourceName: this.sourceName,
      timezone: data.timezone,
      observedAt: data.current.time,
      current: {
        temperature: data.current.temperature_2m,
        feelsLike: data.current.apparent_temperature,
        weatherCode: data.current.weather_code,
        isDay: data.current.is_day === 1,
        rainChance: data.hourly.precipitation_probability[nowIndex], // 현재 시간대 강수확률
        rainAmount: data.current.precipitation,
        windSpeed: data.current.wind_speed_10m,
        windGust: data.current.wind_gusts_10m,
        windDirection: data.current.wind_direction_10m,
        humidity: data.current.relative_humidity_2m,
        pressure: data.current.pressure_msl,
        cloudCover: data.current.cloud_cover,
        visibilityKm: data.hourly.visibility[nowIndex] / 1000,       // m → km
        uvIndex: data.hourly.uv_index[nowIndex]
      },
      hourly: hourly,
      daily: daily
    };
  },

  // 대기질(미세먼지 등)을 가져오는 함수. 실패하면 null을 돌려줘 화면의 나머지는 정상 표시된다.
  async fetchAirQuality(latitude, longitude) {
    try {
      const url =
        "https://air-quality-api.open-meteo.com/v1/air-quality" +
        `?latitude=${latitude}&longitude=${longitude}` +
        "&current=us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide&timezone=auto";
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      return {
        aqi: data.current.us_aqi,
        pm10: data.current.pm10,
        pm25: data.current.pm2_5,
        ozone: data.current.ozone,
        nitrogenDioxide: data.current.nitrogen_dioxide
      };
    } catch (error) {
      return null;
    }
  }
};

// 시간 문자열 배열에서 "현재 시각 이하 중 가장 늦은 시간"의 위치를 찾는 함수
// (모두 같은 현지 시각 형식이라 문자열 비교로 충분하다)
function findCurrentHourIndex(timeTexts, currentTimeText) {
  let foundIndex = 0;                           // 기본값은 첫 번째
  timeTexts.forEach((timeText, i) => {          // 모든 시간을 순서대로 확인
    if (timeText <= currentTimeText) foundIndex = i; // 현재 이전이면 후보로 기록
  });
  return foundIndex;
}

// "2026-11-16" 같은 날짜 문자열에서 요일 이름(월, 화...)을 구하는 함수
function findWeekdayName(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);   // 연/월/일 분리
  const names = ["일", "월", "화", "수", "목", "금", "토"];
  return names[new Date(year, month - 1, day).getDay()];
}

// ---------- 제공자 등록부 ----------
// 새 제공자를 만들면 여기에 이름과 함께 추가한다. (예: kma: kmaProvider)
const WEATHER_PROVIDERS = {
  openMeteo: openMeteoProvider
};

// 설정(APP_CONFIG.weatherProvider)에 지정된 제공자를 돌려주는 함수
function getWeatherProvider() {
  return WEATHER_PROVIDERS[APP_CONFIG.weatherProvider];
}

// 앱에서 사용하는 날씨 조회 함수 (제공자가 바뀌어도 앱 코드는 그대로)
function fetchWeatherByCoordinates(latitude, longitude) {
  return getWeatherProvider().fetchWeather(latitude, longitude);
}

// 앱에서 사용하는 대기질 조회 함수
function fetchAirQualityByCoordinates(latitude, longitude) {
  return getWeatherProvider().fetchAirQuality(latitude, longitude);
}
