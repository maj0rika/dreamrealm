# Feature Spec: Story Director (총괄 스토리 작가)

## 개요
narrator와 별개로 동작하는 "총괄 스토리 작가 AI"를 도입하여, 매 턴의 서술이 하나의 큰 이야기 안에서 방향성을 갖도록 한다.

## 아키텍처

```
┌─────────────────────────────────────────────┐
│                월드 생성 시                    │
│  World Generator → Story Director (초기)     │
│  → story_direction JSONB 저장               │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│              매 턴 처리                       │
│                                              │
│  story_direction ──→ context-builder         │
│       (컨텍스트에    ──→ narrator (서술 생성)  │
│        "## 스토리 방향"                       │
│         섹션으로 삽입)                         │
│                                              │
│  [트리거 발생 시]                              │
│  importance ≥ 5 / ≥ 7 / 10턴 주기           │
│       → Story Director 별도 호출 (비동기)     │
│       → story_direction 업데이트             │
│       → 해결된 thread → embeddings 아카이빙   │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│              엔딩 흐름                        │
│                                              │
│  current_act = "결말"                        │
│  → narrator가 마무리 선택지 포함              │
│  → 유저 선택 시 completed_at 기록            │
│  → 완결 오버레이 + 대시보드 배지              │
│  → 강제 종료 없음 (계속 가능)                 │
└─────────────────────────────────────────────┘
```

## story_direction 구조

```typescript
interface StoryDirection {
    current_act: "발단" | "위기" | "절정" | "결말";
    tension_level: number;        // 0.0 ~ 1.0
    active_threads: string[];     // 진행 중인 서사 줄기 (2~4개)
    next_beats: string[];         // 다음 2~3턴에 일어나야 할 것
    foreshadowing: string[];      // 나중을 위한 복선
    avoid: string[];              // 지금은 하지 말아야 할 것
    estimated_climax_turn: number;// 예상 클라이맥스 턴
    ending_outline: string;       // 결말 윤곽
    resolved_threads?: string[];  // 해결되어 아카이빙 대기 중인 줄기
}
```

## 트리거 조건

| 트리거 | 조건 | 스토리 작가 동작 |
|--------|------|-----------------|
| 중요 이벤트 | importance ≥ 5 | 방향 재조정, beat 업데이트 |
| 전환점 | importance ≥ 7 | 막 전환 가능, 대폭 수정 |
| 정기 점검 | 10턴 주기 | session_summary와 동시, 정기 평가 |
| 토큰 초과 | direction > 1500 토큰 | 강제 압축 (오래된 복선/beat 제거) |

## 압축 전략

1. **해결된 thread** → `memory_embeddings` (content_type="resolved_thread") 저장 후 direction에서 제거
2. **완료된 next_beats** → 삭제
3. **사용되지 않은 오래된 foreshadowing** → 삭제
4. **3턴 이상 미언급 active_thread** → resolved_threads로 이동

## 유저 이탈 대응

```
유저가 메인 스토리 무시 (예: 낚시만 함)
    │
    ├─ 1차: next_beats에 유도 이벤트 추가
    │       "NPC가 플레이어를 찾아온다"
    │       "근처에서 이상한 소리가 난다"
    │
    └─ 2차 (계속 이탈): 작가가 적응
            active_threads를 플레이어 행동에 맞게 재구성
            avoid에 "강제 전개" 항상 포함
```

## 엔딩 흐름

```
작가: current_act → "결말"
    │
    ▼
narrator: 엔딩 분위기 조성 + 마무리 선택지
    │
    ├─ 유저가 마무리 선택 → completed_at 기록 → 완결 오버레이
    │                      → 대시보드 "완결" 배지
    │                      → "이어서 새 이야기" 옵션
    │
    └─ 유저가 다른 선택 → 이야기 계속 (새 chapter)
                          강제 종료 없음
```

## 비용 영향

- 스토리 작가 호출: 평균 5~10턴에 1회 (importance ≥ 5 빈도에 따라)
- 턴당 추가 비용: ~$0.00005 (전체 턴 비용의 ~15%)
- 평상시(트리거 없는 턴): 추가 비용 $0

## 변경 파일 목록

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `006_story_direction.sql` | 신규 | DB 마이그레이션 |
| `story-director.ts` (prompts) | 신규 | 초기 생성 + 재조정 프롬프트 |
| `world.ts` (types) | 수정 | StoryDirection 타입 + World 필드 |
| `schemas.ts` | 수정 | storyDirectionSchema (Zod) |
| `worlds.ts` (db) | 수정 | updateWorld에 story_direction 허용 |
| `worlds/route.ts` | 수정 | 초기 direction 생성 |
| `context-builder.ts` | 수정 | narrator 컨텍스트에 direction 포함 |
| `narrator.ts` | 수정 | 스토리 방향 참고 규칙 |
| `turn/route.ts` | 수정 | 재조정 트리거 + 엔딩 감지 |
| `world/[id]/page.tsx` | 수정 | 완결 오버레이 |
| `WorldCard.tsx` | 수정 | 완결 배지 |

## 미구현 (Out of Scope)

- 멀티 엔딩 트리 (분기별 완전히 다른 스토리라인)
- 유저가 직접 스토리 방향을 설정하는 UI
- 복수 chapter 시리즈 관리
- 스토리 퀄리티 자동 평가
