-- 2026년 주요 경제 일정 (공식 발표 일정만 넣었다. 2026-10-14 확인)
-- Supabase 대시보드 → SQL Editor에서 한 번 실행한다. (경제 일정은 관리자만 쓸 수 있으므로 SQL Editor로 넣는다)
-- 다시 실행해도 같은 일정이 두 번 들어가지 않도록, 같은 출처의 같은 시각 일정은 건너뛴다.
--
-- 출처
--   한국은행 통화정책방향 결정회의: https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755
--   미 연준 FOMC:                https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
--   미국 소비자물가(CPI):          https://www.bls.gov/schedule/news_release/cpi.htm
--   미국 고용보고서:               https://www.bls.gov/schedule/news_release/empsit.htm
--
-- 시각
--   금통위: 회의 시작 09:00 KST (결정 발표는 회의 후 오전 중)
--   FOMC: 둘째 날 14:00 미 동부 시각 성명 발표, CPI·고용: 08:30 미 동부 시각
--   현지 시각과 시간대 이름(America/New_York, Asia/Seoul)을 적으면 DB가 서머타임을 반영해 변환한다.
-- 이전 값·예상 값·실제 값은 확인된 자료가 없어 비워 둔다.

insert into public.economic_events (country, category, title, scheduled_at, time_tbd, source, source_url)
select v.country, v.category, v.title, v.local_time::timestamp at time zone v.tz, false, v.source, v.source_url
from (values
  -- 한국은행 금융통화위원회 통화정책방향 결정회의
  ('KR', 'rate', '한국은행 기준금리 결정 (금통위)', '2026-01-15 09:00', 'Asia/Seoul', '한국은행', 'https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755'),
  ('KR', 'rate', '한국은행 기준금리 결정 (금통위)', '2026-02-26 09:00', 'Asia/Seoul', '한국은행', 'https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755'),
  ('KR', 'rate', '한국은행 기준금리 결정 (금통위)', '2026-04-10 09:00', 'Asia/Seoul', '한국은행', 'https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755'),
  ('KR', 'rate', '한국은행 기준금리 결정 (금통위)', '2026-05-28 09:00', 'Asia/Seoul', '한국은행', 'https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755'),
  ('KR', 'rate', '한국은행 기준금리 결정 (금통위)', '2026-07-16 09:00', 'Asia/Seoul', '한국은행', 'https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755'),
  ('KR', 'rate', '한국은행 기준금리 결정 (금통위)', '2026-08-27 09:00', 'Asia/Seoul', '한국은행', 'https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755'),
  ('KR', 'rate', '한국은행 기준금리 결정 (금통위)', '2026-10-22 09:00', 'Asia/Seoul', '한국은행', 'https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755'),
  ('KR', 'rate', '한국은행 기준금리 결정 (금통위)', '2026-11-26 09:00', 'Asia/Seoul', '한국은행', 'https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755'),
  -- 미 연준 FOMC 금리 결정 (둘째 날 14:00 ET)
  ('US', 'rate', 'FOMC 기준금리 결정', '2026-01-28 14:00', 'America/New_York', '미 연방준비제도', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('US', 'rate', 'FOMC 기준금리 결정 · 경제전망 발표', '2026-03-18 14:00', 'America/New_York', '미 연방준비제도', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('US', 'rate', 'FOMC 기준금리 결정', '2026-04-29 14:00', 'America/New_York', '미 연방준비제도', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('US', 'rate', 'FOMC 기준금리 결정 · 경제전망 발표', '2026-06-17 14:00', 'America/New_York', '미 연방준비제도', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('US', 'rate', 'FOMC 기준금리 결정', '2026-07-29 14:00', 'America/New_York', '미 연방준비제도', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('US', 'rate', 'FOMC 기준금리 결정 · 경제전망 발표', '2026-09-16 14:00', 'America/New_York', '미 연방준비제도', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('US', 'rate', 'FOMC 기준금리 결정', '2026-10-28 14:00', 'America/New_York', '미 연방준비제도', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('US', 'rate', 'FOMC 기준금리 결정 · 경제전망 발표', '2026-12-09 14:00', 'America/New_York', '미 연방준비제도', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  -- 미국 소비자물가지수(CPI)
  ('US', 'inflation', '미국 소비자물가지수(CPI) · 10월분', '2026-11-10 08:30', 'America/New_York', '미 노동통계국', 'https://www.bls.gov/schedule/news_release/cpi.htm'),
  ('US', 'inflation', '미국 소비자물가지수(CPI) · 11월분', '2026-12-10 08:30', 'America/New_York', '미 노동통계국', 'https://www.bls.gov/schedule/news_release/cpi.htm'),
  ('US', 'inflation', '미국 소비자물가지수(CPI) · 12월분', '2027-01-13 08:30', 'America/New_York', '미 노동통계국', 'https://www.bls.gov/schedule/news_release/cpi.htm'),
  -- 미국 고용보고서(비농업 고용·실업률)
  ('US', 'employment', '미국 고용보고서(비농업 고용·실업률) · 10월분', '2026-11-06 08:30', 'America/New_York', '미 노동통계국', 'https://www.bls.gov/schedule/news_release/empsit.htm'),
  ('US', 'employment', '미국 고용보고서(비농업 고용·실업률) · 11월분', '2026-12-04 08:30', 'America/New_York', '미 노동통계국', 'https://www.bls.gov/schedule/news_release/empsit.htm'),
  ('US', 'employment', '미국 고용보고서(비농업 고용·실업률) · 12월분', '2027-01-08 08:30', 'America/New_York', '미 노동통계국', 'https://www.bls.gov/schedule/news_release/empsit.htm')
) as v(country, category, title, local_time, tz, source, source_url)
where not exists (
  select 1 from public.economic_events e
  where e.source_url = v.source_url and e.scheduled_at = (v.local_time::timestamp at time zone v.tz)
);
