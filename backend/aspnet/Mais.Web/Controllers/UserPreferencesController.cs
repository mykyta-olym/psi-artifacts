using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/users/preferences")]
[Authorize]
public class UserPreferencesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    public UserPreferencesController(AppDbContext db)
    {
        _db = db;
    }

    private string? CurrentEmail => User.FindFirstValue(ClaimTypes.Email);

    /// <summary>
    /// Get user preferences
    /// </summary>
    /// <param name="keys">Optional comma-separated list of preference keys to retrieve. If omitted, returns all preferences for the user.</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Dictionary of preference keys and values</returns>
    /// <remarks>
    /// Returns user preferences for the authenticated user. If keys parameter is provided, only those keys are returned.
    /// Missing requested keys will appear with null values.
    /// Values are automatically deserialized from JSON.
    /// </remarks>
    [HttpGet]
    [ProducesResponseType(typeof(Dictionary<string, object?>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<Dictionary<string, object?>>> Get([FromQuery] string? keys, CancellationToken cancellationToken)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized();
        }

        var query = _db.UserPreferences
            .AsNoTracking()
            .Where(p => p.UserEmail == email);

        List<string>? requestedKeys = null;
        if (!string.IsNullOrWhiteSpace(keys))
        {
            requestedKeys = keys
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (requestedKeys.Count > 0)
            {
                query = query.Where(p => requestedKeys.Contains(p.PreferenceKey));
            }
        }

        var list = await query.ToListAsync(cancellationToken);
        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var pref in list)
        {
            if (string.IsNullOrWhiteSpace(pref.JsonValue))
            {
                result[pref.PreferenceKey] = null;
                continue;
            }
            try
            {
                result[pref.PreferenceKey] = JsonSerializer.Deserialize<object>(pref.JsonValue, _jsonOptions);
            }
            catch
            {
                result[pref.PreferenceKey] = pref.JsonValue;
            }
        }

        // Ensure missing requested keys appear with null
        if (requestedKeys != null)
        {
            foreach (var key in requestedKeys)
            {
                if (!result.ContainsKey(key))
                {
                    result[key] = null;
                }
            }
        }

        return Ok(result);
    }

    public sealed class UpsertPreferenceRequest
    {
        public string? Key { get; set; }
        public JsonElement Value { get; set; }
    }

    /// <summary>
    /// Create or update a user preference
    /// </summary>
    /// <param name="request">Preference upsert request with key and value</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Creates a new preference or updates an existing one for the authenticated user.
    /// The value is stored as JSON. If the preference already exists, it will be updated.
    /// </remarks>
    [HttpPut]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Upsert([FromBody] UpsertPreferenceRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Key))
        {
            return BadRequest(new ProblemDetails { Title = "Preference key is required." });
        }

        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized();
        }

        var key = request.Key.Trim();
        var jsonValue = request.Value.ValueKind == JsonValueKind.Undefined
            ? "null"
            : request.Value.GetRawText();

        var entity = await _db.UserPreferences.FindAsync(new object[] { email, key }, cancellationToken);
        if (entity == null)
        {
            entity = new UserPreferenceEntity
            {
                UserEmail = email,
                PreferenceKey = key,
                JsonValue = jsonValue,
                UpdatedAt = DateTime.UtcNow
            };
            _db.UserPreferences.Add(entity);
        }
        else
        {
            entity.JsonValue = jsonValue;
            entity.UpdatedAt = DateTime.UtcNow;
            _db.UserPreferences.Update(entity);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Delete a user preference
    /// </summary>
    /// <param name="key">Preference key to delete</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content on success (even if preference didn't exist)</returns>
    /// <remarks>
    /// Deletes a preference for the authenticated user. Returns 204 even if the preference didn't exist.
    /// </remarks>
    [HttpDelete("{key}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Delete(string key, CancellationToken cancellationToken)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized();
        }

        var entity = await _db.UserPreferences.FindAsync(new object[] { email, key }, cancellationToken);
        if (entity == null)
        {
            return NoContent();
        }

        _db.UserPreferences.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

