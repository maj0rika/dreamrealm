import type OpenAI from "openai";
import type { GeneratedWorldSpec } from "@/lib/ai/schemas";

const SYSTEM_PROMPT = `너는 한국어 인터랙티브 픽션 내레이터야. 시작 장면을 생성해.

[출력 언어: 한국어 전용]
- 모든 텍스트를 한국어로만 써.
- 한자, 일본어, 키릴 문자, 영어 단어를 텍스트에 절대 쓰지 마.
- 외래어는 한글 표기: "카페", "레스토랑", "도서관" 등
- 유일한 예외: image_prompt만 영어로 작성.

[서술 규칙]
- 2인칭 현재형 ("당신은 ~한다", "눈앞에 ~이 펼쳐진다")
- 4~7문장, 감각 묘사 포함 (시각, 청각, 후각)
- 선택지 3개, 각각 다른 방향 (탐험/대화/조사)
- 시작 장면이므로 아이템 변동/관계 변경 없음

[JSON 출력 형식]
{
  "narration": "한국어 서술문 4~7문장",
  "choices": [
    {"id": 1, "text": "한국어 선택지"},
    {"id": 2, "text": "한국어 선택지"},
    {"id": 3, "text": "한국어 선택지"}
  ],
  "mood": "tense|calm|mysterious|joyful|melancholic|fearful|romantic|comedic|epic|neutral",
  "location_changed": null,
  "items_gained": [],
  "items_lost": [],
  "relationship_changes": [],
  "event": {"description": "한국어 이벤트 설명", "importance": 3, "participants": []},
  "generate_image": true,
  "image_prompt": "영문 50단어 이상. 시작 장소 시각 요소, 시간대, 조명, 날씨, 카메라 앵글, 분위기. 아트 스타일 제외."
}`;

const FEW_SHOT_EXAMPLE = `{
  "narration": "당신은 새로운 학교의 정문 앞에 서 있다. 봄바람이 벚꽃 잎을 흩날리고, 학생들의 웃음소리가 운동장에서 들려온다. 교복을 가지런히 입은 학생들이 삼삼오오 교문을 지나간다. 정문 위 현판에는 학교 이름이 큼지막하게 적혀 있다. 가방 끈을 고쳐 잡으며, 첫 등교에 대한 기대와 긴장이 뒤섞인다. 어디선가 은은한 꽃향기가 코끝을 스친다.",
  "choices": [
    {"id": 1, "text": "교실로 향하는 학생들의 무리를 따라간다"},
    {"id": 2, "text": "학교 안내판을 살펴보며 구조를 파악한다"},
    {"id": 3, "text": "정문 근처에 서 있는 학생에게 말을 건다"}
  ],
  "mood": "joyful",
  "location_changed": null,
  "items_gained": [],
  "items_lost": [],
  "relationship_changes": [],
  "event": {"description": "새로운 학교에 첫 발을 내딛다", "importance": 3, "participants": []},
  "generate_image": true,
  "image_prompt": "Wide establishing shot of a Japanese high school entrance in spring, cherry blossom petals drifting in warm morning breeze, students in navy uniforms walking through iron gates, golden hour sunlight casting long shadows, atmospheric and nostalgic, clear sky"
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
            content: "시작 장면을 생성해줘."
        },
        {
            role: "assistant",
            content: FEW_SHOT_EXAMPLE
        },
        {
            role: "user",
            content: `다음 월드의 시작 장면을 한국어로 생성해줘.\n\n${worldContext}`,
        },
    ];
}
