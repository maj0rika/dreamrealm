import { createServerClient } from "./supabase";
import type { MemoryEmbedding } from "@/types/world";

export async function createEmbedding(params: {
    world_id: string;
    content: string;
    content_type: string;
    importance: number;
    embedding: number[];
}): Promise<MemoryEmbedding> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("memory_embeddings")
        .insert(params)
        .select()
        .single();

    if (error) throw error;
    return data as MemoryEmbedding;
}

/**
 * 벡터 유사도 검색 — cosine distance 기반
 * Supabase에서 pgvector rpc 함수를 호출하거나 직접 쿼리
 */
export async function searchSimilar(
    worldId: string,
    embedding: number[],
    limit: number = 5
): Promise<MemoryEmbedding[]> {
    const supabase = await createServerClient();

    // pgvector cosine similarity 검색을 위한 RPC 호출
    // Supabase에서 아래 함수를 별도로 생성해야 함:
    // CREATE FUNCTION match_memories(query_embedding vector(1536), match_world_id uuid, match_count int)
    const { data, error } = await supabase.rpc("match_memories", {
        query_embedding: embedding,
        match_world_id: worldId,
        match_count: limit,
    });

    if (error) throw error;
    return data as MemoryEmbedding[];
}

export async function getWorldMemories(worldId: string): Promise<MemoryEmbedding[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("memory_embeddings")
        .select("*")
        .eq("world_id", worldId)
        .order("importance", { ascending: false });

    if (error) throw error;
    return data as MemoryEmbedding[];
}
