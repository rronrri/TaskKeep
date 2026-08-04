-- Todas las rutas de la app usan createAdminClient() (service_role); ninguna
-- llama a estas funciones con la key anon/authenticated. Pero "revoke ... from
-- anon, authenticated" en migraciones previas no bastaba: Postgres otorga
-- EXECUTE a PUBLIC por defecto al crear una función, y anon/authenticated
-- heredan ese acceso vía PUBLIC sin importar los revokes por rol. Varias de
-- estas funciones confían en los IDs que les pasan (actor_id, target_user_id...)
-- sin verificar auth.uid(), así que quedaban invocables directo vía
-- /rest/v1/rpc/<fn> con la key anon pública, saltándose toda la autorización
-- de la app (ver advisor: anon/authenticated_security_definer_function_executable).
revoke execute on function public.bump_session_epoch(uuid) from public;
revoke execute on function public.can_add_company_user(uuid, text) from public;
revoke execute on function public.clear_failed_logins(uuid) from public;
revoke execute on function public.company_adoption_metrics(integer) from public;
revoke execute on function public.consume_rate_limit(text, integer, integer) from public;
revoke execute on function public.delete_company_cascade(uuid) from public;
revoke execute on function public.delete_user_cascade(uuid) from public;
revoke execute on function public.manager_update_task_status(uuid, uuid, uuid, text) from public;
revoke execute on function public.register_failed_login(text, integer, integer) from public;
revoke execute on function public.review_status_request(uuid, uuid, uuid, text, text) from public;

-- Para que las próximas funciones no vuelvan a caer en el mismo agujero.
alter default privileges in schema public revoke execute on functions from public;
