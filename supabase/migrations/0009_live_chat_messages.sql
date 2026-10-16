-- Add live chat messages for active streams
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.program_schedule(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_stream ON public.live_chat_messages(stream_id, created_at DESC);

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_chat_messages: read public" ON public.live_chat_messages
  FOR SELECT USING (true);

CREATE POLICY "live_chat_messages: insert authenticated" ON public.live_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
