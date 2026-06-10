insert into users (full_name, email, password_hash, role)
values ('Administrador', 'admin@taskkeep.local', crypt('Cambiar123!', gen_salt('bf', 12)), 'admin')
on conflict (email) do nothing;
