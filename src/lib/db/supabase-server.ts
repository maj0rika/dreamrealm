import { createServerClient as _createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버 컴포넌트 / API 라우트용 Supabase 클라이언트
 * Server Components, Server Actions, Route Handlers에서 사용
 */
export async function createServerClient() {
    const cookieStore = await cookies();

    return _createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Server Component에서는 쿠키 설정 불가 — 무시
                    }
                },
            },
        }
    );
}
