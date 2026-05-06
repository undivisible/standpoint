CREATE TABLE IF NOT EXISTS users (
	uid TEXT PRIMARY KEY,
	email TEXT,
	display_name TEXT,
	photo_url TEXT,
	banner_url TEXT,
	bio TEXT,
	location TEXT,
	website TEXT,
	twitter TEXT,
	instagram TEXT,
	aura INTEGER NOT NULL DEFAULT 0,
	pro INTEGER NOT NULL DEFAULT 0,
	user_group TEXT NOT NULL DEFAULT 'user',
	total_likes INTEGER NOT NULL DEFAULT 0,
	total_comments INTEGER NOT NULL DEFAULT 0,
	total_forks INTEGER NOT NULL DEFAULT 0,
	tierlists_created INTEGER NOT NULL DEFAULT 0,
	polls_created INTEGER NOT NULL DEFAULT 0,
	redirects_to TEXT,
	is_redirect INTEGER NOT NULL DEFAULT 0,
	data TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users(uid)
);

CREATE TABLE IF NOT EXISTS oauth_states (
	state TEXT PRIMARY KEY,
	verifier TEXT NOT NULL,
	redirect_to TEXT,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS polls (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	description TEXT,
	owner TEXT,
	status TEXT NOT NULL DEFAULT 'published',
	visibility TEXT NOT NULL DEFAULT 'public',
	response_type INTEGER NOT NULL DEFAULT 1,
	options_json TEXT NOT NULL DEFAULT '[]',
	stats_json TEXT NOT NULL DEFAULT '{}',
	gradients_json TEXT,
	likes INTEGER NOT NULL DEFAULT 0,
	comments INTEGER NOT NULL DEFAULT 0,
	total_votes INTEGER NOT NULL DEFAULT 0,
	data TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (owner) REFERENCES users(uid)
);

CREATE TABLE IF NOT EXISTS poll_votes (
	poll_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	position REAL NOT NULL,
	position_2d TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (poll_id, user_id),
	FOREIGN KEY (poll_id) REFERENCES polls(id),
	FOREIGN KEY (user_id) REFERENCES users(uid)
);

CREATE TABLE IF NOT EXISTS tierlists (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	description TEXT,
	owner TEXT,
	status TEXT NOT NULL DEFAULT 'published',
	visibility TEXT NOT NULL DEFAULT 'public',
	list_type TEXT NOT NULL DEFAULT 'classic',
	tiers_json TEXT NOT NULL DEFAULT '[]',
	items_json TEXT NOT NULL DEFAULT '[]',
	placements_json TEXT NOT NULL DEFAULT '[]',
	banner_image TEXT,
	likes INTEGER NOT NULL DEFAULT 0,
	comments INTEGER NOT NULL DEFAULT 0,
	forks INTEGER NOT NULL DEFAULT 0,
	is_forked INTEGER NOT NULL DEFAULT 0,
	original_id TEXT,
	is_guest INTEGER NOT NULL DEFAULT 0,
	data TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_edited TEXT,
	FOREIGN KEY (owner) REFERENCES users(uid),
	FOREIGN KEY (original_id) REFERENCES tierlists(id)
);

CREATE TABLE IF NOT EXISTS tierlist_drafts (
	id TEXT PRIMARY KEY,
	tierlist_id TEXT,
	owner TEXT,
	data TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (tierlist_id) REFERENCES tierlists(id),
	FOREIGN KEY (owner) REFERENCES users(uid)
);

CREATE TABLE IF NOT EXISTS comments (
	id TEXT PRIMARY KEY,
	content_type TEXT NOT NULL,
	content_id TEXT NOT NULL,
	user_id TEXT,
	user_display_name TEXT,
	user_photo_url TEXT,
	text TEXT NOT NULL,
	data TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users(uid)
);

CREATE TABLE IF NOT EXISTS likes (
	content_type TEXT NOT NULL,
	content_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (content_type, content_id, user_id),
	FOREIGN KEY (user_id) REFERENCES users(uid)
);

CREATE TABLE IF NOT EXISTS follows (
	follower_id TEXT NOT NULL,
	following_id TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (follower_id, following_id),
	FOREIGN KEY (follower_id) REFERENCES users(uid),
	FOREIGN KEY (following_id) REFERENCES users(uid)
);

CREATE TABLE IF NOT EXISTS notifications (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	type TEXT NOT NULL,
	content_type TEXT,
	content_id TEXT,
	content_title TEXT,
	from_user_id TEXT,
	from_user_name TEXT,
	bundle_key TEXT,
	read INTEGER NOT NULL DEFAULT 0,
	data TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users(uid)
);

CREATE TABLE IF NOT EXISTS preferences (
	user_id TEXT PRIMARY KEY,
	data TEXT NOT NULL DEFAULT '{}',
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users(uid)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_polls_owner ON polls(owner);
CREATE INDEX IF NOT EXISTS idx_polls_status_created ON polls(status, created_at);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_tierlists_owner_status ON tierlists(owner, status);
CREATE INDEX IF NOT EXISTS idx_tierlists_status_created ON tierlists(status, created_at);
CREATE INDEX IF NOT EXISTS idx_tierlists_original ON tierlists(original_id);
CREATE INDEX IF NOT EXISTS idx_tierlist_drafts_owner ON tierlist_drafts(owner);
CREATE INDEX IF NOT EXISTS idx_comments_content ON comments(content_type, content_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_content ON likes(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at);
