CREATE POLICY "user_files_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'literature-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
