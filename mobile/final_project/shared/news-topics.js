// 시장 뉴스 주제. 서버(네이버 검색어)와 화면(탭)이 함께 쓴다.
export const NEWS_TOPICS = [
  { id: "all", label: "전체", query: "증시" },
  { id: "kr", label: "국내 증시", query: "코스피 코스닥" },
  { id: "us", label: "해외 증시", query: "뉴욕증시" },
  { id: "macro", label: "경제 지표", query: "물가 금리 지표" },
  { id: "company", label: "기업", query: "실적 발표" },
  { id: "fx", label: "외환", query: "원달러 환율" },
  { id: "commodity", label: "원자재", query: "국제유가 금값" },
];

export const findTopic = (id) => NEWS_TOPICS.find((t) => t.id === id) ?? NEWS_TOPICS[0];

/** 검색어 정리: 앞뒤 공백 제거, 30자까지 */
export const cleanNewsQuery = (value) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
