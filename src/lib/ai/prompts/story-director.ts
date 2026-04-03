import type OpenAI from "openai";
import type { StoryDirection } from "@/types/world";

const INITIAL_SYSTEM_PROMPT = `너는 인터랙티브 픽션의 총괄 스토리 작가다.
너는 직접 서술을 쓰지 않는다. "방향 지시서(story_direction)"만 만든다.
내레이터가 이 지시서를 참고해서 매 턴을 서술한다.

[역할]
- 세계의 큰 이야기 뼈대를 설계한다
- 긴장과 이완의 리듬을 관리한다
- 복선을 심고, 적절한 타이밍에 회수한다
- 플레이어의 선택이 이야기에 자연스럽게 녹아들도록 한다

[출력 형식 — JSON만 출력]
{
  "current_act": "발단|위기|절정|결말",
  "tension_level": 0.0~1.0,
  "active_threads": ["진행 중인 서사 줄기 1", "서사 줄기 2"],
  "next_beats": ["다음 2~3턴에 일어나야 할 것 1", "것 2"],
  "foreshadowing": ["나중을 위한 복선 1", "복선 2"],
  "avoid": ["지금은 하지 말아야 할 것"],
  "estimated_climax_turn": 30~50,
  "ending_outline": "이야기의 결말 윤곽 한 줄",
  "resolved_threads": []
}

[설계 원칙]
1. active_threads는 2~4개. 너무 많으면 산만, 적으면 단조롭다.
2. next_beats는 구체적이지만 강제적이지 않게. "서준이 비밀을 암시한다" (O) vs "서준이 정체를 밝힌다" (X — 너무 강제)
3. foreshadowing은 나중에 회수할 단서. 최소 2개.
4. avoid는 "아직 이르다"를 표현. 이야기 템포 관리.
5. tension_level은 3막 구조를 따른다: 발단(0.1~0.3) → 위기(0.4~0.6) → 절정(0.7~0.9) → 결말(0.5~0.3)
6. estimated_climax_turn은 30~50턴 사이가 적당.
7. ending_outline은 열린 결말 허용. "정해진 운명"이 아니라 "가능한 방향".

[모든 텍스트는 한국어로 작성. JSON 키만 영어.]`;

const UPDATE_SYSTEM_PROMPT = `너는 인터랙티브 픽션의 총괄 스토리 작가다.
현재까지의 이야기 진행을 평가하고, story_direction을 업데이트해라.

[역할]
- 현재 이야기 상태를 평가한다
- 플레이어의 행동 패턴을 분석한다
- 방향 지시서를 최신 상황에 맞게 갱신한다
- 해결된 서사 줄기를 정리한다
- 필요 시 새로운 줄기를 추가한다

[플레이어 이탈 대응]
- 최근 턴에서 next_beats와 무관한 행동이 연속되면 "이탈"로 판단
- 1차 대응: next_beats에 유도 이벤트 추가 (NPC가 찾아옴, 사건이 다가옴 등)
- 2차 대응 (이탈 지속): active_threads를 플레이어 행동에 맞게 재구성
- avoid에 항상 포함: "플레이어 의지에 반하는 강제 전개"

[압축 규칙]
- 해결된 서사 줄기는 resolved_threads에 1줄 요약으로 이동
- 사용되지 않은 오래된 foreshadowing 제거
- 완료된 next_beats 제거
- 3턴 이상 언급 안 된 active_threads → resolved_threads로 이동

[막 전환 기준]
- 발단→위기: active_threads 중 하나가 갈등으로 발전할 때
- 위기→절정: 핵심 갈등이 정점에 도달, 결정적 선택이 필요할 때
- 절정→결말: 핵심 갈등이 해소되거나 결정적 전환이 일어났을 때
- 결말에서: narrator에게 "엔딩 분위기 조성" + "마무리 선택지 포함" 지시

[출력 형식 — JSON만 출력. 위 INITIAL 프롬프트와 동일한 구조.]
모든 텍스트는 한국어로 작성. JSON 키만 영어.`;

/** 월드 생성 시 초기 story_direction 생성 프롬프트 */
export function buildInitialStoryDirectionMessages(
    worldName: string,
    genre: string,
    description: string,
    rules: string[],
    locations: string[],
    npcs: Array<{ name: string; description: string; core_drive: string; secrets: string[] }>,
    protagonistName: string
): OpenAI.Chat.ChatCompletionMessageParam[] {
    const worldContext = `## 월드 정보
이름: ${worldName}
장르: ${genre}
설명: ${description}
규칙: ${rules.join(", ")}

## 장소: ${locations.join(", ")}

## 주인공: ${protagonistName}

## NPC
${npcs.map(n => `- ${n.name}: ${n.description}\n  핵심동기: ${n.core_drive}\n  비밀: ${n.secrets.join(", ")}`).join("\n")}`;

    return [
        { role: "system", content: INITIAL_SYSTEM_PROMPT },
        {
            role: "user",
            content: `이 세계의 큰 이야기 뼈대를 설계해줘.\n\n${worldContext}\n\n[필수] 모든 텍스트는 한국어로만 작성. NPC의 비밀과 세계 규칙을 활용해서 흥미로운 서사 줄기를 만들어.`,
        },
    ];
}

/** 중요 이벤트 후 story_direction 재조정 프롬프트 */
export function buildStoryDirectionUpdateMessages(
    currentDirection: StoryDirection,
    recentEvents: string[],
    recentPlayerActions: string[],
    currentTurn: number,
    sessionSummary: string | null
): OpenAI.Chat.ChatCompletionMessageParam[] {
    const directionText = JSON.stringify(currentDirection, null, 2);

    const contextParts = [
        `## 현재 스토리 방향\n${directionText}`,
        `## 현재 턴: ${currentTurn}`,
        `## 최근 사건\n${recentEvents.map(e => `- ${e}`).join("\n")}`,
        `## 최근 플레이어 행동\n${recentPlayerActions.map(a => `- ${a}`).join("\n")}`,
    ];

    if (sessionSummary) {
        contextParts.push(`## 세션 요약\n${sessionSummary}`);
    }

    // 토큰 임계치 체크 (story_direction 문자수 / 3 ≈ 토큰)
    const estimatedTokens = Math.ceil(directionText.length / 3);
    const needsCompression = estimatedTokens > 1500;

    let instruction = "위 상황을 바탕으로 story_direction을 업데이트해줘.";
    if (needsCompression) {
        instruction += "\n\n[주의] story_direction이 너무 비대해졌다. 반드시 압축해줘: 해결된 줄기는 resolved_threads로, 오래된 복선은 제거, 완료된 beat는 삭제.";
    }

    return [
        { role: "system", content: UPDATE_SYSTEM_PROMPT },
        {
            role: "user",
            content: `${contextParts.join("\n\n")}\n\n${instruction}\n\n[필수] 모든 텍스트는 한국어로만 작성.`,
        },
    ];
}
