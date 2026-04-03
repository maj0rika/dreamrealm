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
