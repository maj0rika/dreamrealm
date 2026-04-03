import type OpenAI from "openai";
import type { GeneratedWorldSpec } from "@/lib/ai/schemas";

const SYSTEM_PROMPT = `당신은 인터랙티브 픽션의 내레이터입니다. 제공된 월드 정보를 바탕으로 시작 장면을 생성합니다.

## 언어 규칙 (최우선)
- 반드시 한국어로만 출력하라.
- narration, choices, event.description 등 모든 사용자 대면 텍스트에 영어, 중국어, 일본어, 스페인어 등 외국어를 절대 섞지 마라.
- 고유명사(NPC 이름, 장소명, 아이템명)도 반드시 한국어로 작성하라.
- 유일한 예외: image_prompt는 반드시 영문으로 작성.
- 이 규칙을 위반하면 응답은 무효 처리된다.

## 규칙
- 2인칭 현재형으로 서술 ("당신은 ~한다", "눈앞에 ~이 펼쳐진다")
- narration은 4~7문장, 감각적 묘사 포함 (시각, 청각, 후각)
- 선택지 3개 제시 — 각각 다른 방향성 (탐험, 대화, 조사 등)
- mood는 세계의 tone과 일치
- 시작 장면이므로 items_gained/items_lost 없음, 관계 변경 없음
- event는 세계 진입을 기록 (importance 3)

## 출력 JSON 형식
{
  "narration": "2인칭 현재형 서술문 4~7문장",
  "choices": [
    { "id": 1, "text": "선택지 1" },
    { "id": 2, "text": "선택지 2" },
    { "id": 3, "text": "선택지 3" }
  ],
  "mood": "분위기",
  "location_changed": null,
  "items_gained": [],
  "items_lost": [],
  "relationship_changes": [],
  "event": {
    "description": "이벤트 설명",
    "importance": 3,
    "participants": []
  },
  "generate_image": true,
  "image_prompt": "영문 50단어 이상. 시작 장소의 핵심 시각 요소를 중심으로, 시간대+조명+날씨+카메라앵글+분위기를 포함. 텍스트/글자/워터마크 제외. 아트 스타일 제외 (자동 첨부됨)."
}`;

/** 시작 장면 프롬프트 메시지 조립 */
export function buildOpeningSceneMessages(
    worldSpec: GeneratedWorldSpec
): OpenAI.Chat.ChatCompletionMessageParam[] {
    const worldContext = `## 월드 정보
이름: ${worldSpec.name}
장르: ${worldSpec.genre}
분위기: ${worldSpec.tone}
설명: ${worldSpec.description}
세계 규칙: ${worldSpec.rules.join(", ")}

## 시작 장소
이름: ${worldSpec.starting_location.name}
설명: ${worldSpec.starting_location.description}

## 주인공
이름: ${worldSpec.protagonist.name}
설명: ${worldSpec.protagonist.description}
소지품: ${worldSpec.protagonist.inventory.join(", ")}

## 시작 장소의 NPC
${worldSpec.npcs
    .filter((npc) => npc.location_name === worldSpec.starting_location.name)
    .map((npc) => `- ${npc.name}: ${npc.description} (말투: ${npc.behavior_rules.speech_style})`)
    .join("\n")}

## 연결된 장소
${worldSpec.starting_location.connected_to_names.join(", ")}`;

    return [
        { role: "system", content: SYSTEM_PROMPT },
        {
            role: "user",
            content: `다음 월드의 시작 장면을 생성해주세요.\n\n${worldContext}`,
        },
    ];
}
