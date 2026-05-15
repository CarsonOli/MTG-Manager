-- Replaces the archetype lookup list with the updated Commander archetypes.
-- Existing decks keep their archetype when the same archetype name still exists in the new list.

DROP TABLE IF EXISTS temp_deck_archetype_names;

CREATE TEMP TABLE temp_deck_archetype_names AS
SELECT d.deck_id, a.name AS archetype_name
FROM decks d
JOIN archetypes a ON a.archetype_id = d.archetype_id;

-- Deleting lookup rows clears old references through the decks.archetype_id ON DELETE SET NULL rule.
DELETE FROM archetypes;

INSERT INTO archetypes (name, description) VALUES
('-1/-1 Counters', 'Controls the board by adding negative counters to opponents creatures.'),
('+1/+1 Counters', 'Buffs creatures by adding counters and wins through combat.'),
('Aggro', 'Wins through fast pressure and efficient combat damage.'),
('Aristocrats', 'Sacrifices creatures or permanents for incremental value and drain effects.'),
('Artifacts', 'Builds around artifact permanents, synergies, and payoffs.'),
('Blink', 'Exiles and returns permanents to reuse enter-the-battlefield effects.'),
('Burn', 'Deals damage directly to opponents in small increments over time'),
('Combo', 'Assembles specific card interactions that can win or generate overwhelming advantage.'),
('Control', 'Slows the game with removal, counters, and resource denial before winning later.'),
('Enchantress', 'Builds around enchantments and cards that reward casting or controlling them.'),
('Group Hug', 'Gives resources to other players while steering the table politically.'),
('Infect', 'Wins by giving each opponent 10 poison counters during the game'),
('Lands', 'Uses lands as the central engine for ramp, value, or win conditions.'),
('Lifegain', 'Uses life total increases as a resource or payoff engine.'),
('Mill', 'Attempts to put opponents cards from library into graveyard as a win condition.'),
('Reanimator', 'Moves creatures into the graveyard and returns them to the battlefield.'),
('Spellslinger', 'Rewards casting instants and sorceries.'),
('Stax', 'Restricts resources and actions to slow opponents down.'),
('Tokens', 'Creates many creature tokens and uses them for combat, sacrifice, or value.'),
('Tribal', 'Focuses on a creature type and cards that reward that type.'),
('Voltron', 'Builds around making one commander or creature large and threatening.'),
('Wheel', 'Forces players to discard and draw new hands for disruption or payoff triggers.'),
('X-spells', 'Ramps quickly to be able to cast bigger and bigger spells.');

-- Reconnect decks that used an archetype name still present after the replacement.
UPDATE decks
SET archetype_id = a.archetype_id
FROM temp_deck_archetype_names existing_archetype
JOIN archetypes a ON a.name = existing_archetype.archetype_name
WHERE decks.deck_id = existing_archetype.deck_id;

DROP TABLE temp_deck_archetype_names;
