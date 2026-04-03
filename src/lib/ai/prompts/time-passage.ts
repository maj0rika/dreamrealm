import type OpenAI from "openai";

const SYSTEM_PROMPT = `너는 한국어 인터랙티브 픽션 세계의 시간 경과 시뮬레이터야.
플레이어가 부재한 동안 세계에서 일어난 사건들을 생성해.

[출력 언어: 한국어 전용]
- 모든 텍스트를 한국어로만 써. 영어, 일본어, 한자 등 외국어 절대 금지.
- 외래어는 한글 표기.

[사건 생성 원칙]
1. 확률 기반: 부재 기간이 길수록 큰 사건이 일어날 확률이 높아지지만, 항상 발생하지는 않는다.
2. 납득 가능성: 모든 사건은 세계관, NPC 성격/목표/행동규칙과 일관되어야 한다.
3. 흥미 유발: 플레이어가 "어, 뭐가 달라졌지?" 하고 궁금해할 만한 사건이어야 한다.
4. NPC 자율성: NPC의 goals, behavioral_triggers, personality_axes를 기반으로 행동을 결정해.

[사건 규모 가이드라인]
- 소규모 (importance 1~3): NPC 위치 이동, 날씨 변화, 사소한 대화
- 중규모 (importance 4~6): 상인 새 물건 입고, NPC 관계 변화, 소문 확산, 새로운 인물 등장
- 대규모 (importance 7~10): 도적 출몰, 축제/재해, NPC 실종/여행, 세력 충돌

[확률 가이드]
- 1~6시간 부재: 소규모 높음, 중규모 낮음, 대규모 거의 없음
- 6~24시간 부재: 소규모 확실, 중규모 확률 상승
- 1~3일 부재: 중규모 확실, 대규모 확률 상승
- 3일+ 부재: 대규모 확률 높음 — 단, 보장 아님. 아무 일도 안 일어날 수도 있다.

[출력: 최대 3~5개 사건, 시간순으로]
{
  "events": [
    {
      "time_description": "부재 N시간째",
      "description": "한국어 사건 설명 1~2문장",
      "importance": 1~10,
      "entities_involved": ["NPC 이름"],
      "location_name": "장소명",
      "state_changes": {
        "entity_moves": [{"entity_name": "NPC명", "to_location": "장소명"}],
        "relationship_changes": [{"entity_name": "NPC명", "target_name": "NPC명", "delta": -2, "reason": "사건 이유"}],
        "items_added": [],
        "items_removed": []
      }
    }
  ],
  "summary": "한국어 1~2문장 요약 — 플레이어에게 보여줄 타임라인 헤더"
}`;

interface TimePassageContext {
    worldName: string;
    genre: string;
    worldRules: string[];
    hoursElapsed: number;
    locations: Array<{ name: string; description: string }>;
    npcs: Array<{
        name: string;
        description: string;
        personality: string;
        locationName: string;
        behaviorRules: {
            core_drive: string;
            goals: string[];
            speech_style: string;
        };
    }>;
    recentSummary: string | null;
}

/** 시간 경과 사건 생성 프롬프트 */
export function buildTimePassageMessages(
    ctx: TimePassageContext
): OpenAI.Chat.ChatCompletionMessageParam[] {
    const npcDescriptions = ctx.npcs
        .map(
            (npc) =>
                `- ${npc.name} (위치: ${npc.locationName}): ${npc.description}\n  핵심 동기: ${npc.behaviorRules.core_drive}\n  목표: ${npc.behaviorRules.goals.join(", ")}`
        )
        .join("\n");

    const locationList = ctx.locations
        .map((l) => `- ${l.name}: ${l.description}`)
        .join("\n");

    const contextText = `## 월드: ${ctx.worldName}
장르: ${ctx.genre}
세계 규칙: ${ctx.worldRules.join(", ")}

## 부재 시간: ${ctx.hoursElapsed}시간

## 장소 목록
${locationList}

## NPC 목록
${npcDescriptions}

${ctx.recentSummary ? `## 최근 상황 요약\n${ctx.recentSummary}` : ""}`;

    return [
        { role: "system", content: SYSTEM_PROMPT },
        {
            role: "user",
            content: `플레이어가 ${ctx.hoursElapsed}시간 동안 부재했어. 이 시간 동안 세계에서 무슨 일이 있었는지 생성해줘.\n\n${contextText}\n\n[필수] 모든 텍스트는 한국어로만 작성. 영어, 일본어, 중국어 단어를 절대 사용하지 마. 외래어는 반드시 한글로 표기.`,
        },
    ];
}
