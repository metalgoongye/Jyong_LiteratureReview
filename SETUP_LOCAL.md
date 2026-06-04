# Jyong Literature Review — 로컬 개발 가이드

이 폴더는 GitHub 저장소 `metalgoongye/Jyong_LiteratureReview` 를 clone 한 것입니다.
로컬(localhost)에서 실행하며 개발하고, 변경분을 GitHub로 푸시하는 방법을 정리합니다.

- **기술 스택:** Next.js + TypeScript + Supabase
- **로컬 주소:** http://localhost:3000
- **기본 브랜치:** `main`
- **배포(라이브):** https://jyong-literature-review.vercel.app (Vercel, `main` 푸시 시 자동 배포)

---

## 1. 최초 1회 준비 (이미 완료됨)

```powershell
# 저장소 clone (이미 됨)
git clone https://github.com/metalgoongye/Jyong_LiteratureReview.git "D:\y99.claude_and_git\Jyong_LiteratureReview_App"

# 의존성 설치 (이미 됨)
cd "D:\y99.claude_and_git\Jyong_LiteratureReview_App"
npm install
```

## 2. 환경변수 채우기 (실행 전 필수)

`.env.local` 파일이 이미 만들어져 있습니다. **플레이스홀더(`여기에_채우기`)를 실제 값으로 교체**해야 앱이 켜집니다.

값은 Vercel에서 가져옵니다:
**Vercel → Jyong_LiteratureReview 프로젝트 → Settings → Environment Variables → 각 값 Reveal/복사**

| 변수 | 용도 | 없으면 |
|------|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 연결 | 앱이 안 켜짐 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 연결 | 앱이 안 켜짐 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버측 관리작업 | 일부 API 실패 |
| `NEXT_PUBLIC_APP_URL` | 로컬은 `http://localhost:3000` 고정 | — |
| `OPENROUTER_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | AI 분석 기능 | 해당 기능만 실패 |

> `.env.local` 은 `.gitignore` 로 커밋에서 제외됩니다. 키를 GitHub에 올리지 마세요.

## 3. 로컬 실행

```powershell
cd "D:\y99.claude_and_git\Jyong_LiteratureReview_App"
npm run dev
```

→ 브라우저에서 http://localhost:3000 접속. 파일을 수정하면 자동 새로고침됩니다.

---

## 4. 일상 워크플로우

### GitHub의 최신 변경 가져오기 (다른 곳에서 작업했거나 Vercel 변경분 반영)
```powershell
git pull
npm install   # package.json 이 바뀌었을 때만 필요
```

### 변경분 GitHub에 올리기 (→ Vercel 자동 재배포)
```powershell
git add -A
git commit -m "변경 내용 요약"
git push
```

### 새 기능을 안전하게 작업 (선택)
```powershell
git checkout -b feature/작업이름   # 새 브랜치
# ... 작업 ...
git push -u origin feature/작업이름  # PR로 검토 후 main 병합
```

---

## 5. 자주 막히는 부분

- **`npm run dev` 후 에러로 안 켜짐** → 대부분 `.env.local` 의 Supabase 값이 비어있음. 2번 확인.
- **포트 3000 이 이미 사용 중** → `npm run dev -- -p 3001` 로 다른 포트 사용.
- **푸시 권한 오류** → 이 저장소는 `metalgoongye` 계정 소유. git 인증(PAT/SSH)이 해당 계정으로 되어 있어야 함.