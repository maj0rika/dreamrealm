"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/db/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function LoginPage() {
    const router = useRouter();
    const supabase = useMemo(() => createBrowserClient(), []);
    const getSupabase = () => supabase;

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleEmailLogin() {
        setError(null);
        setLoading(true);
        const { error } = await getSupabase().auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }
        router.push("/dashboard");
    }

    async function handleEmailSignUp() {
        setError(null);
        setLoading(true);
        const { error } = await getSupabase().auth.signUp({
            email,
            password,
        });
        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }
        router.push("/dashboard");
    }

    async function handleGoogleLogin() {
        setError(null);
        const { error } = await getSupabase().auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/callback`,
            },
        });
        if (error) {
            setError(error.message);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#08080d] px-4">
            <div className="w-full max-w-md">
                {/* 로고 & 타이틀 */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-bold tracking-tight text-white">
                        Dream<span className="text-[#7c6aff]">Realm</span>
                    </h1>
                    <p className="mt-2 text-sm text-zinc-400">
                        세계가 당신을 기억합니다
                    </p>
                </div>

                {/* 카드 */}
                <div className="rounded-2xl border border-white/10 bg-[#111118] p-6 shadow-2xl">
                    {/* Google 로그인 */}
                    <Button
                        variant="outline"
                        size="lg"
                        className="mb-6 h-11 w-full gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        onClick={handleGoogleLogin}
                    >
                        <svg className="size-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Google로 계속하기
                    </Button>

                    {/* 구분선 */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="bg-[#111118] px-3 text-zinc-500">
                                또는
                            </span>
                        </div>
                    </div>

                    {/* 탭: 로그인 / 회원가입 */}
                    <Tabs defaultValue="login">
                        <TabsList className="mb-4 w-full bg-white/5">
                            <TabsTrigger
                                value="login"
                                className="flex-1 text-zinc-400 data-active:text-white"
                            >
                                로그인
                            </TabsTrigger>
                            <TabsTrigger
                                value="register"
                                className="flex-1 text-zinc-400 data-active:text-white"
                            >
                                회원가입
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="login">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleEmailLogin();
                                }}
                                className="flex flex-col gap-4"
                            >
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-zinc-300">
                                        이메일
                                    </Label>
                                    <Input
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) =>
                                            setEmail(e.target.value)
                                        }
                                        required
                                        className="h-10 border-white/10 bg-white/5 text-white placeholder:text-zinc-600 focus-visible:border-[#7c6aff] focus-visible:ring-[#7c6aff]/30"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-zinc-300">
                                        비밀번호
                                    </Label>
                                    <Input
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        required
                                        className="h-10 border-white/10 bg-white/5 text-white placeholder:text-zinc-600 focus-visible:border-[#7c6aff] focus-visible:ring-[#7c6aff]/30"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    size="lg"
                                    disabled={loading}
                                    className="h-10 w-full bg-[#7c6aff] text-white hover:bg-[#6b5ce7]"
                                >
                                    {loading ? "로그인 중..." : "로그인"}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="register">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleEmailSignUp();
                                }}
                                className="flex flex-col gap-4"
                            >
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-zinc-300">
                                        이메일
                                    </Label>
                                    <Input
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) =>
                                            setEmail(e.target.value)
                                        }
                                        required
                                        className="h-10 border-white/10 bg-white/5 text-white placeholder:text-zinc-600 focus-visible:border-[#4ecdc4] focus-visible:ring-[#4ecdc4]/30"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-zinc-300">
                                        비밀번호
                                    </Label>
                                    <Input
                                        type="password"
                                        placeholder="6자 이상"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        required
                                        minLength={6}
                                        className="h-10 border-white/10 bg-white/5 text-white placeholder:text-zinc-600 focus-visible:border-[#4ecdc4] focus-visible:ring-[#4ecdc4]/30"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    size="lg"
                                    disabled={loading}
                                    className="h-10 w-full bg-[#4ecdc4] text-[#08080d] hover:bg-[#3db8b0]"
                                >
                                    {loading
                                        ? "가입 처리 중..."
                                        : "계정 만들기"}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>

                    {/* 에러 메시지 */}
                    {error && (
                        <p className="mt-4 text-center text-sm text-red-400">
                            {error}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
