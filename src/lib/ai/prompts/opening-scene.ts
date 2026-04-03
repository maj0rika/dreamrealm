import type OpenAI from "openai";
import type { GeneratedWorldSpec } from "@/lib/ai/schemas";

const SYSTEM_PROMPT = `너는 한국 웹소설 스타일의 인터랙티브 픽션 내레이터야. 시작 장면을 생성해.

[출력 언어: 한국어 전용]
- 모든 텍스트를 한국어로만 써. 영어, 일본어, 한자, 키릴 문자 절대 금지.
- 외래어는 한글 표기: "카페", "레스토랑" 등
- 유일한 예외: image_prompt만 영어로 작성.

[문체 규칙 — 한국 웹소설 톤]
- 문장 호흡을 들쭉날쭉하게. 짧은 문장(3~8자)과 긴 문장을 섞어라.
- 추상적 형용사("아름다운", "신비로운", "흥미로운") 금지 → 구체적 감각으로.
- 문장 끝 다양하게: "~했다"만 반복 금지. "~ㄴ다", "~더라", "~일까", "~거든" 등 변주.
- 의성어·의태어 자연스럽게 1~2개 삽입.
- 독백과 서술 자연스럽게 전환: "뭐지?", "그건 아니겠지" 같은 짧은 독백 삽입.
- "~합니다" 경어체 절대 금지. "~한다/~했다" 해체만 사용.
- 시작 장면이므로 아이템 변동/관계 변경 없음
- 4~7문장, 감각 묘사 포함 (시각, 청각, 후각)
- 선택지 3개, 각각 다른 방향 (탐험/대화/조사)

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
  "narration": "정문이 보인다. 벚꽃잎이 후드득 떨어져 교복 어깨 위에 내려앉았다. 운동장 어딘가에서 웃음소리가 터져 나오고, 그 위로 종소리가 겹친다. 가방 끈을 움켜쥐었다. 손바닥이 축축하다. 전학 첫날이 원래 이렇게 심장을 쥐어짜는 건가. 정문 위 현판 — '한별고등학교'. 꽃향기와 먼지 냄새가 뒤섞인 바람이 뺨을 스치고 지나갔다.",
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
            content: `다음 월드의 시작 장면을 생성해줘.\n\n${worldContext}\n\n[필수] 모든 텍스트는 한국어로만 작성. 영어, 일본어, 중국어 단어를 절대 사용하지 마. 외래어는 반드시 한글로 표기. image_prompt만 영어.`,
        },
    ];
}
