ALTER TABLE standpoint_rooms ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';

CREATE INDEX IF NOT EXISTS idx_standpoint_rooms_visibility_status ON standpoint_rooms(visibility, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_standpoint_room_players_user ON standpoint_room_players(room_id, user_id);
