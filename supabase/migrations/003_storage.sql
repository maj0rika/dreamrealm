-- world-images 버킷 생성 (공개)
INSERT INTO storage.buckets (id, name, public)
VALUES ('world-images', 'world-images', true);

-- 인증된 사용자 이미지 업로드 허용
CREATE POLICY "Users can upload images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'world-images');

-- 누구나 이미지 조회 가능
CREATE POLICY "Anyone can view images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'world-images');
