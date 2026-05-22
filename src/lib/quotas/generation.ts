import type { Plan } from "@/types/user";

const QUOTA_EXCEEDED_MESSAGE = "GENERATION_QUOTA_EXCEEDED";

interface QuotaRpcRow {
    plan: Plan;
    daily_generations_used: number;
    daily_generation_limit: number;
    daily_generations_reset_at: string;
}

interface SupabaseRpcClient {
    rpc(
        functionName: "consume_generation_quota"
    ): PromiseLike<{
        data: QuotaRpcRow[] | QuotaRpcRow | null;
        error: { message?: string } | null;
    }>;
}

export interface ConsumedGenerationQuota {
    plan: Plan;
    dailyGenerationsUsed: number;
    dailyGenerationLimit: number;
    dailyGenerationsResetAt: string;
}

export class GenerationQuotaExceededError extends Error {
    constructor() {
        super(QUOTA_EXCEEDED_MESSAGE);
        this.name = "GenerationQuotaExceededError";
    }
}

export function isGenerationQuotaExceeded(
    error: unknown
): error is GenerationQuotaExceededError {
    return (
        error instanceof GenerationQuotaExceededError ||
        (error instanceof Error && error.message.includes(QUOTA_EXCEEDED_MESSAGE))
    );
}

export function generationQuotaResponse() {
    return Response.json(
        { error: "오늘 생성 한도를 모두 사용했습니다. 내일 다시 시도해 주세요." },
        { status: 429 }
    );
}

export async function consumeGenerationQuota(
    supabase: SupabaseRpcClient
): Promise<ConsumedGenerationQuota> {
    const { data, error } = await supabase.rpc("consume_generation_quota");

    if (error) {
        if (error.message?.includes(QUOTA_EXCEEDED_MESSAGE)) {
            throw new GenerationQuotaExceededError();
        }
        throw new Error(error.message ?? "generation quota check failed");
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
        throw new Error("generation quota check returned no data");
    }

    return {
        plan: row.plan,
        dailyGenerationsUsed: row.daily_generations_used,
        dailyGenerationLimit: row.daily_generation_limit,
        dailyGenerationsResetAt: row.daily_generations_reset_at,
    };
}

export async function tryConsumeGenerationQuota(
    supabase: SupabaseRpcClient
): Promise<ConsumedGenerationQuota | null> {
    try {
        return await consumeGenerationQuota(supabase);
    } catch (error) {
        if (isGenerationQuotaExceeded(error)) {
            return null;
        }
        throw error;
    }
}
