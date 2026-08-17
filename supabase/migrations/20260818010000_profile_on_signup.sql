-- Auto-create a profiles row whenever a new auth.users row is created.
-- Role defaults to 'homeowner'; agency accounts are promoted explicitly
-- (via an admin action) rather than self-selected at signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'homeowner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
