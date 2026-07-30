-- Guarda el nombre real de la carpeta raíz de la empresa y de la carpeta que
-- el sistema crea por tarea, para poder mostrarlo en perfil y en la tarea sin
-- tener que volver a llamar a la API de Google Drive.
alter table public.companies
  add column if not exists drive_folder_name text;

alter table public.tasks
  add column if not exists drive_folder_name text;
