using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace Mais.Web.Services;

public class GeminiOptions
{
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta";
    public string DefaultModel { get; set; } = "gemini-2.0-flash";
    public string? ApiKey { get; set; }
}

public interface IGeminiService
{
    Task<string> GenerateAsync(string apiKey, string prompt, string? model, CancellationToken cancellationToken);
}

public class GeminiService : IGeminiService
{
    private readonly HttpClient _http;
    private readonly GeminiOptions _options;
    private readonly ILogger<GeminiService> _logger;

    public GeminiService(HttpClient httpClient, IOptions<GeminiOptions> options, ILogger<GeminiService> logger)
    {
        _http = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    private sealed record GeminiRequest(IReadOnlyList<GeminiContent> Contents);
    private sealed record GeminiContent(string Role, IReadOnlyList<GeminiPart> Parts);
    private sealed record GeminiPart(string Text);
    private sealed record GeminiCandidate(GeminiContent Content);
    private sealed record GeminiResponse(IReadOnlyList<GeminiCandidate> Candidates);
    private sealed record GeminiError(string Message, string Status);
    private sealed record GeminiErrorEnvelope(GeminiError Error);

    // Map deprecated/old model names to new ones
    private static readonly Dictionary<string, string> ModelMigrations = new(StringComparer.OrdinalIgnoreCase)
    {
        ["gemini-1.5-flash-latest"] = "gemini-2.0-flash",
        ["models/gemini-1.5-flash-latest"] = "gemini-2.0-flash",
        ["gemini-1.5-flash"] = "gemini-2.0-flash",
        ["gemini-1.5-pro-latest"] = "gemini-2.0-flash",
        ["gemini-1.5-pro"] = "gemini-2.0-flash",
        ["gemini-pro"] = "gemini-2.0-flash",
    };

    public async Task<string> GenerateAsync(string apiKey, string prompt, string? model, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("Gemini API key is not configured.");
        }

        var selectedModel = string.IsNullOrWhiteSpace(model) ? _options.DefaultModel : model!;
        
        // Migrate deprecated models to new ones
        if (ModelMigrations.TryGetValue(selectedModel, out var newModel))
        {
            _logger.LogInformation("Migrating deprecated model {OldModel} to {NewModel}", selectedModel, newModel);
            selectedModel = newModel;
        }
        
        // Strip "models/" prefix if present - we'll add it back for the URL
        if (selectedModel.StartsWith("models/", StringComparison.OrdinalIgnoreCase))
        {
            selectedModel = selectedModel["models/".Length..];
        }
        
        // Ensure model has "models/" prefix for the API URL
        var modelPath = $"models/{selectedModel}";

        var request = new GeminiRequest(new[]
        {
            new GeminiContent("user", new[] { new GeminiPart(prompt.Length > 8000 ? prompt[..8000] : prompt) })
        });

        try
        {
            var url = $"{_options.BaseUrl}/{modelPath}:generateContent?key={Uri.EscapeDataString(apiKey)}";
            _logger.LogInformation("Calling Gemini API: {Url}", url.Replace(apiKey, "***"));
            using var response = await _http.PostAsJsonAsync(url, request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                var payload = await response.Content.ReadFromJsonAsync<GeminiResponse>(cancellationToken: cancellationToken);
                var parts = payload?.Candidates?.FirstOrDefault()?.Content?.Parts ?? Array.Empty<GeminiPart>();
                var text = string.Join("\n", parts.Select(p => p.Text ?? string.Empty)).Trim();
                return string.IsNullOrWhiteSpace(text) ? "(no response)" : text;
            }

            var errorEnvelope = await response.Content.ReadFromJsonAsync<GeminiErrorEnvelope>(cancellationToken: cancellationToken);
            var message = errorEnvelope?.Error?.Message ?? await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning("Gemini API error {StatusCode}: {Message}", (int)response.StatusCode, message);
            throw new InvalidOperationException(message ?? $"Gemini call failed with {(int)response.StatusCode}");
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gemini request failed");
            throw new InvalidOperationException("Unable to generate AI response.", ex);
        }
    }
}

