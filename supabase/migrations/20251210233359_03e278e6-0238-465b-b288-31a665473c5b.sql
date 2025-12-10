-- Enable REPLICA IDENTITY FULL for realtime updates on leads_juridicos
ALTER TABLE public.leads_juridicos REPLICA IDENTITY FULL;