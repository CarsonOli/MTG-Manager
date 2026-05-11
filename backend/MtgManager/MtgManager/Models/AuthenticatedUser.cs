namespace MtgManager.Models;

// Minimal authenticated user context extracted from JWT claims.
public record AuthenticatedUser(long UserId, string Username, string UserRole);
