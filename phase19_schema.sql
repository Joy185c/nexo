-- Phase 19: Add Public Key to users for E2EE
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS public_key TEXT;
