-- Storage RLS policies for literature-files bucket
CREATE POLICY "user_files_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'literature-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "user_files_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'literature-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "user_files_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'literature-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
