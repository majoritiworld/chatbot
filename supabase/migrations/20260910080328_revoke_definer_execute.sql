REVOKE EXECUTE ON FUNCTION public.current_user_rol() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_proyecto_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_majoriti() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.own_stakeholder_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_user_rol() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_proyecto_id() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.is_majoriti() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.own_stakeholder_id() TO postgres, service_role;

-- RLS policies still invoke these as table owner / definer internally.
GRANT EXECUTE ON FUNCTION public.current_user_rol() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_proyecto_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_majoriti() TO authenticated;
GRANT EXECUTE ON FUNCTION public.own_stakeholder_id() TO authenticated;
