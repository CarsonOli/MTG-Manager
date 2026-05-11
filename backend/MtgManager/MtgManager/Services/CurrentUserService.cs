using System.Security.Claims;
using MtgManager.Models;

namespace MtgManager.Services;

// Resolves the current authenticated user from request claims.
public class CurrentUserService
{
    public AuthenticatedUser? GetUser(ClaimsPrincipal principal)
    {
        var userIdText = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub");
        var username = principal.FindFirstValue(ClaimTypes.Name) ?? principal.FindFirstValue("unique_name");
        var role = principal.FindFirstValue(ClaimTypes.Role);

        if (!long.TryParse(userIdText, out var userId) || string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(role))
        {
            return null;
        }

        return new AuthenticatedUser(userId, username, role);
    }
}
