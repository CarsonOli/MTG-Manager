using System.Security.Claims;
using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MtgManager.Data;
using MtgManager.Dtos;
using MtgManager.Services;
using Npgsql;

namespace MtgManager.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly DbConnectionFactory connectionFactory;
    private readonly JwtTokenService jwtTokenService;

    public AuthController(DbConnectionFactory connectionFactory, JwtTokenService jwtTokenService)
    {
        this.connectionFactory = connectionFactory;
        this.jwtTokenService = jwtTokenService;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync();

        const string existsSql = @"
            SELECT COUNT(*)
            FROM users
            WHERE username = @username OR email = @email;";

        await using (var existsCommand = new NpgsqlCommand(existsSql, connection))
        {
            existsCommand.Parameters.AddWithValue("username", request.Username.Trim());
            existsCommand.Parameters.AddWithValue("email", request.Email.Trim().ToLowerInvariant());
            var existsCount = (long)(await existsCommand.ExecuteScalarAsync() ?? 0L);
            if (existsCount > 0)
            {
                return Conflict("Username or email is already in use.");
            }
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        // Inserts the user and returns only safe public fields required for auth state.
        const string insertSql = @"
            INSERT INTO users (name, username, email, password_hash, user_role)
            VALUES (@name, @username, @email, @passwordHash, 'user')
            RETURNING user_id, username, user_role;";

        await using var insertCommand = new NpgsqlCommand(insertSql, connection);
        insertCommand.Parameters.AddWithValue("name", request.Name.Trim());
        insertCommand.Parameters.AddWithValue("username", request.Username.Trim());
        insertCommand.Parameters.AddWithValue("email", request.Email.Trim().ToLowerInvariant());
        insertCommand.Parameters.AddWithValue("passwordHash", passwordHash);

        await using var reader = await insertCommand.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return StatusCode(500, "Unable to create user account.");
        }

        var userId = reader.GetInt64(0);
        var username = reader.GetString(1);
        var userRole = reader.GetString(2);

        var token = jwtTokenService.CreateToken(userId, username, userRole);
        return Ok(new AuthResponse
        {
            Token = token,
            UserId = userId,
            Username = username,
            UserRole = userRole
        });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync();

        // Allows login with username or email while keeping one query path.
        const string sql = @"
            SELECT user_id, username, user_role, password_hash
            FROM users
            WHERE LOWER(username) = @identity OR LOWER(email) = @identity
            LIMIT 1;";

        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("identity", request.UsernameOrEmail.Trim().ToLowerInvariant());

        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return Unauthorized("Invalid credentials.");
        }

        var userId = reader.GetInt64(0);
        var username = reader.GetString(1);
        var userRole = reader.GetString(2);
        var passwordHash = reader.GetString(3);

        if (!BCrypt.Net.BCrypt.Verify(request.Password, passwordHash))
        {
            return Unauthorized("Invalid credentials.");
        }

        var token = jwtTokenService.CreateToken(userId, username, userRole);
        return Ok(new AuthResponse
        {
            Token = token,
            UserId = userId,
            Username = username,
            UserRole = userRole
        });
    }

    [Authorize]
    [HttpGet("me")]
    public ActionResult<object> Me()
    {
        if (!(User?.Identity?.IsAuthenticated ?? false))
        {
            return Unauthorized();
        }

        var userIdText = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name");
        var userRole = User.FindFirstValue(ClaimTypes.Role);

        return Ok(new { userId = userIdText, username, userRole });
    }
}
