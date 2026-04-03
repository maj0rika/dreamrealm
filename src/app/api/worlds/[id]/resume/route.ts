import { createServerClient } from "@/lib/db/supabase";
import { getWorld } from "@/lib/db/worlds";
import { getLatestTurns } from "@/lib/db/turns";
import { getWorldLocations } from "@/lib/db/locations";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return Response.json({ error: "인증이 필요합니다" }, { status: 401 });
        }

        const world = await getWorld(id);
        if (world.user_id !== user.id) {
            return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });
        }

        const turns = await getLatestTurns(id, 1);
        const lastTurn = turns[0] ?? null;

        // 현재 위치 파악 (마지막 턴의 location_changes 또는 시작 위치)
        const locations = await getWorldLocations(id);
        const discoveredLocations = locations.filter((l) => l.discovered);
        const currentLocation = discoveredLocations[discoveredLocations.length - 1] ?? null;

        return Response.json({
            world,
            lastTurn,
            currentLocation,
        });
    } catch (error) {
        console.error("세션 복원 오류:", error);
        return Response.json(
            { error: "세션 복원 중 오류가 발생했습니다" },
            { status: 500 }
        );
    }
}
