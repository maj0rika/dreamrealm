import OpenAI from "openai";

const REPLICATE_MODEL_URL = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions";
const REPLICATE_POLL_URL = "https://api.replicate.com/v1/predictions";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 60000;

// 한국어 문자 포함 여부 체크
const KOREAN_REGEX = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;

/**
 * image_prompt에 한국어가 포함되어 있으면 Groq로 영어 번역.
 * 이미 영어면 그대로 반환.
 */
export async function ensureEnglishPrompt(prompt: string): Promise<string> {
    if (!prompt || !KOREAN_REGEX.test(prompt)) {
        return prompt; // 이미 영어
    }

    console.log("[image-prompt] 한국어 감지, 영문 번역 시작");
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return prompt;

    try {
        const client = new OpenAI({
            baseURL: "https://api.groq.com/openai/v1",
            apiKey: groqKey,
        });

        const response = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: "Translate the following Korean image generation prompt to English. Output ONLY the English translation, nothing else. Keep it as a descriptive scene prompt for AI image generation. Include camera angle, lighting, mood, and atmosphere details.",
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 200,
        });

        const translated = response.choices[0]?.message?.content?.trim();
        if (translated) {
            console.log("[image-prompt] 번역 완료:", translated.slice(0, 80));
            return translated;
        }
    } catch (err) {
        console.error("[image-prompt] 번역 실패:", err);
    }

    return prompt;
}

interface ReplicatePrediction {
    id: string;
    status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
    output: string[] | null;
    error: string | null;
}

/**
 * Replicate FLUX.1 Schnell 모델로 이미지 생성
 * 성공: 이미지 URL 반환, 실패: null
 * @param seed 고정 시드 — 같은 장소에서 일관된 이미지 생성용
 */
export async function generateImage(prompt: string, seed?: number): Promise<string | null> {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        console.error("[image-generator] REPLICATE_API_TOKEN이 설정되지 않았습니다");
        return null;
    }

    try {
        // 한국어 프롬프트면 영어로 번역
        const finalPrompt = await ensureEnglishPrompt(prompt);
        console.log("[image-generator] API 호출 시작, prompt:", finalPrompt.slice(0, 80));

        // 1. Prediction 생성 (Prefer: wait 사용하지 않음 — fire-and-forget 호환)
        const createResponse = await fetch(REPLICATE_MODEL_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                input: {
                    prompt: finalPrompt,
                    num_outputs: 1,
                    aspect_ratio: "16:9",
                    output_format: "webp",
                    output_quality: 80,
                    ...(seed !== undefined && { seed }),
                },
            }),
        });

        if (!createResponse.ok) {
            const errBody = await createResponse.text().catch(() => "");
            console.error("[image-generator] Prediction 생성 실패:", createResponse.status, errBody);
            return null;
        }

        const prediction: ReplicatePrediction = await createResponse.json();
        console.log("[image-generator] Prediction 생성됨:", prediction.id, "status:", prediction.status);

        // Prefer: wait 없이도 이미 succeeded일 수 있음
        if (prediction.status === "succeeded" && prediction.output && prediction.output.length > 0) {
            console.log("[image-generator] 즉시 완료:", prediction.output[0].slice(0, 80));
            return prediction.output[0];
        }

        // 2. 폴링으로 완료 대기
        const startTime = Date.now();
        let current = prediction;

        while (
            current.status !== "succeeded" &&
            current.status !== "failed" &&
            current.status !== "canceled"
        ) {
            if (Date.now() - startTime > MAX_POLL_MS) {
                console.error("[image-generator] 폴링 타임아웃 (60초 초과)");
                return null;
            }

            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

            console.log("[image-generator] 폴링 중...", current.id, "경과:", Math.round((Date.now() - startTime) / 1000) + "초");

            const pollResponse = await fetch(`${REPLICATE_POLL_URL}/${current.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!pollResponse.ok) {
                console.error("[image-generator] 폴링 실패:", pollResponse.status);
                return null;
            }

            current = await pollResponse.json();
            console.log("[image-generator] 폴링 상태:", current.status);
        }

        if (current.status === "succeeded" && current.output && current.output.length > 0) {
            console.log("[image-generator] 이미지 생성 성공:", current.output[0].slice(0, 80));
            return current.output[0];
        }

        console.error("[image-generator] 이미지 생성 실패:", current.error);
        return null;
    } catch (error) {
        console.error("[image-generator] 예외 발생:", error);
        return null;
    }
}
