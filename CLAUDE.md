# LitReview App — Claude Code Guide

## Project Overview
나만의 Literature Review 웹앱. URL/PDF/이미지 입력 → AI(OpenRouter) 추출 → 이중언어 결과 표시.

## Tech Stack
- **Framework**: Next.js 16 App Router + TypeScript
- **Styling**: Tailwind CSS v4 (CSS-based config — `@theme {}` blocks in `globals.css`, NO `tailwind.config.ts`)
- **Auth + DB**: Supabase (Auth + PostgreSQL + Storage)
- **AI**: OpenRouter API (`anthropic/claude-3-5-sonnet`, max_tokens: 8000)
- **Deployment**: Vercel

## Key Conventions
- Next.js 16 uses `src/proxy.ts` (not `middleware.ts`) for route protection
- pdf-parse requires `require()` (CommonJS), not ES import
- Design: Glassmorphism + Monochrome (`.glass-card`, `.glass-input` classes in `globals.css`)
- Authors: 1명 → 이름 그대로, 2명 → "A, B", 3명+ → "A et al."
- AI fields: freely determined from paper content — NOT a fixed predefined list

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only
OPENROUTER_API_KEY=sk-or-...
NEXT_PUBLIC_APP_URL=https://...
ANTHROPIC_API_KEY=              # unused (kept for test route)
```

## Critical Files
| File | Purpose |
|---|---|
| `src/proxy.ts` | Route auth protection |
| `src/app/api/extract/route.ts` | Core AI extraction pipeline |
| `src/lib/openrouter/prompts.ts` | AI prompt templates (quality-critical) |
| `src/lib/extraction/parser.ts` | OpenRouter JSON → DB types |
| `src/components/literature/ContentSection.tsx` | Bilingual bullet display |
| `src/components/literature/EvidenceBox.tsx` | Empirical evidence boxes (clickable → PDF page) |
| `src/components/literature/PdfViewerWrapper.tsx` | iframe PDF viewer with page navigation |
| `src/components/literature/UserNotes.tsx` | Auto-saving personal memo (1.2s debounce) |
| `src/components/literature/ManualEntryForm.tsx` | Manual literature entry form |
| `supabase/migrations/001_initial_schema.sql` | Full DB schema |

## Database Tables
- `literature` — 문헌 메타데이터 (user_notes TEXT 포함)
- `literature_content` — 섹션별 추출 내용 (bullets_original / bullets_korean JSONB)
- `empirical_evidence` — 실증 근거 (page_reference로 PDF 페이지 연동)
- `ai_prompts` — 사용자 커스텀 프롬프트
- `batch_jobs` + `batch_literature` — 배치 처리 상태

## Cross-Component PDF Navigation
EvidenceBox / ContentSection → `window.dispatchEvent(new CustomEvent('pdf-page-select', { detail: { page: N } }))` → PdfViewerWrapper listens and updates `iframeRef.current.src = ${pdfUrl}#page=${N}`

## AI Extraction Notes
- JSON truncation 방지: `anthropic/claude-3-5-sonnet` 사용 (8192 output tokens)
- mediated causal paths (X→M→Y) 및 table/figure 정량 데이터 추출 지원
- OpenRouter credits 부족 시 402 에러 → openrouter.ai/settings/credits 에서 충전

## App Routes
| Route | Purpose |
|---|---|
| `/dashboard` | 문헌 목록 + 필터 |
| `/upload` | PDF/URL/이미지 업로드 |
| `/manual` | 직접 타이핑 입력 |
| `/literature/[id]` | 상세 보기 (PDF + 추출 결과) |
| `/settings` | AI 프롬프트 커스터마이징 |
