import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * 클라이언트 컴포넌트용 Supabase 클라이언트 (싱글턴)
 * 'use client' 컴포넌트에서 사용
 */
export function createBrowserClient(): SupabaseClient {
    if (_client) return _client;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            "NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY 환경 변수가 필요합니다."
        );
    }

    _client = _createBrowserClient(supabaseUrl, supabaseAnonKey);
    return _client;
}
