import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/db/supabase-server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const nextParam = searchParams.get("next") ?? "/dashboard";

    // 오픈 리다이렉트 방지: 내부 경로만 허용
    const next = nextParam.startsWith("/") && !nextParam.startsWith("//")
        ? nextParam
        : "/dashboard";

    if (code) {
        const supabase = await createServerClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // 에러 시 로그인 페이지로 리다이렉트
    return NextResponse.redirect(`${origin}/login`);
}
