"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/db/supabase-browser";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Trash2 } from "lucide-react";
import type { World, Genre } from "@/types/world";

// 장르별 그라데이션 색상
const GENRE_GRADIENTS: Record<Genre, string> = {
    fantasy: "from-purple-900 to-indigo-800",
    "sci-fi": "from-blue-900 to-cyan-800",
    horror: "from-red-950 to-rose-900",
    romance: "from-pink-900 to-rose-800",
    mystery: "from-slate-900 to-zinc-800",
    "slice-of-life": "from-amber-900 to-orange-800",
    "post-apocalyptic": "from-stone-900 to-neutral-800",
};

// 장르 한국어 표시
const GENRE_LABELS: Record<Genre, string> = {
    fantasy: "판타지",
    "sci-fi": "SF",
    horror: "호러",
    romance: "로맨스",
    mystery: "미스터리",
    "slice-of-life": "일상",
    "post-apocalyptic": "포스트아포칼립스",
};

// 상대 시간 계산
function getRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}일 전`;
    const months = Math.floor(days / 30);
    return `${months}개월 전`;
}

interface WorldCardProps {
    world: World;
}

export function WorldCard({ world }: WorldCardProps) {
    const router = useRouter();
    const supabase = useMemo(() => createBrowserClient(), []);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        setDeleting(true);
        const { error } = await supabase.from("worlds").delete().eq("id", world.id);
        setDeleting(false);
        if (error) return;
        setShowDeleteDialog(false);
        router.refresh();
    }

    const gradient = GENRE_GRADIENTS[world.genre] ?? "from-gray-900 to-gray-800";
    const genreLabel = GENRE_LABELS[world.genre] ?? world.genre;

    return (
        <>
            <Card className="group overflow-hidden border-white/10 bg-[#111118] ring-0 transition-all hover:border-[#7c6aff]/30">
                {/* 커버 이미지 or 그라데이션 */}
                {world.cover_image_url ? (
                    <div
                        className="h-32 bg-cover bg-center"
                        style={{
                            backgroundImage: `url(${world.cover_image_url})`,
                        }}
                    />
                ) : (
                    <div
                        className={`h-32 bg-gradient-to-br ${gradient}`}
                    />
                )}

                <CardContent className="flex flex-col gap-3 p-4">
                    {/* 이름 + 장르 태그 + 메뉴 */}
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-1.5">
                            <h3 className="font-bold text-white">
                                {world.name}
                            </h3>
                            <Badge
                                variant="secondary"
                                className="w-fit border-white/10 bg-white/5 text-xs text-zinc-300"
                            >
                                {genreLabel}
                            </Badge>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                className="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 hover:bg-white/10 hover:text-white"
                            >
                                <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="border-white/10 bg-[#1a1a24]"
                            >
                                <DropdownMenuItem
                                    className="text-red-400 focus:text-red-400"
                                    onClick={() => setShowDeleteDialog(true)}
                                >
                                    <Trash2 className="mr-2 size-4" />
                                    삭제
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* 메타 정보 + 이어하기 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                            <span>{getRelativeTime(world.updated_at)}</span>
                            <span>🎲 {world.turn_count}턴</span>
                        </div>
                        <Button
                            size="sm"
                            className="bg-[#7c6aff] text-white hover:bg-[#6b5ce7]"
                            onClick={() =>
                                router.push(`/world/${world.id}`)
                            }
                        >
                            이어하기
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* 삭제 확인 다이얼로그 */}
            <AlertDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
            >
                <AlertDialogContent className="border-white/10 bg-[#111118]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">
                            세계를 삭제하시겠습니까?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{world.name}&rdquo;의 모든 데이터가 영구
                            삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                            취소
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            {deleting ? "삭제 중..." : "삭제"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
