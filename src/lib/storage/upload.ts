import { createServerClient } from "@/lib/db/supabase-server";

const BUCKET_NAME = "world-images";

/**
 * 외부 이미지 URL → Supabase Storage 업로드 → 공개 URL 반환
 */
export async function uploadImageFromUrl(
    imageUrl: string,
    storagePath: string
): Promise<string> {
    // 1. 이미지 다운로드
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`이미지 다운로드 실패: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // 2. Supabase Storage 업로드
    const supabase = await createServerClient();
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, arrayBuffer, {
            contentType: "image/webp",
            upsert: true,
        });

    if (error) {
        throw new Error(`Storage 업로드 실패: ${error.message}`);
    }

    // 3. 공개 URL 반환
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    return data.publicUrl;
}
