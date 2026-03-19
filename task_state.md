# LitReview App — 작업 상태 정리

> 최종 업데이트: 2026-03-17

---

## 프로젝트 개요

**경로**: `/Users/parkji-yong/Desktop/test01/literature-review-app/`
**배포**: `https://jyong-literature-review.vercel.app/`
**스택**: Next.js 16 App Router · Tailwind v4 · Supabase · Gemini API

---

## 구현 완료 기능

### 핵심 기능
- **문헌 업로드**: PDF/URL 업로드 → Gemini AI로 자동 추출 (저자, 연도, 저널, 근거 데이터 등)
- **배치 분석**: 여러 문헌 일괄 처리 (`/api/batch`)
- **중복 검사**: 업로드 전 중복 문헌 자동 감지
- **수동 입력**: PDF 없이 직접 문헌 메타데이터 입력 (`/manual`)
- **휴지통**: 소프트 삭제 + 복구 기능 (`/trash`)

### Synthesis 기능 (`/synthesis`)
- 가설 입력 → AI 학술 근거 합성 → APA 인용 포함 구조화 보고서 생성
- **AI 자가검증**: 생성된 합성의 논리적 오류·편향 자동 검증
- **Synthesis 개선**: 검증 결과 기반 자동 재작성
- **연구설계 생성** *(2026-03-17 추가)*:
  - "연구설계 생성" 버튼 → Gemini로 인과관계 모식도 생성
  - 인과관계 경로도 (from → mechanism → to, direct/mediated/moderated 구분)
  - 핵심 변수 카드 (독립/매개/종속/조절/통제)
  - 분석방법 목록 (method, purpose, software)
  - 필요 데이터 테이블 (variable, source, unit, level)
  - DB 캐싱: 한 번 생성 후 재방문 시 자동 로드
- **Word 저장**: 합성 결과 `.doc` 다운로드

### CPR 기능 (`/cpr`) *(2026-03-16 추가)*
- Word 논문 파일 업로드 → mammoth로 텍스트 추출
- 리뷰어 코멘트 입력 (텍스트 직접 입력 또는 .docx 파일)
- Synthesis 연결 (선택): 완료된 Synthesis 중 하나 선택
- AI 분석:
  - 전문가 리뷰 (overall_assessment, strengths, major/minor concerns) — 한국어 출력
  - 리뷰어 코멘트 대응 전략
  - Synthesis 근거 통합 제안
  - 붉은색 인라인 주석 포함 HTML 생성
- 분석 결과: 리뷰 패널 + 주석 문서 미리보기 + `.doc` 다운로드
- 세션 기록: 이전 분석 결과 재로드

---

## 파일 구조 (주요)

```
src/app/(app)/
  dashboard/         문헌 목록
  literature/[id]/   문헌 상세
  synthesis/         합성 작성 + 결과
  cpr/               CPR 논문 리뷰
  manual/            수동 문헌 입력
  settings/          설정
  trash/             휴지통

src/app/api/
  upload/            PDF/URL 파싱 POST
  batch/             배치 분석
  extract/           AI 추출 실행
  literature/[id]/   문헌 CRUD + review
  synthesis/         합성 목록 GET / 생성 POST
  synthesis/[id]/    합성 단일 GET / DELETE
  synthesis/[id]/review/        AI 자가검증
  synthesis/[id]/improve/       합성 개선
  synthesis/[id]/research-design/  연구설계 생성 ✨
  cpr/               CPR 세션 목록 GET / 생성 POST
  cpr/[id]/          세션 단일 GET / DELETE
  cpr/[id]/analyze/  AI 분석 실행

supabase/migrations/
  20260312000000_initial_schema.sql
  20260312000001_storage_policies.sql
  20260312000002_soft_delete.sql
  20260312000003_evidence_korean.sql
  20260312000004_causal_paths.sql
  20260312000005_user_notes.sql
  20260313000001_syntheses.sql
  20260314000001_quality_scores.sql
  20260316000001_cpr_sessions.sql
  20260317000001_synthesis_research_design.sql  ✨

.claude/commands/
  update-task-state.md   프로젝트 상태 파일 업데이트 커맨드
```

---

## 주요 기술 결정사항

| 항목 | 결정 |
|------|------|
| AI 모델 | Gemini API (`callGemini()`) — synthesis/CPR/research-design |
| PDF 파싱 | `pdf-parse` (CommonJS `require()`) |
| Word 파싱 | `mammoth` (CommonJS `require()`) |
| CSS | Tailwind v4 (`globals.css` `@theme {}`, no `tailwind.config.ts`) |
| 라우팅 | `proxy.ts` (Next.js 16, not `middleware.ts`) |
| DB 캐싱 | 연구설계/리뷰 결과 → Supabase JSONB 컬럼에 저장 후 재사용 |
| 보안 | `SUPABASE_SERVICE_ROLE_KEY` 서버 전용, RLS로 `user_id` 격리 |

---

## 현재 알려진 이슈

| 이슈 | 상태 |
|------|------|
| `whatwg-encoding@3.1.1` deprecation warning | 무해한 npm warn — 무시 가능 |
| Vercel 배포 후 Supabase 마이그레이션 수동 적용 필요 | 매번 `supabase db push` 후 Vercel 재배포 필요 |

---

## 다음에 할 수 있는 작업 (미착수)

- [ ] CPR `.doc` 다운로드 기능 (주석 HTML을 Word 파일로 변환)
- [ ] Synthesis → 연구설계 내보내기 (PDF/Word)
- [ ] 문헌 태그/카테고리 분류
- [ ] 배치 분석 진행률 실시간 표시 (Server-Sent Events)
- [ ] Vercel 자동 배포 시 Supabase 마이그레이션 자동화
