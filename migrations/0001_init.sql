CREATE TABLE IF NOT EXISTS standpoint_rooms (
	id TEXT PRIMARY KEY,
	code TEXT NOT NULL UNIQUE,
	host_user_id TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'lobby',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS standpoint_room_players (
	id TEXT PRIMARY KEY,
	room_id TEXT NOT NULL,
	user_id TEXT,
	display_name TEXT NOT NULL,
	join_order INTEGER NOT NULL,
	connected INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (room_id) REFERENCES standpoint_rooms(id)
);

CREATE TABLE IF NOT EXISTS standpoint_spectrum_cards (
	id TEXT PRIMARY KEY,
	left_label TEXT NOT NULL,
	right_label TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS standpoint_rounds (
	id TEXT PRIMARY KEY,
	room_id TEXT NOT NULL,
	round_number INTEGER NOT NULL,
	psychic_id TEXT NOT NULL,
	spectrum_card_id TEXT NOT NULL,
	target_value REAL NOT NULL,
	clue TEXT,
	guess_value REAL,
	score INTEGER DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'clue',
	clue_submitted_at TEXT,
	revealed_at TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (room_id) REFERENCES standpoint_rooms(id),
	FOREIGN KEY (psychic_id) REFERENCES standpoint_room_players(id),
	FOREIGN KEY (spectrum_card_id) REFERENCES standpoint_spectrum_cards(id)
);

CREATE TABLE IF NOT EXISTS standpoint_room_scores (
	room_id TEXT NOT NULL,
	player_id TEXT NOT NULL,
	points INTEGER NOT NULL DEFAULT 0,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (room_id, player_id),
	FOREIGN KEY (room_id) REFERENCES standpoint_rooms(id),
	FOREIGN KEY (player_id) REFERENCES standpoint_room_players(id)
);

CREATE INDEX IF NOT EXISTS idx_standpoint_room_players_room ON standpoint_room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_standpoint_rounds_room ON standpoint_rounds(room_id);
CREATE INDEX IF NOT EXISTS idx_standpoint_scores_room ON standpoint_room_scores(room_id);
