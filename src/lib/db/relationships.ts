import { createServerClient } from "./supabase";
import type { Relationship } from "@/types/world";

export async function getRelationship(relationshipId: string): Promise<Relationship> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("relationships")
        .select("*")
        .eq("id", relationshipId)
        .single();

    if (error) throw error;
    return data as Relationship;
}

export async function getEntityRelationships(entityId: string): Promise<Relationship[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("relationships")
        .select("*")
        .or(`entity_id.eq.${entityId},target_entity_id.eq.${entityId}`)
        .order("strength", { ascending: false });

    if (error) throw error;
    return data as Relationship[];
}

export async function createRelationship(params: {
    world_id: string;
    entity_id: string;
    target_entity_id: string;
    relationship_type: string;
    strength?: number;
    decay_rate?: number;
}): Promise<Relationship> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("relationships")
        .insert(params)
        .select()
        .single();

    if (error) throw error;
    return data as Relationship;
}

export async function updateRelationship(
    relationshipId: string,
    updates: Partial<Pick<Relationship, "relationship_type" | "strength" | "history" | "decay_rate">>
): Promise<Relationship> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("relationships")
        .update(updates)
        .eq("id", relationshipId)
        .select()
        .single();

    if (error) throw error;
    return data as Relationship;
}
