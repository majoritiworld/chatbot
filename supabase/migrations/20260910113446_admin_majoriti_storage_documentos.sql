-- Private bucket for phase documents. Access is always through signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS documentos_majoriti_all ON storage.objects;
CREATE POLICY documentos_majoriti_all ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'documentos' AND public.is_majoriti())
  WITH CHECK (bucket_id = 'documentos' AND public.is_majoriti());
