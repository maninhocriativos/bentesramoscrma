-- Insert Google integration flags (using DO block for upsert logic)
DO $$
BEGIN
  -- GOOGLE_DRIVE_ENABLED
  INSERT INTO public.app_settings (key, value)
  VALUES ('GOOGLE_DRIVE_ENABLED', 'true')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  
  -- GOOGLE_CALENDAR_ENABLED
  INSERT INTO public.app_settings (key, value)
  VALUES ('GOOGLE_CALENDAR_ENABLED', 'true')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  
  -- GOOGLE_CALENDAR_ID
  INSERT INTO public.app_settings (key, value)
  VALUES ('GOOGLE_CALENDAR_ID', 'primary')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  
  -- GOOGLE_CALENDAR_SYNC_MODE
  INSERT INTO public.app_settings (key, value)
  VALUES ('GOOGLE_CALENDAR_SYNC_MODE', 'push')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END $$;