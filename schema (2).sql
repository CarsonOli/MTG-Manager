-- schema.sql
-- PostgreSQL schema for a Magic: The Gathering Commander deck tracker.
-- Assumption: colorless is stored as its own color identity, so the seed file contains 32 identities:
-- 31 non-empty subsets of W/U/B/R/G plus Colorless.

BEGIN;

DROP TABLE IF EXISTS decks;
DROP TABLE IF EXISTS archetypes;
DROP TABLE IF EXISTS color_identities;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    username VARCHAR(60) NOT NULL UNIQUE,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    user_role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_user_role_chk CHECK (user_role IN ('user', 'admin')),
    CONSTRAINT users_username_len_chk CHECK (char_length(username) >= 3)
);

CREATE TABLE color_identities (
    color_identity_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(5) NOT NULL UNIQUE,
    name VARCHAR(40) NOT NULL UNIQUE,
    white BOOLEAN NOT NULL DEFAULT FALSE,
    blue BOOLEAN NOT NULL DEFAULT FALSE,
    black BOOLEAN NOT NULL DEFAULT FALSE,
    red BOOLEAN NOT NULL DEFAULT FALSE,
    green BOOLEAN NOT NULL DEFAULT FALSE,
    color_count SMALLINT GENERATED ALWAYS AS (
        white::int + blue::int + black::int + red::int + green::int
    ) STORED,
    CONSTRAINT color_identities_code_chk CHECK (code ~ '^(C|[WUBRG]{1,5})$'),
    CONSTRAINT color_identities_color_count_chk CHECK (
        (code = 'C' AND white = FALSE AND blue = FALSE AND black = FALSE AND red = FALSE AND green = FALSE)
        OR
        (code <> 'C' AND (white::int + blue::int + black::int + red::int + green::int) >= 1)
    )
);

CREATE TABLE archetypes (
    archetype_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE decks (
    deck_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    color_identity_id SMALLINT NOT NULL REFERENCES color_identities(color_identity_id),
    archetype_id BIGINT REFERENCES archetypes(archetype_id) ON DELETE SET NULL,
    deck_name VARCHAR(120) NOT NULL,
    commander VARCHAR(120) NOT NULL,
    bracket SMALLINT NOT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT decks_bracket_chk CHECK (bracket BETWEEN 1 AND 5),
    CONSTRAINT decks_wins_nonnegative_chk CHECK (wins >= 0),
    CONSTRAINT decks_losses_nonnegative_chk CHECK (losses >= 0),
    CONSTRAINT decks_unique_user_deck_name UNIQUE (user_id, deck_name)
);

CREATE INDEX idx_decks_user_id ON decks(user_id);
CREATE INDEX idx_decks_color_identity_id ON decks(color_identity_id);
CREATE INDEX idx_decks_archetype_id ON decks(archetype_id);
CREATE INDEX idx_decks_bracket ON decks(bracket);

-- Optional helper view: one row per deck color, useful for statistics like "most used color".
CREATE VIEW deck_individual_colors AS
SELECT d.deck_id, d.user_id, 'W' AS color_code, 'White' AS color_name
FROM decks d
JOIN color_identities ci ON ci.color_identity_id = d.color_identity_id
WHERE ci.white
UNION ALL
SELECT d.deck_id, d.user_id, 'U', 'Blue'
FROM decks d
JOIN color_identities ci ON ci.color_identity_id = d.color_identity_id
WHERE ci.blue
UNION ALL
SELECT d.deck_id, d.user_id, 'B', 'Black'
FROM decks d
JOIN color_identities ci ON ci.color_identity_id = d.color_identity_id
WHERE ci.black
UNION ALL
SELECT d.deck_id, d.user_id, 'R', 'Red'
FROM decks d
JOIN color_identities ci ON ci.color_identity_id = d.color_identity_id
WHERE ci.red
UNION ALL
SELECT d.deck_id, d.user_id, 'G', 'Green'
FROM decks d
JOIN color_identities ci ON ci.color_identity_id = d.color_identity_id
WHERE ci.green;

COMMIT;
