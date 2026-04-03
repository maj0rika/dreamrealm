/** 요금제 */
export type Plan = "free" | "pro" | "premium";

/** 사용자 프로필 */
export interface Profile {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    plan: Plan;
    daily_generations_used: number;
    daily_generations_reset_at: string;
    created_at: string;
    updated_at: string;
}
