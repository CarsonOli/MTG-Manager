using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MtgManager.Data;
using MtgManager.Models;
using Npgsql;

namespace MtgManager.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class StatsController : ControllerBase
{
    private readonly DbConnectionFactory connectionFactory;

    public StatsController(DbConnectionFactory connectionFactory)
    {
        this.connectionFactory = connectionFactory;
    }

    [AllowAnonymous]
    [HttpGet("public")]
    public async Task<ActionResult<PublicDeckStatistics>> GetPublicDeckStats()
    {
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync();

        var stats = new PublicDeckStatistics();

        // Aggregates site-wide counts for the public landing page without returning private deck rows.
        const string totalsSql = @"
            SELECT COUNT(*),
                   COUNT(DISTINCT user_id),
                   COUNT(DISTINCT commander),
                   COALESCE(SUM(wins + losses), 0)
            FROM decks;";

        await using (var totalsCommand = new NpgsqlCommand(totalsSql, connection))
        {
            await using var reader = await totalsCommand.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                stats.TotalDecks = Convert.ToInt32(reader.GetInt64(0));
                stats.TotalUsers = Convert.ToInt32(reader.GetInt64(1));
                stats.TotalCommanders = Convert.ToInt32(reader.GetInt64(2));
                stats.TotalGames = Convert.ToInt32(reader.GetInt64(3));
            }
        }

        // Shows the most submitted commanders while preserving all user-specific deck details.
        const string commandersSql = @"
            SELECT commander, COUNT(*)
            FROM decks
            GROUP BY commander
            ORDER BY COUNT(*) DESC, commander
            LIMIT 5;";

        await using var commandersCommand = new NpgsqlCommand(commandersSql, connection);
        await using var commandersReader = await commandersCommand.ExecuteReaderAsync();
        while (await commandersReader.ReadAsync())
        {
            stats.TopCommanders.Add(new TopCommanderStat
            {
                Commander = commandersReader.GetString(0),
                DeckCount = Convert.ToInt32(commandersReader.GetInt64(1))
            });
        }

        return Ok(stats);
    }

    [HttpGet("decks")]
    public async Task<ActionResult<DeckStatistics>> GetDeckStats()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!long.TryParse(userIdValue, out var userId))
        {
            return Unauthorized();
        }

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync();

        var stats = new DeckStatistics();

        const string totalsSql = @"
            SELECT COUNT(*), COALESCE(SUM(wins), 0), COALESCE(SUM(losses), 0)
            FROM decks
            WHERE user_id = @userId;";

        await using (var totalsCommand = new NpgsqlCommand(totalsSql, connection))
        {
            totalsCommand.Parameters.AddWithValue("userId", userId);
            await using var reader = await totalsCommand.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                stats.TotalDecks = Convert.ToInt32(reader.GetInt64(0));
                stats.TotalWins = Convert.ToInt32(reader.GetInt64(1));
                stats.TotalLosses = Convert.ToInt32(reader.GetInt64(2));
                var games = stats.TotalWins + stats.TotalLosses;
                stats.OverallWinRate = games == 0 ? 0 : Math.Round((decimal)stats.TotalWins / games * 100, 2);
            }
        }

        const string bracketSql = @"
            SELECT bracket, COUNT(*)
            FROM decks
            WHERE user_id = @userId
            GROUP BY bracket
            ORDER BY bracket;";

        await using (var bracketCommand = new NpgsqlCommand(bracketSql, connection))
        {
            bracketCommand.Parameters.AddWithValue("userId", userId);
            await using var reader = await bracketCommand.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                stats.BracketBreakdown.Add(new BracketStat
                {
                    Bracket = reader.GetInt16(0),
                    DeckCount = Convert.ToInt32(reader.GetInt64(1))
                });
            }
        }

        // Uses the helper view from schema.sql to count per-color usage by deck identity.
        const string colorSql = @"
            SELECT color_code, color_name, COUNT(*)
            FROM deck_individual_colors
            WHERE user_id = @userId
            GROUP BY color_code, color_name
            ORDER BY COUNT(*) DESC, color_code;";

        await using (var colorCommand = new NpgsqlCommand(colorSql, connection))
        {
            colorCommand.Parameters.AddWithValue("userId", userId);
            await using var reader = await colorCommand.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                stats.ColorUsage.Add(new ColorUsageStat
                {
                    ColorCode = reader.GetString(0),
                    ColorName = reader.GetString(1),
                    DeckCount = Convert.ToInt32(reader.GetInt64(2))
                });
            }
        }

        const string archetypeSql = @"
            SELECT COALESCE(a.name, 'Unassigned') AS archetype_name, COUNT(*)
            FROM decks d
            LEFT JOIN archetypes a ON a.archetype_id = d.archetype_id
            WHERE d.user_id = @userId
            GROUP BY COALESCE(a.name, 'Unassigned')
            ORDER BY COUNT(*) DESC, archetype_name;";

        await using var archetypeCommand = new NpgsqlCommand(archetypeSql, connection);
        archetypeCommand.Parameters.AddWithValue("userId", userId);
        await using var archetypeReader = await archetypeCommand.ExecuteReaderAsync();
        while (await archetypeReader.ReadAsync())
        {
            stats.ArchetypeBreakdown.Add(new ArchetypeStat
            {
                ArchetypeName = archetypeReader.GetString(0),
                DeckCount = Convert.ToInt32(archetypeReader.GetInt64(1))
            });
        }

        return Ok(stats);
    }
}
