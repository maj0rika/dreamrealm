import { createServerClient } from "./supabase-server";
import type { Event } from "@/types/world";

export async function getEvent(eventId: string): Promise<Event> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

    if (error) throw error;
    return data as Event;
}

export async function getWorldEvents(worldId: string): Promise<Event[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("world_id", worldId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Event[];
}

export async function createEvent(params: {
    world_id: string;
    turn_id?: string;
    description: string;
    importance: number;
    entities_involved?: string[];
    location_id?: string;
}): Promise<Event> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("events")
        .insert(params)
        .select()
        .single();

    if (error) throw error;
    return data as Event;
}

/** 특정 장소에서 아직 플래시백되지 않은 중요 이벤트(importance ≥ 5) 조회 */
export async function getFlashbackEvents(
    worldId: string,
    locationId: string
): Promise<Event[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("world_id", worldId)
        .eq("location_id", locationId)
        .eq("flashback_shown", false)
        .gte("importance", 5)
        .order("importance", { ascending: false })
        .limit(1);

    if (error) throw error;
    return data as Event[];
}

export async function updateEvent(
    eventId: string,
    updates: Partial<Pick<Event, "description" | "importance" | "flashback_shown">>
): Promise<Event> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("events")
        .update(updates)
        .eq("id", eventId)
        .select()
        .single();

    if (error) throw error;
    return data as Event;
}
