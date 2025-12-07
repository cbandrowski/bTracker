-- Create the company_logos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company_logos',
  'company_logos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

-- Create policy to allow authenticated users to upload
CREATE POLICY IF NOT EXISTS "Authenticated users can upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company_logos');

-- Create policy to allow authenticated users to update their company logos
CREATE POLICY IF NOT EXISTS "Authenticated users can update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company_logos');

-- Create policy to allow public read access
CREATE POLICY IF NOT EXISTS "Public can view company logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company_logos');

-- Create policy to allow authenticated users to delete their company logos
CREATE POLICY IF NOT EXISTS "Authenticated users can delete company logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company_logos');
