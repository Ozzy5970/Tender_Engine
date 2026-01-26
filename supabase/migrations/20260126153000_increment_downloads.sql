-- Secure RPC to increment download count
create or replace function increment_template_download(template_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.templates
  set download_count = download_count + 1
  where id = template_id;
end;
$$;
