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
    const contentType = response.headers.get("content-type") ?? "";
    console.log("[upload] 다운로드 완료, content-type:", contentType, "size:", response.headers.get("content-length"));
    // Replicate가 application/octet-stream으로 보낼 수 있으므로 유연하게 처리
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
        throw new Error("다운로드된 이미지가 비어있음");
    }

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
