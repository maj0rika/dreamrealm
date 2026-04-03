# DreamRealm — AI 기반 영속적 세계 구축 플랫폼

## 프로젝트 개요
사용자가 텍스트 프롬프트 → AI가 세계 생성 → 턴제 텍스트 어드벤처로 탐험 →
세계의 모든 것이 영구 저장 → 다음 접속에도 이어짐.
핵심 차별점: "세계가 당신을 기억한다" — 메모리/영속성이 핵심 가치.

## 기술 스택 (변경 금지)
- **프레임워크**: Next.js 15 (App Router) + React 19 + TypeScript
- **스타일**: Tailwind CSS + shadcn/ui
- **백엔드**: Supabase (PostgreSQL + pgvector + Auth + Edge Functions + Storage)
- **AI 텍스트**: DeepSeek V3 via OpenRouter (유료) / Groq Llama 3.3 70B (무료 티어)
- **AI 이미지**: FLUX.1 Schnell via Replicate ($0.003/장)
- **임베딩**: OpenAI text-embedding-3-small
- **결제**: Lemon Squeezy
- **배포**: Cloudflare Pages (개발 중에는 Vercel Hobby 가능)
- **언어**: 한국어 UI 기본, 코드/변수명은 영문

## 코딩 규칙
- 서버 컴포넌트 기본. 'use client'는 필요한 곳에만.
- 모든 입력 검증에 Zod 사용.
- DB 쿼리는 lib/db/ 아래 리포지토리 파일로 분리.
- API 키, 자격증명 하드코딩 절대 금지. 전부 .env.local 사용.
- AI 프롬프트 템플릿은 lib/ai/prompts/ 에 분리.
- 에러 핸들링: 모든 API 라우트에 try-catch + 적절한 HTTP 상태 코드.
- 한국어 UI 문자열은 컴포넌트 내 직접 작성 (i18n은 Phase 2).

## 핵심 데이터 모델
- profiles: 사용자 (plan, daily_generations_used)
- worlds: 월드 (name, genre, world_spec JSONB, cover_image_url, turn_count)
- locations: 장소 (description, connected_to UUID[], discovered BOOLEAN)
- entities: 엔티티/NPC (entity_type, personality, inventory JSONB, behavior_rules JSONB)
- relationships: 관계 (relationship_type, strength -10~10, history JSONB, decay_rate FLOAT)
- events: 이벤트 (importance 1~10, flashback_shown BOOLEAN)
- turns: 턴 히스토리 (user_input, ai_response JSONB, image_url)
- session_summaries: 세션 요약 (from_turn, to_turn, summary, cliffhanger)
- memory_embeddings: 벡터 메모리 (content, content_type, importance, embedding vector(1536))
- turning_points: 분기점 (player_choice, alternatives[], consequences)
- time_passage_logs: 시간 경과 로그

## AI 파이프라인 (턴 처리)
1. 사용자 입력 (선택지 or 자유 텍스트)
2. 컨텍스트 조립: 월드 규칙 + 현재 위치 + NPC(behavior_rules 포함) + 관계 + 벡터 검색 Top-5 + 최근 6턴
3. AI 호출 (DeepSeek V3, JSON 응답): narration, choices, mood, items/location/relationship 변경사항
4. DB 업데이트: 엔티티/위치/이벤트/관계 변경 반영
5. importance >= 5이면 임베딩 생성 → memory_embeddings 저장
6. importance >= 7이면 turning_points에 분기점 저장
7. generate_image=true이면 FLUX Schnell로 이미지 생성 (비동기)
8. 10턴마다 세션 요약 자동 생성

## WOW 기능 3개
1. **세계가 혼자 흘러간다**: 재접속 시 경과 시간 기반 AI 변화 역산 (1시간+ 부재 시)
2. **NPC 푸시 알림**: 18~36시간 비활성 시 NPC가 카톡처럼 메시지 보냄
3. **기억 플래시백**: 이전 방문 장소 재방문 시 과거 이벤트 반투명 오버레이

## NPC 행동 규칙 (MiroFish 패턴)
NPC마다 behavior_rules JSONB: core_drive, personality_axes(boldness/loyalty/curiosity/honesty 0~1),
goals, behavioral_triggers(condition/action/weight), speech_style, knowledge, secrets.
시간 경과 시 행동 규칙 기반으로 자율 행동 결정. 관계는 decay_rate로 자연 감쇠.

## 파일 구조
```
src/
├── app/
│   ├── page.tsx                    # 랜딩
│   ├── (auth)/login/page.tsx       # 로그인
│   ├── (app)/
│   │   ├── dashboard/page.tsx      # 대시보드
│   │   ├── create/page.tsx         # 월드 생성
│   │   └── world/[id]/page.tsx     # 월드 탐험
│   └── api/
│       ├── worlds/route.ts         # 월드 CRUD
│       ├── worlds/[id]/turn/route.ts  # 턴 처리
│       └── worlds/[id]/resume/route.ts # 세션 재개
├── components/
│   ├── ui/                         # shadcn/ui
│   ├── explore/                    # 탐험 화면 컴포넌트
│   └── dashboard/                  # 대시보드 컴포넌트
├── lib/
│   ├── ai/
│   │   ├── client.ts               # OpenRouter/Groq 클라이언트
│   │   ├── prompts/                # 프롬프트 템플릿들
│   │   ├── context-builder.ts      # 컨텍스트 조립
│   │   └── state-extractor.ts      # AI 응답 → DB 변경 추출
│   ├── db/
│   │   ├── supabase.ts             # Supabase 클라이언트
│   │   └── *.ts                    # 테이블별 CRUD
│   └── memory/
│       └── embeddings.ts           # 임베딩 생성/검색
└── types/
    ├── world.ts                    # WorldSpec, TurnResponse 등
    └── user.ts                     # Profile, Plan
```

## Commands
```bash
npm run dev          # 개발서버 (port 3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
npm test             # 테스트
```

## 현재 진행 상태
- [ ] Phase 1: 프로젝트 초기화 (Next.js 15 + shadcn/ui + 폴더 구조 + 타입)
- [ ] Phase 2: Supabase 연결 + DB 스키마 + CRUD
- [ ] Phase 3: 인증 (Google + 이메일)
- [ ] Phase 4: AI 클라이언트 + 월드 생성 파이프라인
- [ ] Phase 5: 대시보드
- [ ] Phase 6: 턴 처리 핵심 루프 + 탐험 화면
- [ ] Phase 7: 메모리 파이프라인 (임베딩 + 플래시백)
- [ ] Phase 8: 이미지 생성 (FLUX Schnell)
- [ ] Phase 9: WOW 기능 (시간 경과 + NPC 알림)
- [ ] Phase 10: 결제 (Lemon Squeezy)
- [ ] Phase 11: 배포 (Cloudflare Pages)
