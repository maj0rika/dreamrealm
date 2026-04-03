import { createServerClient } from "./supabase";
import type { Location } from "@/types/world";

export async function getLocation(locationId: string): Promise<Location> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("id", locationId)
        .single();

    if (error) throw error;
    return data as Location;
}

export async function getWorldLocations(worldId: string): Promise<Location[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("world_id", worldId)
        .order("created_at", { ascending: true });

    if (error) throw error;
    return data as Location[];
}

export async function createLocation(params: {
    world_id: string;
    name: string;
    description: string;
    connected_to?: string[];
    discovered?: boolean;
}): Promise<Location> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("locations")
        .insert(params)
        .select()
        .single();

    if (error) throw error;
    return data as Location;
}

export async function updateLocation(
    locationId: string,
    updates: Partial<Pick<Location, "name" | "description" | "connected_to" | "discovered" | "image_url">>
): Promise<Location> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("locations")
        .update(updates)
        .eq("id", locationId)
        .select()
        .single();

    if (error) throw error;
    return data as Location;
}
