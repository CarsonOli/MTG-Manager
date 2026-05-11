using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MtgManager.Data;
using MtgManager.Dtos;
using MtgManager.Models;
using Npgsql;

namespace MtgManager.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class DecksController : ControllerBase
{
    private readonly DbConnectionFactory connectionFactory;

    public DecksController(DbConnectionFactory connectionFactory)
    {
        this.connectionFactory = connectionFactory;
    }

    [HttpGet]
    public async Task<ActionResult<List<DeckRecord>>> GetDecks()
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync();

        // Returns deck rows enriched with lookup names for UI display.
        const string sql = @"
            SELECT d.deck_id, d.user_id, d.color_identity_id, ci.code, ci.name,
                   d.archetype_id, a.name, d.deck_name, d.commander, d.bracket,
                   d.wins, d.losses, d.description, d.created_at, d.updated_at
            FROM decks d
            JOIN color_identities ci ON ci.color_identity_id = d.color_identity_id
            LEFT JOIN archetypes a ON a.archetype_id = d.archetype_id
            WHERE d.user_id = @userId
            ORDER BY d.updated_at DESC;";

        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("userId", userId.Value);

        await using var reader = await command.ExecuteReaderAsync();
        var results = new List<DeckRecord>();
        while (await reader.ReadAsync())
        {
            results.Add(MapDeck(reader));
        }

        return Ok(results);
    }

    [HttpPost]
    public async Task<ActionResult<DeckRecord>> CreateDeck(DeckUpsertRequest request)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync();

        var validationError = await ValidateLookupIds(connection, request.ColorIdentityId, request.ArchetypeId);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        const string insertSql = @"
            INSERT INTO decks (user_id, color_identity_id, archetype_id, deck_name, commander, bracket, wins, losses, description)
            VALUES (@userId, @colorIdentityId, @archetypeId, @deckName, @commander, @bracket, @wins, @losses, @description)
            RETURNING deck_id;";

        await using var insertCommand = new NpgsqlCommand(insertSql, connection);
        AddDeckParameters(insertCommand, request, userId.Value);

        long deckId;
        try
        {
            deckId = (long)(await insertCommand.ExecuteScalarAsync() ?? 0L);
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            return Conflict("A deck with this name already exists for your account.");
        }

        var deck = await GetDeckById(connection, deckId, userId.Value);
        return CreatedAtAction(nameof(GetDeck), new { deckId }, deck);
    }

    [HttpGet("{deckId:long}")]
    public async Task<ActionResult<DeckRecord>> GetDeck(long deckId)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync();

        var deck = await GetDeckById(connection, deckId, userId.Value);
        return deck is null ? NotFound() : Ok(deck);
    }

    [HttpPut("{deckId:long}")]
    public async Task<ActionResult<DeckRecord>> UpdateDeck(long deckId, DeckUpsertRequest request)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync();

        var existingDeck = await GetDeckById(connection, deckId, userId.Value);
        if (existingDeck is null)
        {
            return NotFound();
        }

        var validationError = await ValidateLookupIds(connection, request.ColorIdentityId, request.ArchetypeId);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        const string updateSql = @"
            UPDATE decks
            SET color_identity_id = @colorIdentityId,
                archetype_id = @archetypeId,
                deck_name = @deckName,
                commander = @commander,
                bracket = @bracket,
                wins = @wins,
                losses = @losses,
                description = @description,
                updated_at = NOW()
            WHERE deck_id = @deckId AND user_id = @userId;";

        await using var updateCommand = new NpgsqlCommand(updateSql, connection);
        AddDeckParameters(updateCommand, request, userId.Value);
        updateCommand.Parameters.AddWithValue("deckId", deckId);

        try
        {
            await updateCommand.ExecuteNonQueryAsync();
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            return Conflict("A deck with this name already exists for your account.");
        }

        var updatedDeck = await GetDeckById(connection, deckId, userId.Value);
        return Ok(updatedDeck);
    }

    [HttpDelete("{deckId:long}")]
    public async Task<IActionResult> DeleteDeck(long deckId)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync();

        const string sql = "DELETE FROM decks WHERE deck_id = @deckId AND user_id = @userId;";
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("deckId", deckId);
        command.Parameters.AddWithValue("userId", userId.Value);
        var rowsAffected = await command.ExecuteNonQueryAsync();

        return rowsAffected == 0 ? NotFound() : NoContent();
    }

    private long? GetUserId()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return long.TryParse(userIdValue, out var userId) ? userId : null;
    }

    private static void AddDeckParameters(NpgsqlCommand command, DeckUpsertRequest request, long userId)
    {
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("colorIdentityId", request.ColorIdentityId);
        command.Parameters.AddWithValue("archetypeId", request.ArchetypeId is null ? DBNull.Value : request.ArchetypeId.Value);
        command.Parameters.AddWithValue("deckName", request.DeckName.Trim());
        command.Parameters.AddWithValue("commander", request.Commander.Trim());
        command.Parameters.AddWithValue("bracket", request.Bracket);
        command.Parameters.AddWithValue("wins", request.Wins);
        command.Parameters.AddWithValue("losses", request.Losses);
        command.Parameters.AddWithValue("description", string.IsNullOrWhiteSpace(request.Description) ? DBNull.Value : request.Description.Trim());
    }

    // Verifies foreign keys before insert/update so errors are user-friendly.
    private static async Task<string?> ValidateLookupIds(NpgsqlConnection connection, short colorIdentityId, long? archetypeId)
    {
        const string colorSql = "SELECT COUNT(*) FROM color_identities WHERE color_identity_id = @colorIdentityId;";
        await using (var colorCommand = new NpgsqlCommand(colorSql, connection))
        {
            colorCommand.Parameters.AddWithValue("colorIdentityId", colorIdentityId);
            var colorExists = (long)(await colorCommand.ExecuteScalarAsync() ?? 0L) > 0;
            if (!colorExists)
            {
                return "Selected color identity does not exist.";
            }
        }

        if (archetypeId is null)
        {
            return null;
        }

        const string archetypeSql = "SELECT COUNT(*) FROM archetypes WHERE archetype_id = @archetypeId;";
        await using var archetypeCommand = new NpgsqlCommand(archetypeSql, connection);
        archetypeCommand.Parameters.AddWithValue("archetypeId", archetypeId.Value);
        var archetypeExists = (long)(await archetypeCommand.ExecuteScalarAsync() ?? 0L) > 0;

        return archetypeExists ? null : "Selected archetype does not exist.";
    }

    private static async Task<DeckRecord?> GetDeckById(NpgsqlConnection connection, long deckId, long userId)
    {
        const string sql = @"
            SELECT d.deck_id, d.user_id, d.color_identity_id, ci.code, ci.name,
                   d.archetype_id, a.name, d.deck_name, d.commander, d.bracket,
                   d.wins, d.losses, d.description, d.created_at, d.updated_at
            FROM decks d
            JOIN color_identities ci ON ci.color_identity_id = d.color_identity_id
            LEFT JOIN archetypes a ON a.archetype_id = d.archetype_id
            WHERE d.deck_id = @deckId AND d.user_id = @userId
            LIMIT 1;";

        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("deckId", deckId);
        command.Parameters.AddWithValue("userId", userId);

        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return null;
        }

        return MapDeck(reader);
    }

    private static DeckRecord MapDeck(NpgsqlDataReader reader)
    {
        return new DeckRecord
        {
            DeckId = reader.GetInt64(0),
            UserId = reader.GetInt64(1),
            ColorIdentityId = reader.GetInt16(2),
            ColorIdentityCode = reader.GetString(3),
            ColorIdentityName = reader.GetString(4),
            ArchetypeId = reader.IsDBNull(5) ? null : reader.GetInt64(5),
            ArchetypeName = reader.IsDBNull(6) ? null : reader.GetString(6),
            DeckName = reader.GetString(7),
            Commander = reader.GetString(8),
            Bracket = reader.GetInt16(9),
            Wins = reader.GetInt32(10),
            Losses = reader.GetInt32(11),
            Description = reader.IsDBNull(12) ? null : reader.GetString(12),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(13),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(14)
        };
    }
}
