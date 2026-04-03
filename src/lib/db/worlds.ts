import { createServerClient } from "./supabase";
import type { World, WorldSpec, WorldTime } from "@/types/world";

export async function getWorld(worldId: string): Promise<World> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("worlds")
        .select("*")
        .eq("id", worldId)
        .single();

    if (error) throw error;
    return data as World;
}

export async function getUserWorlds(userId: string): Promise<World[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("worlds")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

    if (error) throw error;
    return data as World[];
}

export async function createWorld(params: {
    user_id: string;
    name: string;
    genre: string;
    world_spec: WorldSpec;
    world_time?: WorldTime;
    cover_image_url?: string;
}): Promise<World> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("worlds")
        .insert(params)
        .select()
        .single();

    if (error) throw error;
    return data as World;
}

export async function updateWorld(
    worldId: string,
    updates: Partial<Pick<World, "name" | "genre" | "world_spec" | "world_time" | "cover_image_url" | "turn_count" | "is_active">>
): Promise<World> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("worlds")
        .update(updates)
        .eq("id", worldId)
        .select()
        .single();

    if (error) throw error;
    return data as World;
}

export async function deleteWorld(worldId: string): Promise<void> {
    const supabase = await createServerClient();
    const { error } = await supabase
        .from("worlds")
        .delete()
        .eq("id", worldId);

    if (error) throw error;
}
