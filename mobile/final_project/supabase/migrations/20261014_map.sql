-- 2026-10-14 경제 지도: 위치 정확도 표시
-- 이미 schema.sql을 실행한 Supabase 프로젝트에 한 번 실행한다. (schema.sql에는 같은 내용이 들어 있다)
-- exact: 건물·캠퍼스 단위로 확인한 좌표, approx: 도로·동네 단위 근사 좌표

alter table public.company_locations
  add column if not exists precision text not null default 'exact' check (precision in ('exact', 'approx'));
