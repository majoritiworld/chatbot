-- The transition functions can use the caller's existing RLS permissions.
-- SECURITY INVOKER removes unnecessary privilege elevation while the
-- functions still enforce ownership and workflow invariants explicitly.
ALTER FUNCTION public.advance_interview_flow(uuid, text) SECURITY INVOKER;
ALTER FUNCTION public.complete_interview_section(uuid, text, jsonb, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.submit_interview(uuid, jsonb, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.mark_interview_thank_you_sent(uuid) SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.advance_interview_flow(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_interview_section(uuid, text, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_interview(uuid, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_interview_thank_you_sent(uuid) FROM anon;
