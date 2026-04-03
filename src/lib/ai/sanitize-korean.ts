/**
 * AI 응답 JSON에서 사용자 대면 텍스트의 외국어를 감지하고 제거한다.
 * 감지 시 callAI에서 재시도 → 최종 폴백으로 제거 처리.
 */

// ─── 감지용 (no `g` flag — .test()의 lastIndex 버그 방지) ───
const CYRILLIC_D = /[\u0400-\u04FF]/;
const CJK_D = /[\u4E00-\u9FFF]/;
const HIRAGANA_D = /[\u3040-\u309F]/;
const KATAKANA_D = /[\u30A0-\u30FF]/;
const LATIN_EXT_D = /[\u00C0-\u024F]/;
// ENGLISH_WORD_D는 hasForeignText에서 ENGLISH_WORDS_R로 매칭 후 필터링하므로 별도 감지 불필요

// ─── 제거용 (with `g` flag — .replace()에서 전체 매칭) ───
const CYRILLIC_R = /[\u0400-\u04FF]+/g;
const CJK_R = /[\u4E00-\u9FFF]+/g;
const HIRAGANA_R = /[\u3040-\u309F]+/g;
const KATAKANA_R = /[\u30A0-\u30FF]+/g;
const LATIN_EXT_R = /[\u00C0-\u024F]+/g;
const ENGLISH_WORDS_R = /\b[a-zA-Z]{3,}\b/g;
// 추가 유니코드 범위
const ARABIC_R = /[\u0600-\u06FF]+/g;
const THAI_R = /[\u0E00-\u0E7F]+/g;
const DEVANAGARI_R = /[\u0900-\u097F]+/g;
const FULLWIDTH_LATIN_R = /[\uFF01-\uFF5E]+/g;

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

/** 텍스트 배열 추출 (JSON 파싱 → 사용자 대면 필드만) */
function extractUserFacingTexts(jsonStr: string): string[] {
    try {
        const obj = JSON.parse(jsonStr);
        const texts: string[] = [];

        if (typeof obj.narration === "string") texts.push(obj.narration);
        if (Array.isArray(obj.choices)) {
            for (const c of obj.choices) {
                if (typeof c.text === "string") texts.push(c.text);
            }
        }
        if (obj.event && typeof obj.event.description === "string") {
            texts.push(obj.event.description);
        }
        if (typeof obj.name === "string") texts.push(obj.name);
        if (typeof obj.description === "string") texts.push(obj.description);
        if (Array.isArray(obj.npcs)) {
            for (const npc of obj.npcs) {
                if (typeof npc.name === "string") texts.push(npc.name);
                if (typeof npc.description === "string") texts.push(npc.description);
            }
        }
        if (Array.isArray(obj.rules)) {
            for (const r of obj.rules) {
                if (typeof r === "string") texts.push(r);
            }
        }
        // time passage events
        if (Array.isArray(obj.events)) {
            for (const e of obj.events) {
                if (typeof e.description === "string") texts.push(e.description);
                if (typeof e.summary === "string") texts.push(e.summary);
            }
        }
        if (typeof obj.summary === "string") texts.push(obj.summary);

        return texts;
    } catch {
        return [];
    }
}

/**
 * 텍스트에 외국어가 포함되어 있는지 감지한다.
 * image_prompt 필드는 제외하고 사용자 대면 텍스트만 검사.
 */
export function hasForeignText(jsonStr: string): boolean {
    const texts = extractUserFacingTexts(jsonStr);
    if (texts.length === 0) return false;
    const combined = texts.join(" ");

    // 비라틴 외국어 감지
    if (
        CYRILLIC_D.test(combined) ||
        CJK_D.test(combined) ||
        HIRAGANA_D.test(combined) ||
        KATAKANA_D.test(combined) ||
        LATIN_EXT_D.test(combined)
    ) {
        return true;
    }

    // 영어 단어 감지 (허용 목록 제외)
    const englishMatches = combined.match(ENGLISH_WORDS_R);
    if (englishMatches) {
        const unexpected = englishMatches.filter(
            (m) => !ALLOWED_ENGLISH.has(m.toLowerCase())
        );
        if (unexpected.length > 0) {
            console.warn("[sanitize] 비허용 영어 단어 감지:", unexpected.slice(0, 5).join(", "));
            return true;
        }
    }

    return false;
}

/**
 * 텍스트에서 외국어 문자를 제거한다 (최종 폴백용).
 */
function cleanForeignChars(text: string): string {
    let cleaned = text;

    cleaned = cleaned.replace(CYRILLIC_R, "");
    cleaned = cleaned.replace(CJK_R, "");
    cleaned = cleaned.replace(HIRAGANA_R, "");
    cleaned = cleaned.replace(KATAKANA_R, "");
    cleaned = cleaned.replace(LATIN_EXT_R, "");
    cleaned = cleaned.replace(ARABIC_R, "");
    cleaned = cleaned.replace(THAI_R, "");
    cleaned = cleaned.replace(DEVANAGARI_R, "");
    cleaned = cleaned.replace(FULLWIDTH_LATIN_R, "");

    // 허용 목록에 없는 영어 단어 제거
    cleaned = cleaned.replace(ENGLISH_WORDS_R, (match) => {
        return ALLOWED_ENGLISH.has(match.toLowerCase()) ? match : "";
    });

    // 다중 공백 정리
    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
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

        // image_prompt: 한자/키릴 등 비영어 제거 (영문 유지)
        if (typeof obj.image_prompt === "string") {
            obj.image_prompt = obj.image_prompt
                .replace(/[\u4E00-\u9FFF]+/g, "")
                .replace(/[\u3040-\u309F]+/g, "")
                .replace(/[\u30A0-\u30FF]+/g, "")
                .replace(/[\u0400-\u04FF]+/g, "")
                .replace(/[\uAC00-\uD7AF]+/g, "")  // 한글도 제거 (image_prompt는 영문 전용)
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
        // 시간 경과 이벤트
        if (Array.isArray(obj.events)) {
            for (const event of obj.events) {
                if (typeof event.description === "string") {
                    event.description = cleanForeignChars(event.description);
                }
                if (typeof event.time_description === "string") {
                    event.time_description = cleanForeignChars(event.time_description);
                }
            }
        }
        if (typeof obj.summary === "string") {
            obj.summary = cleanForeignChars(obj.summary);
        }

        return JSON.stringify(obj);
    } catch {
        return jsonStr;
    }
}
