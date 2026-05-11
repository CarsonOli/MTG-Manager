-- seed.sql
-- Seed data for color identities, common Commander archetypes, and sample users/decks.

BEGIN;

INSERT INTO color_identities (code, name, white, blue, black, red, green) VALUES
-- Colorless
('C', 'Colorless', FALSE, FALSE, FALSE, FALSE, FALSE),

-- Mono-color
('W', 'Mono-White', TRUE, FALSE, FALSE, FALSE, FALSE),
('U', 'Mono-Blue', FALSE, TRUE, FALSE, FALSE, FALSE),
('B', 'Mono-Black', FALSE, FALSE, TRUE, FALSE, FALSE),
('R', 'Mono-Red', FALSE, FALSE, FALSE, TRUE, FALSE),
('G', 'Mono-Green', FALSE, FALSE, FALSE, FALSE, TRUE),

-- Two-color guilds
('WU', 'Azorius', TRUE, TRUE, FALSE, FALSE, FALSE),
('UB', 'Dimir', FALSE, TRUE, TRUE, FALSE, FALSE),
('BR', 'Rakdos', FALSE, FALSE, TRUE, TRUE, FALSE),
('RG', 'Gruul', FALSE, FALSE, FALSE, TRUE, TRUE),
('GW', 'Selesnya', TRUE, FALSE, FALSE, FALSE, TRUE),
('WB', 'Orzhov', TRUE, FALSE, TRUE, FALSE, FALSE),
('UR', 'Izzet', FALSE, TRUE, FALSE, TRUE, FALSE),
('BG', 'Golgari', FALSE, FALSE, TRUE, FALSE, TRUE),
('RW', 'Boros', TRUE, FALSE, FALSE, TRUE, FALSE),
('GU', 'Simic', FALSE, TRUE, FALSE, FALSE, TRUE),

-- Three-color shards
('WUB', 'Esper', TRUE, TRUE, TRUE, FALSE, FALSE),
('UBR', 'Grixis', FALSE, TRUE, TRUE, TRUE, FALSE),
('BRG', 'Jund', FALSE, FALSE, TRUE, TRUE, TRUE),
('RGW', 'Naya', TRUE, FALSE, FALSE, TRUE, TRUE),
('GWU', 'Bant', TRUE, TRUE, FALSE, FALSE, TRUE),

-- Three-color wedges / clans
('WBG', 'Abzan', TRUE, FALSE, TRUE, FALSE, TRUE),
('URW', 'Jeskai', TRUE, TRUE, FALSE, TRUE, FALSE),
('BGU', 'Sultai', FALSE, TRUE, TRUE, FALSE, TRUE),
('RWB', 'Mardu', TRUE, FALSE, TRUE, TRUE, FALSE),
('GUR', 'Temur', FALSE, TRUE, FALSE, TRUE, TRUE),

-- Four-color combinations. These are common Nephilim names.
('WUBR', 'Yore-Tiller', TRUE, TRUE, TRUE, TRUE, FALSE),
('UBRG', 'Glint-Eye', FALSE, TRUE, TRUE, TRUE, TRUE),
('BRGW', 'Dune-Brood', TRUE, FALSE, TRUE, TRUE, TRUE),
('RGWU', 'Ink-Treader', TRUE, TRUE, FALSE, TRUE, TRUE),
('GWUB', 'Witch-Maw', TRUE, TRUE, TRUE, FALSE, TRUE),

-- Five-color
('WUBRG', 'Five-Color', TRUE, TRUE, TRUE, TRUE, TRUE);

INSERT INTO archetypes (name, description) VALUES
('Aggro', 'Wins through fast pressure and efficient combat damage.'),
('Aristocrats', 'Sacrifices creatures or permanents for incremental value and drain effects.'),
('Artifacts', 'Builds around artifact permanents, synergies, and payoffs.'),
('Blink', 'Exiles and returns permanents to reuse enter-the-battlefield effects.'),
('Combo', 'Assembles specific card interactions that can win or generate overwhelming advantage.'),
('Control', 'Slows the game with removal, counters, and resource denial before winning later.'),
('Enchantress', 'Builds around enchantments and cards that reward casting or controlling them.'),
('Group Hug', 'Gives resources to other players while steering the table politically.'),
('Lands', 'Uses lands as the central engine for ramp, value, or win conditions.'),
('Lifegain', 'Uses life total increases as a resource or payoff engine.'),
('Mill', 'Attempts to put opponents cards from library into graveyard as a win condition.'),
('Reanimator', 'Moves creatures into the graveyard and returns them to the battlefield.'),
('Spellslinger', 'Rewards casting instants and sorceries.'),
('Stax', 'Restricts resources and actions to slow opponents down.'),
('Tokens', 'Creates many creature tokens and uses them for combat, sacrifice, or value.'),
('Tribal', 'Focuses on a creature type and cards that reward that type.'),
('Voltron', 'Builds around making one commander or creature large and threatening.'),
('Wheel', 'Forces players to discard and draw new hands for disruption or payoff triggers.');

-- Sample users. Replace these password hashes with hashes created by your app.
INSERT INTO users (name, username, email, password_hash, user_role) VALUES
('Admin User', 'admin', 'admin@example.com', '$2b$12$replace_with_real_hash_for_admin', 'admin'),
('Demo User', 'demo', 'demo@example.com', '$2b$12$replace_with_real_hash_for_demo', 'user');

-- Sample decks.
INSERT INTO decks (user_id, color_identity_id, archetype_id, deck_name, commander, bracket, wins, losses, description) VALUES
(
    (SELECT user_id FROM users WHERE username = 'demo'),
    (SELECT color_identity_id FROM color_identities WHERE code = 'BG'),
    (SELECT archetype_id FROM archetypes WHERE name = 'Aristocrats'),
    'Graveyard Value',
    'Meren of Clan Nel Toth',
    3,
    8,
    5,
    'A Golgari sacrifice and recursion deck built around repeatable creature value.'
),
(
    (SELECT user_id FROM users WHERE username = 'demo'),
    (SELECT color_identity_id FROM color_identities WHERE code = 'UR'),
    (SELECT archetype_id FROM archetypes WHERE name = 'Spellslinger'),
    'Stormy Science',
    'Veyran, Voice of Duality',
    4,
    11,
    7,
    'An Izzet spellslinger deck that chains cantrips, copy effects, and damage triggers.'
),
(
    (SELECT user_id FROM users WHERE username = 'admin'),
    (SELECT color_identity_id FROM color_identities WHERE code = 'WUBRG'),
    (SELECT archetype_id FROM archetypes WHERE name = 'Combo'),
    'Everything Engine',
    'Kenrith, the Returned King',
    5,
    15,
    12,
    'A five-color commander deck focused on flexible value and combo lines.'
);

COMMIT;
