-- Profiles carry authorization data (rol, proyecto_id and identity).
-- Profile provisioning/updates already use the trusted server admin client.
-- Keep self SELECT, but permit writes only through usuario_all_majoriti or
-- service_role. A row ownership check must not grant self-assigned roles.
-- After this statement, public.usuario should retain:
--   usuario_select_self_or_majoriti (SELECT)
--   usuario_all_majoriti (ALL, Majoriti only)
-- Do not recreate usuario_update_self_or_majoriti during recovery.
DROP POLICY IF EXISTS usuario_update_self_or_majoriti ON public.usuario;
