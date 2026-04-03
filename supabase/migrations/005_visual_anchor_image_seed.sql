-- 장소별 시각 앵커 + 이미지 시드 (이미지 일관성)
ALTER TABLE locations ADD COLUMN visual_anchor TEXT NOT NULL DEFAULT '';
ALTER TABLE locations ADD COLUMN image_seed INTEGER;
