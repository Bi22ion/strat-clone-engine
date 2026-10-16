-- Add program_schedule table for live streaming
CREATE TABLE program_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  category TEXT NOT NULL DEFAULT 'solo',
  is_pk BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  media_url TEXT,
  cover_image TEXT,
  title TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_program_schedule_host ON program_schedule(host);
CREATE INDEX idx_program_schedule_status ON program_schedule(status);
CREATE INDEX idx_program_schedule_category ON program_schedule(category);
CREATE INDEX idx_program_schedule_is_pk ON program_schedule(is_pk);
CREATE INDEX idx_program_schedule_created_at ON program_schedule(created_at DESC);

-- Enable RLS
ALTER TABLE program_schedule ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "program_schedule: read public" ON program_schedule
  FOR SELECT USING (true);

CREATE POLICY "program_schedule: insert by host" ON program_schedule
  FOR INSERT WITH CHECK (auth.uid() = host);

CREATE POLICY "program_schedule: update by host" ON program_schedule
  FOR UPDATE USING (auth.uid() = host);

CREATE POLICY "program_schedule: delete by host" ON program_schedule
  FOR DELETE USING (auth.uid() = host);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'user_role', 'viewer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_program_schedule_updated_at
  BEFORE UPDATE ON program_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();