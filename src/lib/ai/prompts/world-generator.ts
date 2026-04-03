import type OpenAI from "openai";

const SYSTEM_PROMPT = `너는 한국어 인터랙티브 픽션 세계 아키텍트야. 월드를 설계해.

[출력 언어: 한국어 전용]
- name, description, rules, 장소명, NPC명, 성격, 비밀 등 모든 텍스트를 한국어로만 써.
- 한자, 일본어, 키릴 문자, 영어 단어를 텍스트에 절대 쓰지 마.
- 외래어는 한글 표기: "카페", "도서관", "레스토랑" 등
- 영어 허용 필드: name_en, image_prompt, tone, genre, entity_type만

[세계 설계 규칙]
- NPC 최소 3명, 장소 최소 4개 (시작 장소 포함)
- 각 NPC에 고유한 성격, 비밀, 행동 규칙 부여
- 장소들은 connected_to_names로 서로 연결
- 세계 규칙은 이야기에 긴장감과 가능성을 만드는 방향으로

[JSON 출력 형식]
{
  "name": "한국어 세계 이름",
  "name_en": "English World Name",
  "genre": "장르 영문 ID",
  "tone": "영문 분위기 (mysterious, dark, whimsical, tense 등)",
  "description": "한국어 세계 설명 3~5문장",
  "rules": ["한국어 세계 규칙 1", "한국어 세계 규칙 2", "한국어 세계 규칙 3"],
  "starting_location": {
    "name": "한국어 시작 장소명",
    "description": "한국어 장소 설명 2~3문장. 분위기, 냄새, 소리 포함",
    "properties": {"atmosphere": "...", "danger_level": 1},
    "connected_to_names": ["한국어 연결 장소1", "한국어 연결 장소2"]
  },
  "additional_locations": [
    {
      "name": "한국어 장소명",
      "description": "한국어 장소 설명",
      "properties": {"atmosphere": "...", "danger_level": 1},
      "connected_to_names": ["한국어 연결 장소"]
    }
  ],
  "protagonist": {
    "name": "한국어 주인공명",
    "description": "한국어 외형+배경 설명",
    "inventory": ["한국어 아이템"],
    "status": {"health": "good", "mood": "curious"}
  },
  "npcs": [
    {
      "name": "한국어 NPC명",
      "entity_type": "npc",
      "description": "한국어 외형+성격 2~3문장",
      "personality": "한국어 한 줄 성격",
      "location_name": "한국어 위치 장소명",
      "behavior_rules": {
        "core_drive": "한국어 핵심 동기",
        "personality_axes": {"boldness": 0.5, "loyalty": 0.5, "curiosity": 0.5, "honesty": 0.5},
        "goals": ["한국어 목표1", "한국어 목표2"],
        "behavioral_triggers": [{"condition": "한국어 조건", "action": "한국어 행동", "weight": 0.8}],
        "speech_style": "한국어 말투 설명",
        "knowledge": ["한국어 아는 것"],
        "secrets": ["한국어 비밀"]
      }
    }
  ],
  "image_prompt": "영문 50단어 이상. 세계의 상징적 랜드마크, 시간대, 조명, 날씨, 카메라 앵글, 분위기. 텍스트/캐릭터 제외. 아트 스타일 제외."
}`;

/** 월드 생성 프롬프트 메시지 조립 */
export function buildWorldGeneratorMessages(
    genre: string,
    userPrompt: string
): OpenAI.Chat.ChatCompletionMessageParam[] {
    return [
        { role: "system", content: SYSTEM_PROMPT },
        {
            role: "user",
            content: `장르: ${genre}\n\n세계 설명: ${userPrompt}\n\n위 내용을 바탕으로 한국어로 월드를 설계해줘.`,
        },
    ];
}
