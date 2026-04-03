import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/db/supabase";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";

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
