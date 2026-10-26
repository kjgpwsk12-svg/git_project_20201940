-- 경제 지도: 주요 상장사 본사 위치 (2026-10-14 확인)
-- Supabase 대시보드 → SQL Editor에서 실행한다. 먼저 migrations/20261014_map.sql을 실행해야 한다.
-- 다시 실행해도 같은 회사·위치가 두 번 들어가지 않는다.
--
-- 주소 출처
--   한국: 한국거래소 KIND 기업개황의 본점 주소
--   미국: 미 증권거래위원회(SEC) EDGAR 공시의 business address
-- 좌표: 위 주소를 OpenStreetMap(Nominatim, Photon)에서 찾은 값
--   exact  = 주소의 번지(건물)·캠퍼스 단위로 찾음
--   approx = 도로·동네 단위로만 찾음 (실제 건물과 수백 m~수 km 차이가 날 수 있어 화면에 '위치 근사'로 표시)
-- 분야(industry)는 지도 필터용으로 묶은 분류이고, 공식 업종은 description에 적었다.

with v(symbol_id, name, industry, country, description, address, lat, lng, precision, source_url) as (values
  ('KR.005930', '삼성전자', '반도체·전자', 'KR', '공시 업종(KIND): 통신 및 방송 장비 제조업', '경기도 수원시 영통구 삼성로 129', 37.25729, 127.05209, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=00593&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.000660', 'SK하이닉스', '반도체·전자', 'KR', '공시 업종(KIND): 반도체 제조업', '경기도 이천시 부발읍 경충대로 2091', 37.25298, 127.48068, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=00066&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.373220', 'LG에너지솔루션', '2차전지·소재', 'KR', '공시 업종(KIND): 일차전지 및 이차전지 제조업', '서울특별시 영등포구 여의대로 108', 37.52596, 126.92842, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=37322&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.207940', '삼성바이오로직스', '바이오·제약', 'KR', '공시 업종(KIND): 기초 의약물질 제조업', '인천광역시 연수구 송도바이오대로 300', 37.36664, 126.66477, 'approx', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=20794&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.005380', '현대차', '자동차', 'KR', '공시 업종(KIND): 자동차용 엔진 및 자동차 제조업', '서울특별시 서초구 헌릉로 12', 37.46446, 127.04276, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=00538&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.000270', '기아', '자동차', 'KR', '공시 업종(KIND): 자동차용 엔진 및 자동차 제조업', '서울특별시 서초구 헌릉로 12', 37.46446, 127.04276, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=00027&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.035420', 'NAVER', '인터넷·소프트웨어', 'KR', '공시 업종(KIND): 포털 및 기타 인터넷 정보매개 서비스업', '경기도 성남시 분당구 정자일로 95', 37.35888, 127.10518, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=03542&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.035720', '카카오', '인터넷·소프트웨어', 'KR', '공시 업종(KIND): 포털 및 기타 인터넷 정보매개 서비스업', '제주특별자치도 제주시 첨단로 242', 33.46767, 126.56974, 'approx', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=03572&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.068270', '셀트리온', '바이오·제약', 'KR', '공시 업종(KIND): 기초 의약물질 제조업', '인천광역시 연수구 아카데미로 23', 37.40458, 126.61835, 'approx', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=06827&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.005490', 'POSCO홀딩스', '철강·화학·에너지', 'KR', '공시 업종(KIND): 1차 철강 제조업', '경상북도 포항시 남구 동해안로 6261', 35.99295, 129.41881, 'approx', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=00549&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.051910', 'LG화학', '철강·화학·에너지', 'KR', '공시 업종(KIND): 기초 화학물질 제조업', '서울특별시 영등포구 여의대로 128', 37.52793, 126.92924, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=05191&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.006400', '삼성SDI', '2차전지·소재', 'KR', '공시 업종(KIND): 일차전지 및 이차전지 제조업', '경기도 용인시 기흥구 공세로 150-20', 37.23723, 127.11075, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=00640&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.105560', 'KB금융', '금융', 'KR', '공시 업종(KIND): 기타 금융업', '서울특별시 영등포구 국제금융로8길 26', 37.51979, 126.92851, 'approx', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=10556&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.055550', '신한지주', '금융', 'KR', '공시 업종(KIND): 기타 금융업', '서울특별시 중구 세종대로9길 20', 37.56078, 126.97481, 'approx', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=05555&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.012330', '현대모비스', '자동차', 'KR', '공시 업종(KIND): 자동차 신품 부품 제조업', '서울특별시 강남구 역삼동 140-2', 37.49988, 127.03856, 'approx', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=01233&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.066570', 'LG전자', '반도체·전자', 'KR', '공시 업종(KIND): 통신 및 방송 장비 제조업', '서울특별시 영등포구 여의대로 128', 37.52793, 126.92924, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=06657&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.017670', 'SK텔레콤', '통신', 'KR', '공시 업종(KIND): 전기 통신업', '서울특별시 중구 을지로 65', 37.56649, 126.98514, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=01767&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.259960', '크래프톤', '게임·엔터', 'KR', '공시 업종(KIND): 소프트웨어 개발 및 공급업', '서울특별시 강남구 테헤란로 231', 37.50363, 127.04125, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=25996&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.352820', '하이브', '게임·엔터', 'KR', '공시 업종(KIND): 오디오물 출판 및 원판 녹음업', '서울특별시 용산구 한강대로 42', 37.52465, 126.96416, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=35282&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.012450', '한화에어로스페이스', '조선·기계·방산', 'KR', '공시 업종(KIND): 항공기, 우주선 및 부품 제조업', '경상남도 창원시 성산구 창원대로 1204', 35.19864, 128.68727, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=01245&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.329180', 'HD현대중공업', '조선·기계·방산', 'KR', '공시 업종(KIND): 선박 및 보트 건조업', '울산광역시 동구 방어진순환도로 1000', 35.51771, 129.39812, 'approx', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=32918&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.034020', '두산에너빌리티', '조선·기계·방산', 'KR', '공시 업종(KIND): 일반 목적용 기계 제조업', '경상남도 창원시 성산구 두산볼보로 22', 35.19029, 128.61373, 'approx', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=03402&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.323410', '카카오뱅크', '금융', 'KR', '공시 업종(KIND): 은행 및 저축기관', '경기도 성남시 분당구 분당내곡로 131', 37.39542, 127.11218, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=32341&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.247540', '에코프로비엠', '2차전지·소재', 'KR', '공시 업종(KIND): 일차전지 및 이차전지 제조업', '충청북도 청주시 청원구 오창읍 2산단로 100', 36.74238, 127.4545, 'approx', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=24754&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.196170', '알테오젠', '바이오·제약', 'KR', '공시 업종(KIND): 자연과학 및 공학 연구개발업', '대전광역시 유성구 유성대로1628번길 62', 36.40022, 127.38838, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=19617&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.086520', '에코프로', '2차전지·소재', 'KR', '공시 업종(KIND): 기타 금융업(지주회사)', '충청북도 청주시 청원구 오창읍 과학산업2로 587-40', 36.74238, 127.4545, 'approx', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=08652&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.028300', 'HLB', '바이오·제약', 'KR', '공시 업종(KIND): 의료용품 및 기타 의약 관련제품 제조업', '세종특별자치시 연동면 명학산단서로 10-5', 36.5445, 127.32909, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=02830&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.263750', '펄어비스', '게임·엔터', 'KR', '공시 업종(KIND): 소프트웨어 개발 및 공급업', '경기도 과천시 과천대로2길 48', 37.40655, 126.98368, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=26375&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.293490', '카카오게임즈', '게임·엔터', 'KR', '공시 업종(KIND): 소프트웨어 개발 및 공급업', '경기도 성남시 분당구 판교역로 152', 37.39425, 127.11037, 'exact', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=29349&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('KR.035900', 'JYP Ent.', '게임·엔터', 'KR', '공시 업종(KIND): 오디오물 출판 및 원판 녹음업', '서울특별시 강동구 강동대로 205', 37.52428, 127.12764, 'approx', 'https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummaryOvrvwDetail&menuIndex=0&strIsurCd=03590&lstCd=undefined&taskDd=&spotIsuTrdMktTpCd=&methodType=0'),
  ('US.NAS.AAPL', 'Apple', '반도체·전자', 'US', 'SEC 업종 분류: Electronic Computers', 'One Apple Park Way, Cupertino, CA 95014', 37.33494, -122.01269, 'approx', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193'),
  ('US.NAS.MSFT', 'Microsoft', '인터넷·소프트웨어', 'US', 'SEC 업종 분류: Services-Prepackaged Software', 'One Microsoft Way, Redmond, WA 98052', 47.64118, -122.12668, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000789019'),
  ('US.NAS.NVDA', 'NVIDIA', '반도체·전자', 'US', 'SEC 업종 분류: Semiconductors & Related Devices', '2788 San Tomas Expressway, Santa Clara, CA 95051', 37.37054, -121.96708, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810'),
  ('US.NAS.GOOGL', 'Alphabet', '인터넷·소프트웨어', 'US', 'SEC 업종 분류: Services-Computer Programming, Data Processing', '1600 Amphitheatre Parkway, Mountain View, CA 94043', 37.42249, -122.08558, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001652044'),
  ('US.NAS.AMZN', 'Amazon', '유통·소비재', 'US', 'SEC 업종 분류: Retail-Catalog & Mail-Order Houses', '410 Terry Avenue North, Seattle, WA 98109', 47.6223, -122.3365, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001018724'),
  ('US.NAS.META', 'Meta Platforms', '인터넷·소프트웨어', 'US', 'SEC 업종 분류: Services-Computer Programming, Data Processing', '1 Meta Way, Menlo Park, CA 94025', 37.48186, -122.16357, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001326801'),
  ('US.NAS.TSLA', 'Tesla', '자동차', 'US', 'SEC 업종 분류: Motor Vehicles & Passenger Car Bodies', '1 Tesla Road, Austin, TX 78725', 30.22193, -97.61877, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001318605'),
  ('US.NYS.JPM', 'JPMorgan Chase', '금융', 'US', 'SEC 업종 분류: National Commercial Banks', '270 Park Avenue, New York, NY 10017', 40.75598, -73.97597, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000019617'),
  ('US.NAS.NFLX', 'Netflix', '게임·엔터', 'US', 'SEC 업종 분류: Services-Video Tape Rental', '121 Albright Way, Los Gatos, CA 95032', 37.25692, -121.96394, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001065280'),
  ('US.NAS.AMD', 'AMD', '반도체·전자', 'US', 'SEC 업종 분류: Semiconductors & Related Devices', '2485 Augustine Drive, Santa Clara, CA 95054', 37.38296, -121.97038, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000002488'),
  ('US.NAS.COST', 'Costco', '유통·소비재', 'US', 'SEC 업종 분류: Retail-Variety Stores', '999 Lake Drive, Issaquah, WA 98027', 47.5486, -122.05062, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000909832'),
  ('US.NYS.KO', 'Coca-Cola', '유통·소비재', 'US', 'SEC 업종 분류: Beverages', 'One Coca Cola Plaza, Atlanta, GA 30313', 33.77087, -84.39663, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000021344'),
  ('US.NYS.XOM', 'Exxon Mobil', '철강·화학·에너지', 'US', 'SEC 업종 분류: Petroleum Refining', '22777 Springwoods Village Parkway, Spring, TX 77389', 30.10324, -95.44615, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0002115436'),
  ('US.NYS.LLY', 'Eli Lilly', '바이오·제약', 'US', 'SEC 업종 분류: Pharmaceutical Preparations', 'Lilly Corporate Center, Indianapolis, IN 46285', 39.75469, -86.15378, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000059478'),
  ('US.NYS.DIS', 'Disney', '게임·엔터', 'US', 'SEC 업종 분류: Services-Miscellaneous Amusement & Recreation', '500 South Buena Vista Street, Burbank, CA 91521', 34.15513, -118.3265, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001744489'),
  ('US.NYS.ORCL', 'Oracle', '인터넷·소프트웨어', 'US', 'SEC 업종 분류: Services-Prepackaged Software', '2300 Oracle Way, Austin, TX 78741', 30.2435, -97.72183, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001341439'),
  ('US.NAS.AVGO', 'Broadcom', '반도체·전자', 'US', 'SEC 업종 분류: Semiconductors & Related Devices', '3421 Hillview Avenue, Palo Alto, CA 94304', 37.39903, -122.14442, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001730168'),
  ('US.NAS.PLTR', 'Palantir', '인터넷·소프트웨어', 'US', 'SEC 업종 분류: Services-Prepackaged Software', '19505 Biscayne Boulevard, Aventura, FL 33180', 25.95621, -80.14357, 'exact', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001321655')
),
ins as (
  insert into public.companies (symbol_id, name, industry, country, description)
  select symbol_id, name, industry, country, description from v
  on conflict (symbol_id) do nothing
  returning id, symbol_id
),
co as (
  select id, symbol_id from ins
  union
  select c.id, c.symbol_id from public.companies c join v using (symbol_id)
)
insert into public.company_locations (company_id, kind, label, address, lat, lng, precision, source_url, verified_at)
select co.id, 'hq', '본사', v.address, v.lat, v.lng, v.precision, v.source_url, date '2026-10-14'
from v join co using (symbol_id)
where not exists (
  select 1 from public.company_locations l where l.company_id = co.id and l.kind = 'hq'
);
