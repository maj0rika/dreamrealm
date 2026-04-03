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
        return "qwen/qwen3-32b";
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
    skipKoreanCorrection?: boolean;
}

/** 통합 AI 호출 함수 — JSON 모드 강제, 외국어 감지 시 재시도 */
export async function callAI(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    userPlan: Plan,
    options: CallAIOptions = {}
): Promise<string> {
    const client = getClient(userPlan);
    const model = getModel(userPlan);
    // 기본 temperature를 0.5로 하향 — 외국어 토큰 샘플링 확률 감소
    const { temperature = 0.5, maxTokens, skipKoreanCorrection } = options;

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
        model,
        messages,
        temperature,
        top_p: 0.9,
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

            // 외국어 감지 시 재시도 (첫 시도에만)
            if (hasForeignText(content) && attempt === 0 && !skipKoreanCorrection) {
                console.warn("[callAI] 외국어 감지, correction prompt로 재시도");
                // 이전 응답을 보여주고 한국어만으로 재작성 요청
                const correctionMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
                    ...messages,
                    { role: "assistant", content },
                    {
                        role: "user",
                        content: "위 응답에 한국어가 아닌 외국어(영어, 일본어, 중국어 등)가 섞여 있어. 모든 텍스트를 순수 한국어로만 다시 작성해. 외래어도 한글로 표기해. JSON 형식은 동일하게 유지해.",
                    },
                ];
                params.messages = correctionMessages;
                continue;
            }

            // sanitize 폴백 (재시도 후에도 남은 외국어 제거)
            return sanitizeKoreanResponse(content);
        } catch (error) {
            if (attempt === 1) throw error;
            console.warn("[callAI] 에러 발생, 재시도:", error);
        }
    }

    throw new Error("AI 호출에 실패했습니다");
}
