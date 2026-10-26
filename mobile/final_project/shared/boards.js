// 게시판 종류. DB의 posts.board 값(supabase/schema.sql)과 같다. sns는 커뮤니티 피드 전용.
export const BOARDS = [
  { id: "kr", label: "국내주식" },
  { id: "us", label: "해외주식" },
  { id: "company", label: "기업분석" },
  { id: "economy", label: "경제" },
  { id: "free", label: "자유" },
];

export const isBoardId = (id) => BOARDS.some((b) => b.id === id);

export function boardLabel(id) {
  return id === "sns" ? "피드" : (BOARDS.find((b) => b.id === id)?.label ?? id);
}

/** 신고 사유 */
export const REPORT_REASONS = ["스팸·광고", "욕설·비하", "투자 사기·리딩방 홍보", "허위 정보", "기타"];

/** PostgREST의 or/ilike 필터에 넣을 검색어: 필터 문법에 쓰이는 문자는 공백으로 바꾼다 */
export function cleanSearchTerm(value) {
  return value.replace(/[%_,()*\:."']/g, " ").replace(/\s+/g, " ").trim().slice(0, 50);
}
