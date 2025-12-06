import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qgenaltkjtlvwfgykpxq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1NTU2OTQsImV4cCI6MjA1ODEzMTY5NH0.O6J3-8NscavVIOhuxsD4w_kZwkZ7pi";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
