import OpenAI from "openai";
import type { Plan } from "@/types/user";

// OpenRouter 클라이언트 (유료 플랜)
const openRouterClient = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

// Groq 클라이언트 (무료 티어 폴백)
const groqClient = new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
});

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
        return groqClient;
    }
    return openRouterClient;
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
    const { temperature = 0.8, maxTokens } = options;

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
            return content;
        } catch (error) {
            if (attempt === 1) throw error;
            // 첫 번째 실패 시 재시도
        }
    }

    throw new Error("AI 호출에 실패했습니다");
}
