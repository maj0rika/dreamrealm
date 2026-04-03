/**
 * AI 응답 JSON에서 사용자 대면 텍스트의 외국어를 감지한다.
 * 감지 시 callAI에서 재시도하여 깨끗한 한국어 응답을 받는다.
 * 최종 폴백으로 제거 처리.
 */

// 외국어 문자 패턴
const CYRILLIC = /[\u0400-\u04FF]+/g;           // 러시아어 등 키릴 문자
const CJK_UNIFIED = /[\u4E00-\u9FFF]+/g;        // 한자 (중국어)
const HIRAGANA = /[\u3040-\u309F]+/g;            // 일본어 히라가나
const KATAKANA = /[\u30A0-\u30FF]+/g;            // 일본어 가타카나
const LATIN_EXTENDED = /[\u00C0-\u024F]+/g;      // 악센트 있는 라틴 (스페인어, 프랑스어)
// 영어 단어 3글자 이상 (JSON 키워드/mood 값 제외)
const ENGLISH_WORDS = /\b[a-zA-Z]{3,}\b/g;

// 허용하는 영어 단어 (JSON 구조에 필요한 값들)
const ALLOWED_ENGLISH = new Set([
    // mood values
    "tense", "calm", "mysterious", "joyful", "melancholic",
    "fearful", "romantic", "comedic", "epic", "neutral",
    // relationship types
    "friend", "rival", "mentor", "stranger", "enemy", "ally", "lover",
    // misc
    "null", "true", "false", "npc", "protagonist",
    // entity types
    "creature", "object", "faction",
    // choice tones
    "bold", "cautious", "diplomatic", "aggressive", "compassionate", "cunning",
]);

/**
 * 텍스트에 외국어가 포함되어 있는지 감지한다.
 * image_prompt 필드는 제외하고 사용자 대면 텍스트만 검사.
 */
export function hasForeignText(jsonStr: string): boolean {
    try {
        const obj = JSON.parse(jsonStr);
        const textsToCheck: string[] = [];

        if (typeof obj.narration === "string") textsToCheck.push(obj.narration);
        if (Array.isArray(obj.choices)) {
            for (const c of obj.choices) {
                if (typeof c.text === "string") textsToCheck.push(c.text);
            }
        }
        if (obj.event && typeof obj.event.description === "string") {
            textsToCheck.push(obj.event.description);
        }
        if (typeof obj.name === "string") textsToCheck.push(obj.name);
        if (typeof obj.description === "string") textsToCheck.push(obj.description);
        if (Array.isArray(obj.npcs)) {
            for (const npc of obj.npcs) {
                if (typeof npc.name === "string") textsToCheck.push(npc.name);
                if (typeof npc.description === "string") textsToCheck.push(npc.description);
            }
        }

        const combined = textsToCheck.join(" ");
        return (
            CYRILLIC.test(combined) ||
            CJK_UNIFIED.test(combined) ||
            HIRAGANA.test(combined) ||
            KATAKANA.test(combined) ||
            LATIN_EXTENDED.test(combined)
        );
    } catch {
        return false;
    }
}

/**
 * 텍스트에서 외국어 문자를 제거한다 (최종 폴백용).
 * 연속된 외국어 + 주변 공백을 깔끔하게 정리.
 */
function cleanForeignChars(text: string): string {
    let cleaned = text;

    // 키릴 문자 제거
    cleaned = cleaned.replace(CYRILLIC, "");

    // 한자 제거 (한국어 문맥에서 한자가 섞인 경우)
    cleaned = cleaned.replace(CJK_UNIFIED, "");

    // 히라가나/가타카나 제거
    cleaned = cleaned.replace(HIRAGANA, "");
    cleaned = cleaned.replace(KATAKANA, "");

    // 악센트 라틴 문자 제거
    cleaned = cleaned.replace(LATIN_EXTENDED, "");

    // 허용 목록에 없는 영어 단어 제거
    cleaned = cleaned.replace(ENGLISH_WORDS, (match) => {
        return ALLOWED_ENGLISH.has(match.toLowerCase()) ? match : "";
    });

    // 다중 공백 정리
    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

    // 빈 따옴표 안 정리 ("  " → "")
    cleaned = cleaned.replace(/"\s*"/g, '""');

    return cleaned;
}

/**
 * AI 응답 JSON 객체의 사용자 대면 필드를 sanitize한다.
 * image_prompt는 영문이므로 건드리지 않는다.
 */
export function sanitizeKoreanResponse(jsonStr: string): string {
    try {
        const obj = JSON.parse(jsonStr);

        // narration
        if (typeof obj.narration === "string") {
            obj.narration = cleanForeignChars(obj.narration);
        }

        // choices
        if (Array.isArray(obj.choices)) {
            for (const choice of obj.choices) {
                if (typeof choice.text === "string") {
                    choice.text = cleanForeignChars(choice.text);
                }
            }
        }

        // event.description
        if (obj.event && typeof obj.event.description === "string") {
            obj.event.description = cleanForeignChars(obj.event.description);
        }

        // event.participants
        if (obj.event && Array.isArray(obj.event.participants)) {
            obj.event.participants = obj.event.participants.map((p: unknown) =>
                typeof p === "string" ? cleanForeignChars(p) : p
            );
        }

        // relationship_changes
        if (Array.isArray(obj.relationship_changes)) {
            for (const rc of obj.relationship_changes) {
                if (typeof rc.entity_name === "string") {
                    rc.entity_name = cleanForeignChars(rc.entity_name);
                }
                if (typeof rc.reason === "string") {
                    rc.reason = cleanForeignChars(rc.reason);
                }
            }
        }

        // location_changed
        if (typeof obj.location_changed === "string") {
            obj.location_changed = cleanForeignChars(obj.location_changed);
        }

        // items
        if (Array.isArray(obj.items_gained)) {
            obj.items_gained = obj.items_gained.map((i: unknown) =>
                typeof i === "string" ? cleanForeignChars(i) : i
            );
        }
        if (Array.isArray(obj.items_lost)) {
            obj.items_lost = obj.items_lost.map((i: unknown) =>
                typeof i === "string" ? cleanForeignChars(i) : i
            );
        }

        // image_prompt: 한국어/한자가 포함되어 있으면 표시 (번역은 호출부에서 처리)
        if (typeof obj.image_prompt === "string") {
            // 한자, 히라가나, 가타카나, 키릴 제거
            obj.image_prompt = obj.image_prompt
                .replace(/[\u4E00-\u9FFF]+/g, "")
                .replace(/[\u3040-\u309F]+/g, "")
                .replace(/[\u30A0-\u30FF]+/g, "")
                .replace(/[\u0400-\u04FF]+/g, "")
                .replace(/\s{2,}/g, " ")
                .trim();
        }

        // WorldSpec 응답용 필드도 처리
        if (typeof obj.name === "string") {
            obj.name = cleanForeignChars(obj.name);
        }
        if (typeof obj.description === "string") {
            obj.description = cleanForeignChars(obj.description);
        }
        if (Array.isArray(obj.rules)) {
            obj.rules = obj.rules.map((r: unknown) =>
                typeof r === "string" ? cleanForeignChars(r) : r
            );
        }
        // 장소
        if (obj.starting_location && typeof obj.starting_location.name === "string") {
            obj.starting_location.name = cleanForeignChars(obj.starting_location.name);
            if (typeof obj.starting_location.description === "string") {
                obj.starting_location.description = cleanForeignChars(obj.starting_location.description);
            }
        }
        if (Array.isArray(obj.additional_locations)) {
            for (const loc of obj.additional_locations) {
                if (typeof loc.name === "string") loc.name = cleanForeignChars(loc.name);
                if (typeof loc.description === "string") loc.description = cleanForeignChars(loc.description);
            }
        }
        // NPC
        if (Array.isArray(obj.npcs)) {
            for (const npc of obj.npcs) {
                if (typeof npc.name === "string") npc.name = cleanForeignChars(npc.name);
                if (typeof npc.description === "string") npc.description = cleanForeignChars(npc.description);
                if (typeof npc.personality === "string") npc.personality = cleanForeignChars(npc.personality);
                if (npc.behavior_rules) {
                    if (typeof npc.behavior_rules.core_drive === "string") {
                        npc.behavior_rules.core_drive = cleanForeignChars(npc.behavior_rules.core_drive);
                    }
                    if (typeof npc.behavior_rules.speech_style === "string") {
                        npc.behavior_rules.speech_style = cleanForeignChars(npc.behavior_rules.speech_style);
                    }
                }
            }
        }
        // 주인공
        if (obj.protagonist) {
            if (typeof obj.protagonist.name === "string") {
                obj.protagonist.name = cleanForeignChars(obj.protagonist.name);
            }
            if (typeof obj.protagonist.description === "string") {
                obj.protagonist.description = cleanForeignChars(obj.protagonist.description);
            }
        }

        return JSON.stringify(obj);
    } catch {
        // JSON 파싱 실패 시 원본 반환
        return jsonStr;
    }
}
