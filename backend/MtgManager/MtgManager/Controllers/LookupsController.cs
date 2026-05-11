using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MtgManager.Data;
using MtgManager.Models;
using Npgsql;

namespace MtgManager.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class LookupsController : ControllerBase
{
    private readonly DbConnectionFactory connectionFactory;

    public LookupsController(DbConnectionFactory connectionFactory)
    {
        this.connectionFactory = connectionFactory;
    }

    [HttpGet("color-identities")]
    public async Task<ActionResult<List<LookupItem>>> GetColorIdentities()
    {
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync();

        const string sql = @"
            SELECT color_identity_id, code, name
            FROM color_identities
            ORDER BY color_count, code;";

        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();

        var items = new List<LookupItem>();
        while (await reader.ReadAsync())
        {
            items.Add(new LookupItem
            {
                Id = reader.GetInt16(0),
                Code = reader.GetString(1),
                Name = reader.GetString(2)
            });
        }

        return Ok(items);
    }

    [HttpGet("archetypes")]
    public async Task<ActionResult<List<LookupItem>>> GetArchetypes()
    {
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync();

        const string sql = @"
            SELECT archetype_id, name
            FROM archetypes
            ORDER BY name;";

        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();

        var items = new List<LookupItem>();
        while (await reader.ReadAsync())
        {
            items.Add(new LookupItem
            {
                Id = reader.GetInt64(0),
                Name = reader.GetString(1)
            });
        }

        return Ok(items);
    }
}
