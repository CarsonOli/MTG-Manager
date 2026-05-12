using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace MtgManager.Services;

// Validates commander names against Scryfall so deck records use canonical card names.
public class ScryfallCommanderService
{
    private static readonly string[] ColorOrder = ["W", "U", "B", "R", "G"];
    private readonly HttpClient httpClient;

    public ScryfallCommanderService(HttpClient httpClient)
    {
        this.httpClient = httpClient;
    }

    public async Task<ScryfallCommanderResult> GetCommanderAsync(string commanderName, CancellationToken cancellationToken)
    {
        var trimmedName = commanderName.Trim();
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            return ScryfallCommanderResult.Invalid("Commander is required.");
        }

        try
        {
            var requestUri = $"/cards/named?exact={Uri.EscapeDataString(trimmedName)}";
            using var response = await httpClient.GetAsync(requestUri, cancellationToken);

            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                return ScryfallCommanderResult.Invalid("Select a commander from the Scryfall results.");
            }

            if (!response.IsSuccessStatusCode)
            {
                return ScryfallCommanderResult.Invalid("Unable to verify that commander with Scryfall right now.");
            }

            var card = await response.Content.ReadFromJsonAsync<ScryfallCardResponse>(
                cancellationToken: cancellationToken);
            if (card is null)
            {
                return ScryfallCommanderResult.Invalid("Unable to verify that commander with Scryfall right now.");
            }

            // Commander deck entries are intentionally limited to legal legendary creature cards.
            if (!IsLegalLegendaryCreature(card))
            {
                return ScryfallCommanderResult.Invalid("Selected commander must be a Commander-legal legendary creature.");
            }

            return ScryfallCommanderResult.Valid(card.Name, GetColorIdentityCode(card.ColorIdentity));
        }
        catch (HttpRequestException)
        {
            return ScryfallCommanderResult.Invalid("Unable to verify that commander with Scryfall right now.");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return ScryfallCommanderResult.Invalid("Unable to verify that commander with Scryfall right now.");
        }
    }

    private static bool IsLegalLegendaryCreature(ScryfallCardResponse card)
    {
        return card.TypeLine.Contains("Legendary", StringComparison.OrdinalIgnoreCase)
            && card.TypeLine.Contains("Creature", StringComparison.OrdinalIgnoreCase)
            && string.Equals(card.Legalities.Commander, "legal", StringComparison.OrdinalIgnoreCase);
    }

    private static string GetColorIdentityCode(IReadOnlyCollection<string> colorIdentity)
    {
        var code = string.Concat(ColorOrder.Where(colorIdentity.Contains));
        return string.IsNullOrWhiteSpace(code) ? "C" : code;
    }
}

public class ScryfallCommanderResult
{
    private ScryfallCommanderResult(bool isValid, string? name, string? colorIdentityCode, string? errorMessage)
    {
        IsValid = isValid;
        Name = name;
        ColorIdentityCode = colorIdentityCode;
        ErrorMessage = errorMessage;
    }

    public bool IsValid { get; }
    public string? Name { get; }
    public string? ColorIdentityCode { get; }
    public string? ErrorMessage { get; }

    public static ScryfallCommanderResult Valid(string name, string colorIdentityCode)
    {
        return new ScryfallCommanderResult(true, name, colorIdentityCode, null);
    }

    public static ScryfallCommanderResult Invalid(string errorMessage)
    {
        return new ScryfallCommanderResult(false, null, null, errorMessage);
    }
}

public class ScryfallCardResponse
{
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("type_line")]
    public string TypeLine { get; set; } = string.Empty;

    [JsonPropertyName("color_identity")]
    public List<string> ColorIdentity { get; set; } = [];

    public ScryfallLegalities Legalities { get; set; } = new();
}

public class ScryfallLegalities
{
    public string Commander { get; set; } = string.Empty;
}
