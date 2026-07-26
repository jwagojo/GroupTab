-- ============================================================
-- GroupTab — Initial Schema
-- ============================================================

-- Trips table (id = join code, e.g. "AB1234")
CREATE TABLE trips (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 80),
  owner_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  background     TEXT DEFAULT '',
  themes         JSONB DEFAULT '{}',
  expenses       JSONB DEFAULT '[]',
  settled_debts  TEXT[] DEFAULT '{}',
  receipt_images JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  last_updated   TIMESTAMPTZ DEFAULT NOW()
);

-- Members join table (replaces embedded members/admins arrays)
CREATE TABLE trip_members (
  trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role    TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  PRIMARY KEY (trip_id, user_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a member of this trip?
CREATE OR REPLACE FUNCTION is_trip_member(p_trip_id TEXT)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = p_trip_id AND user_id = auth.uid()
  );
$$;

-- Helper: is the current user an owner or admin of this trip?
CREATE OR REPLACE FUNCTION is_trip_manager(p_trip_id TEXT)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = p_trip_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  );
$$;

-- trips: members can read
CREATE POLICY "members can read trips"
  ON trips FOR SELECT
  USING (is_trip_member(id));

-- trips: authenticated users can create (must be the owner)
CREATE POLICY "authenticated users can create trips"
  ON trips FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- trips: members can update allowed fields (app enforces which fields)
CREATE POLICY "members can update trips"
  ON trips FOR UPDATE
  USING (is_trip_member(id))
  WITH CHECK (owner_id = (SELECT owner_id FROM trips WHERE id = trips.id));

-- trips: managers (owner/admin) can delete
CREATE POLICY "managers can delete trips"
  ON trips FOR DELETE
  USING (is_trip_manager(id));

-- trip_members: members can read their trip's member list
CREATE POLICY "members can read trip_members"
  ON trip_members FOR SELECT
  USING (is_trip_member(trip_id));

-- trip_members: authenticated users can insert their own membership
CREATE POLICY "users can join trips"
  ON trip_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- trip_members: managers can delete members (kick); members can delete themselves (leave)
CREATE POLICY "managers can remove members or members can leave"
  ON trip_members FOR DELETE
  USING (user_id = auth.uid() OR is_trip_manager(trip_id));

-- ============================================================
-- RPC: get_my_trips
-- Returns all trips for the current user with user_role and member_count
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_trips()
RETURNS TABLE(
  id             TEXT,
  name           TEXT,
  owner_id       UUID,
  background     TEXT,
  themes         JSONB,
  expenses       JSONB,
  settled_debts  TEXT[],
  receipt_images JSONB,
  created_at     TIMESTAMPTZ,
  last_updated   TIMESTAMPTZ,
  user_role      TEXT,
  member_count   BIGINT
)
LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  SELECT
    t.id, t.name, t.owner_id, t.background,
    t.themes, t.expenses, t.settled_debts, t.receipt_images,
    t.created_at, t.last_updated,
    tm_me.role  AS user_role,
    COUNT(tm_all.user_id) AS member_count
  FROM trips t
  JOIN trip_members tm_me  ON tm_me.trip_id  = t.id AND tm_me.user_id = auth.uid()
  JOIN trip_members tm_all ON tm_all.trip_id = t.id
  GROUP BY t.id, t.name, t.owner_id, t.background,
           t.themes, t.expenses, t.settled_debts, t.receipt_images,
           t.created_at, t.last_updated, tm_me.role;
$$;
