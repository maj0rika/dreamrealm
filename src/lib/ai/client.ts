import OpenAI from "openai";
import type { Plan } from "@/types/user";
import { hasForeignText, sanitizeKoreanResponse } from "./sanitize-korean";

let _openRouterClient: OpenAI | null = null;
let _groqClient: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
    if (!_openRouterClient) {
        _openRouterClient = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_API_KEY,
        });
    }
    return _openRouterClient;
}

function getGroqClient(): OpenAI {
    if (!_groqClient) {
        _groqClient = new OpenAI({
            baseURL: "https://api.groq.com/openai/v1",
            apiKey: process.env.GROQ_API_KEY,
        });
    }
    return _groqClient;
}

/** 플랜별 모델 선택 */
export function getModel(userPlan: Plan): string {
    if (userPlan === "free") {
        return "llama-3.3-70b-versatile";
    }
    return "deepseek/deepseek-chat-v3";
}

/** 플랜별 클라이언트 선택 */
export function getClient(userPlan: Plan): OpenAI {
    if (userPlan === "free") {
        return getGroqClient();
    }
    return getOpenRouterClient();
}

interface CallAIOptions {
    temperature?: number;
    maxTokens?: number;
}

/** 통합 AI 호출 함수 — JSON 모드 강제, 1회 재시도 */
export async function callAI(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    userPlan: Plan,
    options: CallAIOptions = {}
): Promise<string> {
    const client = getClient(userPlan);
    const model = getModel(userPlan);
    const { temperature = 0.7, maxTokens } = options;

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
        model,
        messages,
        temperature,
        response_format: { type: "json_object" },
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
    };

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await client.chat.completions.create(params);
            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error("AI 응답이 비어있습니다");
            }

            // 외국어 감지 시 로그 + sanitize 폴백 (재시도 없이 토큰 절약)
            if (hasForeignText(content)) {
                console.warn("[callAI] 외국어 감지됨, sanitize 적용");
            }
            return sanitizeKoreanResponse(content);
        } catch (error) {
            if (attempt === 1) throw error;
            // 첫 번째 실패 시 재시도
        }
    }

    throw new Error("AI 호출에 실패했습니다");
}
