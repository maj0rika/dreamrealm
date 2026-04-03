import OpenAI from "openai";
import { createServerClient } from "@/lib/db/supabase-server";
import type { MemoryEmbedding } from "@/types/world";

let _openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
    if (!_openaiClient) {
        _openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return _openaiClient;
}

/** 텍스트 → 임베딩 벡터 생성 (text-embedding-3-small) */
export async function createEmbeddingVector(text: string): Promise<number[]> {
    const response = await getOpenAIClient().embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    });
    return response.data[0].embedding;
}

/** 메모리 임베딩 저장 */
export async function storeMemory(params: {
    worldId: string;
    content: string;
    contentType: string;
    importance: number;
    turnNumber: number;
    embedding: number[];
}): Promise<void> {
    const supabase = await createServerClient();
    const { error } = await supabase.from("memory_embeddings").insert({
        world_id: params.worldId,
        content: params.content,
        content_type: params.contentType,
        importance: params.importance,
        embedding: params.embedding,
    });

    if (error) throw error;
}

/** 벡터 유사도 검색 — cosine distance 기반 Top-N */
export async function searchSimilarMemories(
    worldId: string,
    queryEmbedding: number[],
    limit: number = 5
): Promise<MemoryEmbedding[]> {
    const supabase = await createServerClient();

    const { data, error } = await supabase.rpc("match_memories", {
        query_embedding: queryEmbedding,
        match_world_id: worldId,
        match_count: limit,
    });

    if (error) throw error;
    return data as MemoryEmbedding[];
}
