export interface ArtStyleOption {
    id: string;
    label: string;
    description: string;
    prompt: string; // image_prompt에 append될 문자열
}

export const ART_STYLE_OPTIONS: ArtStyleOption[] = [
    {
        id: "epic-fantasy",
        label: "에픽 판타지",
        description: "웅장한 디지털 페인팅 스타일",
        prompt: "digital painting, epic fantasy, rich colors, dramatic lighting, highly detailed",
    },
    {
        id: "sci-fi-concept",
        label: "SF 컨셉 아트",
        description: "미래적이고 네온 조명의 시네마틱 스타일",
        prompt: "sci-fi concept art, neon lighting, futuristic, cinematic, volumetric fog",
    },
    {
        id: "dark-gothic",
        label: "다크 고딕",
        description: "어둡고 불길한 호러 분위기",
        prompt: "dark gothic art, desaturated, eerie atmosphere, horror, chiaroscuro lighting",
    },
    {
        id: "watercolor-romance",
        label: "수채화 로맨스",
        description: "부드럽고 따뜻한 파스텔 톤",
        prompt: "soft watercolor illustration, warm pastel tones, gentle golden hour lighting, shoujo manga aesthetic",
    },
    {
        id: "anime-vibrant",
        label: "애니메이션",
        description: "밝고 생동감 있는 애니 스타일",
        prompt: "anime style key visual, vibrant colors, soft cel shading, detailed background art, studio ghibli inspired",
    },
    {
        id: "noir-mystery",
        label: "느와르 미스터리",
        description: "그림자와 미묘한 분위기의 탐정물",
        prompt: "noir illustration, moody shadows, muted desaturated colors, detective atmosphere, rain-slicked streets",
    },
    {
        id: "post-apocalyptic",
        label: "포스트 아포칼립스",
        description: "거칠고 황량한 종말 이후 세계",
        prompt: "post-apocalyptic wasteland, gritty realism, muted earth tones, cinematic wide shot, overgrown ruins",
    },
];

// 장르 → 기본 아트 스타일 ID 매핑
const GENRE_DEFAULT_STYLE: Record<string, string> = {
    fantasy: "epic-fantasy",
    "sci-fi": "sci-fi-concept",
    horror: "dark-gothic",
    romance: "watercolor-romance",
    "slice-of-life": "anime-vibrant",
    mystery: "noir-mystery",
    "post-apocalyptic": "post-apocalyptic",
};

export function getDefaultArtStyle(genre: string): ArtStyleOption {
    const styleId = GENRE_DEFAULT_STYLE[genre] ?? "epic-fantasy";
    return ART_STYLE_OPTIONS.find((s) => s.id === styleId) ?? ART_STYLE_OPTIONS[0];
}

export function getArtStyleById(id: string): ArtStyleOption | undefined {
    return ART_STYLE_OPTIONS.find((s) => s.id === id);
}
