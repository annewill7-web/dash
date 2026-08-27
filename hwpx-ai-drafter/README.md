# 한글문서 초안기

Gemini API로 공공기관 행정문서 초안을 만들고 HWPX로 저장하는 정적 HTML/CSS/JS 웹앱입니다.

## 사용 방법
1. GitHub Pages 또는 웹서버에서 `hwpx-ai-drafter/index.html`을 엽니다.
2. 화면 상단의 **Gemini API 키** 입력란에 Google AI Studio에서 발급받은 키를 입력합니다.
3. 문서 유형, 제목, 핵심내용을 입력하고 필요하면 참고자료(TXT/MD/PDF/DOCX)를 첨부합니다.
4. **AI 한글문서 초안 생성**을 누릅니다.
5. 결과를 검토한 뒤 TXT 또는 HWPX로 저장합니다.

## API 키 주의
API 키는 소스코드에 저장하지 않고 브라우저 `sessionStorage`에만 보관합니다. 다만 브라우저가 Gemini API를 직접 호출하는 프로토타입이므로 공개 운영 서비스에서는 서버리스 프록시(Cloudflare Workers, Vercel Functions, Supabase Edge Function 등)를 두고 키를 환경변수로 관리하는 방식을 권장합니다.

## 문서 시스템
- 보고서·계획안: 요약 → 추진배경 → 주요내용 → 향후계획
- 교육·행사 계획: 추진배경 → 개요 → 세부계획 → 행정사항
- 간결 보고: 요약 → 핵심 현황 → 조치사항 → 향후계획
- 항목 계층: □ → ○ → - → ·
- 기반 HWPX 템플릿의 문서 스타일·페이지 설정을 유지하면서 `Contents/section0.xml`의 본문을 새로 구성합니다.

## 참고 라이브러리
- JSZip: HWPX ZIP 패키징
- Mammoth: DOCX 텍스트 추출
- PDF.js: PDF 텍스트 추출
