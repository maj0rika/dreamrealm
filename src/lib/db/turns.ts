import { createServerClient } from "./supabase";
import type { Turn, TurnResponse } from "@/types/world";

export async function getTurn(turnId: string): Promise<Turn> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("turns")
        .select("*")
        .eq("id", turnId)
        .single();

    if (error) throw error;
    return data as Turn;
}

export async function getWorldTurns(worldId: string): Promise<Turn[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("turns")
        .select("*")
        .eq("world_id", worldId)
        .order("turn_number", { ascending: true });

    if (error) throw error;
    return data as Turn[];
}

export async function getLatestTurns(worldId: string, limit: number): Promise<Turn[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("turns")
        .select("*")
        .eq("world_id", worldId)
        .order("turn_number", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data as Turn[]).reverse();
}

export async function createTurn(params: {
    world_id: string;
    turn_number: number;
    user_input: string;
    ai_response: TurnResponse;
    image_url?: string;
}): Promise<Turn> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("turns")
        .insert(params)
        .select()
        .single();

    if (error) throw error;
    return data as Turn;
}
