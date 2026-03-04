
-- Remove meta_form_leads entries that are linked to leads that existed before the import
DELETE FROM meta_form_leads mfl
USING leads_juridicos lj
WHERE mfl.linked_lead_id = lj.id
  AND mfl.source = 'google_sheets'
  AND lj.created_at < '2026-03-04';
