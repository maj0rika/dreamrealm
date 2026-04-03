import { createServerClient } from "./supabase-server";
import type { Entity, BehaviorRules } from "@/types/world";

export async function getEntity(entityId: string): Promise<Entity> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("entities")
        .select("*")
        .eq("id", entityId)
        .single();

    if (error) throw error;
    return data as Entity;
}

export async function getWorldEntities(worldId: string): Promise<Entity[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("entities")
        .select("*")
        .eq("world_id", worldId)
        .order("created_at", { ascending: true });

    if (error) throw error;
    return data as Entity[];
}

export async function createEntity(params: {
    world_id: string;
    name: string;
    entity_type: string;
    description: string;
    personality: string;
    location_id?: string;
    inventory?: Record<string, unknown>[];
    behavior_rules?: BehaviorRules;
}): Promise<Entity> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("entities")
        .insert(params)
        .select()
        .single();

    if (error) throw error;
    return data as Entity;
}

export async function updateEntity(
    entityId: string,
    updates: Partial<Pick<Entity, "name" | "description" | "personality" | "location_id" | "inventory" | "behavior_rules" | "image_url" | "is_alive">>
): Promise<Entity> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("entities")
        .update(updates)
        .eq("id", entityId)
        .select()
        .single();

    if (error) throw error;
    return data as Entity;
}

export async function deleteEntity(entityId: string): Promise<void> {
    const supabase = await createServerClient();
    const { error } = await supabase
        .from("entities")
        .delete()
        .eq("id", entityId);

    if (error) throw error;
}
