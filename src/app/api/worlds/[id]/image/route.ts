import { createServerClient } from "@/lib/db/supabase-server";

/**
 * GET /api/worlds/[id]/image?type=cover
 * GET /api/worlds/[id]/image?type=turn&turn=N
 * 프론트엔드 폴링용 — 최신 이미지 상태 조회
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: worldId } = await params;
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");

        const supabase = await createServerClient();

        if (type === "cover") {
            const { data, error } = await supabase
                .from("worlds")
                .select("cover_image_url")
                .eq("id", worldId)
                .single();

            if (error) {
                return Response.json({ error: "월드를 찾을 수 없습니다" }, { status: 404 });
            }

            return Response.json({ imageUrl: data.cover_image_url });
        }

        if (type === "turn") {
            const turnNumber = searchParams.get("turn");
            if (!turnNumber) {
                return Response.json({ error: "turn 파라미터가 필요합니다" }, { status: 400 });
            }

            const { data, error } = await supabase
                .from("turns")
                .select("image_url")
                .eq("world_id", worldId)
                .eq("turn_number", Number(turnNumber))
                .single();

            if (error) {
                return Response.json({ error: "턴을 찾을 수 없습니다" }, { status: 404 });
            }

            return Response.json({ imageUrl: data.image_url });
        }

        return Response.json({ error: "type 파라미터가 필요합니다 (cover | turn)" }, { status: 400 });
    } catch (error) {
        console.error("이미지 조회 오류:", error);
        return Response.json(
            { error: "이미지 조회 중 오류가 발생했습니다" },
            { status: 500 }
        );
    }
}
