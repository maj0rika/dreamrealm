import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/db/supabase";
import { getUserWorlds } from "@/lib/db/worlds";
import { WorldCard } from "@/components/dashboard/WorldCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Profile } from "@/types/user";

export default async function DashboardPage() {
    const supabase = await createServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    const worlds = await getUserWorlds(user.id);
    const typedProfile = profile as Profile | null;

    // 무료 플랜 일일 생성 한도
    const maxGenerations = typedProfile?.plan === "free" ? 5 : typedProfile?.plan === "pro" ? 50 : 999;
    const used = typedProfile?.daily_generations_used ?? 0;

    return (
        <div className="min-h-screen bg-[#08080d]">
            <div className="mx-auto max-w-4xl px-4 py-8">
                {/* 헤더 */}
                <div className="mb-8 flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-white">
                        Dream<span className="text-[#7c6aff]">Realm</span>
                    </h1>
                    <Link href="/create">
                        <Button className="gap-1.5 bg-[#7c6aff] text-white hover:bg-[#6b5ce7]">
                            <Plus className="size-4" />
                            새 세계 만들기
                        </Button>
                    </Link>
                </div>

                {/* 월드 목록 or 빈 상태 */}
                {worlds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#111118] py-20">
                        <p className="mb-2 text-lg text-zinc-300">
                            아직 만든 세계가 없습니다
                        </p>
                        <p className="mb-6 text-sm text-zinc-500">
                            첫 번째 세계를 만들어보세요!
                        </p>
                        <Link href="/create">
                            <Button className="gap-1.5 bg-[#4ecdc4] text-[#08080d] hover:bg-[#3db8b0]">
                                <Plus className="size-4" />
                                세계 만들기
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {worlds.map((world) => (
                            <WorldCard key={world.id} world={world} />
                        ))}
                    </div>
                )}

                {/* 하단 상태바 */}
                {typedProfile?.plan === "free" && (
                    <div className="mt-8 rounded-xl border border-white/10 bg-[#111118] px-4 py-3 text-center text-sm text-zinc-400">
                        무료 플랜: 오늘{" "}
                        <span className="text-[#4ecdc4]">
                            {Math.max(0, maxGenerations - used)}/{maxGenerations}
                        </span>
                        회 생성 남음
                    </div>
                )}
            </div>
        </div>
    );
}
