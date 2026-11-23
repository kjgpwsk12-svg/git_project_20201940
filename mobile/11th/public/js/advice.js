// 날씨에 맞는 생활 조언을 만드는 파일.
// 규칙 한 개 = { when: 조건 함수, text: 보여줄 문구 }. 새 조언은 목록에 한 줄만 추가하면 된다.
// 조건 함수는 (오늘 날씨 정보)를 받아 true/false 를 돌려준다.

const ADVICE_RULES = [
  { when: (w) => w.maxRainChance >= 60 || w.current.rainAmount > 0, text: "☔ 우산을 챙기세요." },
  { when: (w) => w.maxRainChance >= 30 && w.maxRainChance < 60,     text: "🌂 비 올 가능성이 있어요. 접이식 우산을 추천해요." },
  { when: (w) => w.current.feelsLike <= 0,                           text: "🧥 매우 추워요. 두꺼운 외투와 장갑이 필요해요." },
  { when: (w) => w.current.feelsLike > 0 && w.current.feelsLike <= 10, text: "🧣 쌀쌀해요. 따뜻한 겉옷을 입으세요." },
  { when: (w) => w.current.feelsLike >= 28 && w.current.feelsLike < 33, text: "🥵 더워요. 가벼운 옷차림과 수분 보충을 추천해요." },
  { when: (w) => w.current.feelsLike >= 33,                          text: "🔥 폭염 수준이에요. 야외 활동을 줄이고 물을 자주 마시세요." },
  { when: (w) => w.tempRange >= 10,                                  text: "🌡️ 일교차가 커요. 겉옷을 챙기세요." },
  { when: (w) => w.current.windSpeed >= 9,                           text: "💨 바람이 강해요. 날아갈 물건을 조심하세요." },
  { when: (w) => w.uvMax >= 6,                                       text: "🧴 자외선이 강해요. 선크림과 모자를 챙기세요." },
  { when: (w) => w.air && w.air.pm25 > 35,                           text: "😷 초미세먼지가 높아요. 마스크를 착용하세요." },
  { when: (w) => w.current.visibilityKm < 1,                         text: "🚗 시야가 좋지 않아요. 이동 시 조심하세요." },
  { when: (w) => [71, 73, 75, 77, 85, 86].includes(w.current.weatherCode), text: "⛄ 눈이 와요. 미끄럼에 주의하세요." }
];

// 오늘 날씨(현재/일별/대기질)를 규칙에 대입해 조언 문구 목록을 만드는 함수
function buildAdviceList(weather, air) {
  const today = weather.daily[0];                              // 오늘 일별 정보
  const next12Hours = weather.hourly.slice(0, 12);             // 앞으로 12시간
  const context = {
    current: weather.current,
    air: air,
    maxRainChance: Math.max(0, ...next12Hours.map((h) => h.rainChance ?? 0)), // 12시간 내 최고 강수확률
    tempRange: today.tempMax - today.tempMin,                  // 오늘 일교차
    uvMax: today.uvIndexMax ?? 0                               // 오늘 최고 자외선 지수
  };
  const matched = ADVICE_RULES.filter((rule) => rule.when(context)).map((rule) => rule.text);
  // 해당하는 조언이 없으면 기본 문구
  return matched.length > 0 ? matched.slice(0, 4) : ["😊 특별한 주의사항 없이 무난한 날씨예요."];
}
