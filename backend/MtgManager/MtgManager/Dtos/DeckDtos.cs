using System.ComponentModel.DataAnnotations;

namespace MtgManager.Dtos;

// Payload for creating and updating Commander decks.
public class DeckUpsertRequest
{
    [Required, StringLength(120, MinimumLength = 1)]
    public string DeckName { get; set; } = string.Empty;

    [Required, StringLength(120, MinimumLength = 1)]
    public string Commander { get; set; } = string.Empty;

    [Range(1, 5)]
    public short Bracket { get; set; }

    [Required]
    public short ColorIdentityId { get; set; }

    public long? ArchetypeId { get; set; }

    [Range(0, int.MaxValue)]
    public int Wins { get; set; }

    [Range(0, int.MaxValue)]
    public int Losses { get; set; }

    [StringLength(5000)]
    public string? Description { get; set; }
}
