const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 30000;

interface ReplicatePrediction {
    id: string;
    status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
    output: string[] | null;
    error: string | null;
}

/**
 * Replicate FLUX.1 Schnell 모델로 이미지 생성
 * 성공: 이미지 URL 반환, 실패: null
 */
export async function generateImage(prompt: string): Promise<string | null> {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        console.error("[image-generator] REPLICATE_API_TOKEN이 설정되지 않았습니다");
        return null;
    }

    try {
        // 1. Prediction 생성
        const createResponse = await fetch(REPLICATE_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "black-forest-labs/flux-schnell",
                input: {
                    prompt,
                    num_outputs: 1,
                    aspect_ratio: "16:9",
                    output_format: "webp",
                    output_quality: 80,
                },
            }),
        });

        if (!createResponse.ok) {
            console.error("[image-generator] Prediction 생성 실패:", createResponse.status);
            return null;
        }

        const prediction: ReplicatePrediction = await createResponse.json();

        // 2. 폴링으로 완료 대기
        const startTime = Date.now();
        let current = prediction;

        while (
            current.status !== "succeeded" &&
            current.status !== "failed" &&
            current.status !== "canceled"
        ) {
            if (Date.now() - startTime > MAX_POLL_MS) {
                console.error("[image-generator] 폴링 타임아웃 (30초 초과)");
                return null;
            }

            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

            const pollResponse = await fetch(`${REPLICATE_API_URL}/${current.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!pollResponse.ok) {
                console.error("[image-generator] 폴링 실패:", pollResponse.status);
                return null;
            }

            current = await pollResponse.json();
        }

        if (current.status === "succeeded" && current.output && current.output.length > 0) {
            return current.output[0];
        }

        console.error("[image-generator] 이미지 생성 실패:", current.error);
        return null;
    } catch (error) {
        console.error("[image-generator] 예외 발생:", error);
        return null;
    }
}
