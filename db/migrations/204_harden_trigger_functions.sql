-- Pins the search path of the append-only trigger functions (Supabase's security advisor flags a mutable one).
-- The functions only raise an exception, so an empty search path changes nothing else.
alter function moderation_evidence_immutable()      set search_path = '';
alter function moderation_audit_immutable()         set search_path = '';
alter function child_safety_reports_no_delete()     set search_path = '';
alter function parental_consents_no_delete()        set search_path = '';
