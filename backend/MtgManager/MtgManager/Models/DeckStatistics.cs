namespace MtgManager.Models;

// Aggregated statistics used by the dashboard cards and charts.
public class DeckStatistics
{
    public int TotalDecks { get; set; }
    public int TotalWins { get; set; }
    public int TotalLosses { get; set; }
    public decimal OverallWinRate { get; set; }
    public List<BracketStat> BracketBreakdown { get; set; } = [];
    public List<ColorUsageStat> ColorUsage { get; set; } = [];
    public List<ArchetypeStat> ArchetypeBreakdown { get; set; } = [];
}

public class BracketStat
{
    public short Bracket { get; set; }
    public int DeckCount { get; set; }
}

public class ColorUsageStat
{
    public string ColorCode { get; set; } = string.Empty;
    public string ColorName { get; set; } = string.Empty;
    public int DeckCount { get; set; }
}

public class ArchetypeStat
{
    public string ArchetypeName { get; set; } = string.Empty;
    public int DeckCount { get; set; }
}
