
-- Function to merge duplicate subscribers (old without 9th digit → new with 9th digit)
-- This is a one-time cleanup + adds a DB function for normalizing subscriber phone

-- Step 1: Create a helper function to add the 9th digit
CREATE OR REPLACE FUNCTION public.normalize_subscriber_phone(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  cleaned TEXT;
  ddd TEXT;
  local_num TEXT;
BEGIN
  IF phone IS NULL OR phone = '' THEN RETURN NULL; END IF;
  
  cleaned := regexp_replace(phone, '[^0-9]', '', 'g');
  
  -- Add country code if missing
  IF length(cleaned) = 10 OR length(cleaned) = 11 THEN
    cleaned := '55' || cleaned;
  END IF;
  
  -- Add 9th digit for mobile numbers (55 + DDD + 8 digits → 55 + DDD + 9 + 8 digits)
  IF length(cleaned) = 12 AND cleaned LIKE '55%' THEN
    ddd := substring(cleaned from 3 for 2);
    local_num := substring(cleaned from 5);
    IF length(local_num) = 8 AND local_num ~ '^[6-9]' THEN
      cleaned := '55' || ddd || '9' || local_num;
    END IF;
  END IF;
  
  RETURN cleaned;
END;
$$;

-- Step 2: Merge duplicate subscribers
-- Move messages from short-number subscriber to the long-number (with 9th digit) subscriber
DO $$
DECLARE
  rec RECORD;
  canonical_sub_id TEXT;
BEGIN
  -- Find all subscribers whose phone normalizes to a DIFFERENT subscriber_id
  FOR rec IN
    SELECT 
      s.subscriber_id,
      s.telefone,
      s.lead_id,
      'zapi_' || normalize_subscriber_phone(
        CASE 
          WHEN s.subscriber_id LIKE 'zapi_%' THEN replace(s.subscriber_id, 'zapi_', '')
          ELSE COALESCE(regexp_replace(s.telefone, '[^0-9]', '', 'g'), replace(s.subscriber_id, 'zapi_', ''))
        END
      ) AS canonical_id
    FROM manychat_subscribers s
    WHERE s.subscriber_id LIKE 'zapi_%'
  LOOP
    -- If canonical is different from current, this subscriber needs merging
    IF rec.canonical_id IS DISTINCT FROM rec.subscriber_id THEN
      -- Ensure canonical subscriber exists (upsert)
      INSERT INTO manychat_subscribers (subscriber_id, telefone, lead_id, canal, updated_at)
      VALUES (rec.canonical_id, rec.telefone, rec.lead_id, 'whatsapp', now())
      ON CONFLICT (subscriber_id) DO NOTHING;
      
      -- Move messages to canonical subscriber
      UPDATE manychat_mensagens
      SET subscriber_id = rec.canonical_id
      WHERE subscriber_id = rec.subscriber_id;
      
      -- Move tags
      UPDATE subscriber_tags
      SET subscriber_id = rec.canonical_id
      WHERE subscriber_id = rec.subscriber_id
        AND NOT EXISTS (
          SELECT 1 FROM subscriber_tags st2 
          WHERE st2.subscriber_id = rec.canonical_id AND st2.tag_id = subscriber_tags.tag_id
        );
      
      -- Delete orphaned tags that would conflict
      DELETE FROM subscriber_tags WHERE subscriber_id = rec.subscriber_id;
      
      -- Delete the old subscriber
      DELETE FROM manychat_subscribers WHERE subscriber_id = rec.subscriber_id;
      
      RAISE NOTICE 'Merged % → %', rec.subscriber_id, rec.canonical_id;
    END IF;
  END LOOP;
END;
$$;
