# 한글문서 초안기

정적 HTML/CSS/JS로 동작하는 Gemini 기반 행정문서 초안 생성기입니다.

## 실행
브라우저의 `file://` 방식은 `assets/base.hwpx.b64` fetch가 막힐 수 있으므로 폴더에서 간단한 웹서버를 실행하세요.

```bash
python -m http.server 8080
```

그 뒤 `http://localhost:8080` 접속 → **Gemini API 설정**에서 API 키 입력 → 문서 생성.

## 중요: API 키
이 버전은 빠른 프로토타입을 위한 정적 웹앱입니다. API 키를 HTML/JS에 하드코딩하지 않고 sessionStorage에 저장하지만, 브라우저에서 Gemini로 직접 요청하므로 운영 배포에는 적합하지 않습니다. 실제 공개 배포 시 Cloudflare Workers / Vercel Functions / Supabase Edge Function 같은 서버리스 프록시에 API 키를 환경변수로 넣으세요.

## HWPX 생성 방식
`assets/base.hwpx.b64`는 예시1 HWPX를 Base64로 저장한 템플릿이며, 제공된 예시1 HWPX를 기반 템플릿으로 사용합니다. 템플릿의 header/styles/page settings는 유지하고 `Contents/section0.xml`의 문단만 새로 구성합니다. 스타일 ID는 검증된 템플릿 값을 사용합니다.

- 제목: HY헤드라인M 20pt 계열
- 본문/항목: 함초롬바탕 15pt 계열
- 요약문: 함초롬바탕 12pt 계열
- 항목: □ → ○ → - → ·
- A4 / 좌우 약 20mm / 상하 약 15mm(예시1 기준)

## 참고 라이브러리
- JSZip: 브라우저 HWPX(zip) 패키징
- Mammoth: DOCX 텍스트 추출
- PDF.js: PDF 텍스트 추출

## 배포 전 권장 개선
1. Gemini 호출을 서버리스 프록시로 이동
2. 파일 업로드 크기 제한/개인정보 경고 추가
3. HWPX 생성 후 서버 측 구조검증(XML parse, mimetype first/store) 추가
4. 표 생성이 필요한 문서용 단순 표 빌더 추가
5. 예시1/2/3별 HWPX 템플릿을 각각 분리해 선택 가능하게 확장
