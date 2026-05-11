using System.ComponentModel.DataAnnotations;

namespace MtgManager.Dtos;

// Request payload used to register a new user account.
public class RegisterRequest
{
    [Required, StringLength(120, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(60, MinimumLength = 3)]
    public string Username { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(254)]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(8)]
    public string Password { get; set; } = string.Empty;
}

// Request payload used to authenticate and receive a JWT.
public class LoginRequest
{
    [Required]
    public string UsernameOrEmail { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public long UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string UserRole { get; set; } = string.Empty;
}
