
-- Delete the meta_form_leads reference first, then the test lead
DELETE FROM meta_form_leads WHERE linked_lead_id = '245f6dd5-5407-4e9d-8f1d-3c41234ec42f';
DELETE FROM leads_juridicos WHERE id = '245f6dd5-5407-4e9d-8f1d-3c41234ec42f'
