namespace MtgManager.Models;

// Represents one deck row with related lookup names returned to the client.
public class DeckRecord
{
    public long DeckId { get; set; }
    public long UserId { get; set; }
    public short ColorIdentityId { get; set; }
    public string ColorIdentityCode { get; set; } = string.Empty;
    public string ColorIdentityName { get; set; } = string.Empty;
    public long? ArchetypeId { get; set; }
    public string? ArchetypeName { get; set; }
    public string DeckName { get; set; } = string.Empty;
    public string Commander { get; set; } = string.Empty;
    public short Bracket { get; set; }
    public int Wins { get; set; }
    public int Losses { get; set; }
    public string? Description { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
