"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/db/supabase-browser";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/user";

interface AuthState {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
}

export function useAuth() {
    const supabase = useMemo(() => createBrowserClient(), []);
    const [state, setState] = useState<AuthState>({
        user: null,
        profile: null,
        loading: true,
    });

    useEffect(() => {
        // 현재 세션 조회
        async function getSession() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .single();

                setState({ user, profile, loading: false });
            } else {
                setState({ user: null, profile: null, loading: false });
            }
        }

        getSession();

        // 인증 상태 변경 구독
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const user = session?.user ?? null;

            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .single();

                setState({ user, profile, loading: false });
            } else {
                setState({ user: null, profile: null, loading: false });
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

    async function signOut() {
        await supabase.auth.signOut();
        setState({ user: null, profile: null, loading: false });
    }

    return { ...state, signOut };
}
