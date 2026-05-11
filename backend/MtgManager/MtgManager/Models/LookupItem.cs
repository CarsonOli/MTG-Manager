namespace MtgManager.Models;

// Lookup value for color identities and archetypes used by deck forms.
public class LookupItem
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
}
