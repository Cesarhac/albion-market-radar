create or replace function public.cleanup_old_chat_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.chat_messages
  where created_at < now() - interval '5 minutes';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_old_chat_messages() from public;
grant execute on function public.cleanup_old_chat_messages() to authenticated;

drop policy if exists "chat_messages_read_visible" on public.chat_messages;
create policy "chat_messages_read_visible" on public.chat_messages
for select to authenticated
using (
  status = 'visible'
  and created_at >= now() - interval '5 minutes'
);
