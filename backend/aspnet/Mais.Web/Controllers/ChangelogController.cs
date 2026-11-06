using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Services;
using System.Security.Claims;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/changelog")]
public class ChangelogController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<ChangelogController> _logger;
    private readonly IDataUpdateService _dataUpdates;

    public ChangelogController(AppDbContext db, ILogger<ChangelogController> logger, IDataUpdateService dataUpdates)
    {
        _db = db;
        _logger = logger;
        _dataUpdates = dataUpdates;
    }

    private string GetUserEmail() => User.FindFirst(ClaimTypes.Email)?.Value ?? "anonymous@mais.sk";

    /// <summary>
    /// Get all changelog entries
    /// </summary>
    /// <returns>List of changelog entries ordered by date descending</returns>
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<ChangelogEntryModel>>> GetChangelog()
    {
        try
        {
            var entries = await _db.Set<ChangelogEntryEntity>()
                .OrderByDescending(e => e.Date)
                .ThenByDescending(e => e.CreatedAt)
                .ToListAsync();

            var models = entries.Select(MapToModel).ToList();
            return Ok(models);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch changelog entries");
            return StatusCode(500, new { error = "Failed to fetch changelog entries" });
        }
    }

    /// <summary>
    /// Get a single changelog entry by ID
    /// </summary>
    /// <param name="id">Entry ID</param>
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<ActionResult<ChangelogEntryModel>> GetEntry(string id)
    {
        try
        {
            var entry = await _db.Set<ChangelogEntryEntity>()
                .FirstOrDefaultAsync(e => e.Id == id);

            if (entry == null)
            {
                return NotFound(new { error = "Changelog entry not found" });
            }

            return Ok(MapToModel(entry));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch changelog entry {Id}", id);
            return StatusCode(500, new { error = "Failed to fetch changelog entry" });
        }
    }

    /// <summary>
    /// Create a new changelog entry (teachers only)
    /// </summary>
    /// <param name="request">Changelog entry data</param>
    [HttpPost]
    [Authorize(Roles = "teacher")]
    public async Task<ActionResult<ChangelogEntryModel>> CreateEntry([FromBody] ChangelogEntryRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Version))
            {
                return BadRequest(new { error = "Version is required" });
            }

            if (string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest(new { error = "Title is required" });
            }

            if (request.Points == null || !request.Points.Any())
            {
                return BadRequest(new { error = "At least one point is required" });
            }

            var entry = new ChangelogEntryEntity
            {
                Id = $"cl-{Guid.NewGuid().ToString("N")[..12]}",
                Version = request.Version.Trim(),
                Date = DateTime.SpecifyKind(request.Date ?? DateTime.UtcNow, DateTimeKind.Unspecified),
                Title = request.Title.Trim(),
                Points = request.Points.Select(p => p.Trim()).Where(p => !string.IsNullOrWhiteSpace(p)).ToList(),
                CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified),
                CreatedBy = GetUserEmail()
            };

            _db.Set<ChangelogEntryEntity>().Add(entry);
            await _db.SaveChangesAsync();

            // Notify all clients about new changelog entry
            await _dataUpdates.NotifyChangelogUpdated(entry.Id, "created");

            return CreatedAtAction(nameof(GetEntry), new { id = entry.Id }, MapToModel(entry));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create changelog entry");
            return StatusCode(500, new { error = "Failed to create changelog entry" });
        }
    }

    /// <summary>
    /// Update an existing changelog entry (teachers only)
    /// </summary>
    /// <param name="id">Entry ID</param>
    /// <param name="request">Updated entry data</param>
    [HttpPut("{id}")]
    [Authorize(Roles = "teacher")]
    public async Task<ActionResult<ChangelogEntryModel>> UpdateEntry(string id, [FromBody] ChangelogEntryRequest request)
    {
        try
        {
            var entry = await _db.Set<ChangelogEntryEntity>()
                .FirstOrDefaultAsync(e => e.Id == id);

            if (entry == null)
            {
                return NotFound(new { error = "Changelog entry not found" });
            }

            if (!string.IsNullOrWhiteSpace(request.Version))
            {
                entry.Version = request.Version.Trim();
            }

            if (request.Date.HasValue)
            {
                entry.Date = DateTime.SpecifyKind(request.Date.Value, DateTimeKind.Unspecified);
            }

            if (!string.IsNullOrWhiteSpace(request.Title))
            {
                entry.Title = request.Title.Trim();
            }

            if (request.Points != null && request.Points.Any())
            {
                entry.Points = request.Points.Select(p => p.Trim()).Where(p => !string.IsNullOrWhiteSpace(p)).ToList();
            }

            entry.UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);

            await _db.SaveChangesAsync();

            // Notify all clients about changelog update
            await _dataUpdates.NotifyChangelogUpdated(id, "updated");

            return Ok(MapToModel(entry));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update changelog entry {Id}", id);
            return StatusCode(500, new { error = "Failed to update changelog entry" });
        }
    }

    /// <summary>
    /// Delete a changelog entry (teachers only)
    /// </summary>
    /// <param name="id">Entry ID</param>
    [HttpDelete("{id}")]
    [Authorize(Roles = "teacher")]
    public async Task<IActionResult> DeleteEntry(string id)
    {
        try
        {
            var entry = await _db.Set<ChangelogEntryEntity>()
                .FirstOrDefaultAsync(e => e.Id == id);

            if (entry == null)
            {
                return NotFound(new { error = "Changelog entry not found" });
            }

            _db.Set<ChangelogEntryEntity>().Remove(entry);
            await _db.SaveChangesAsync();

            // Notify all clients about changelog deletion
            await _dataUpdates.NotifyChangelogUpdated(id, "deleted");

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete changelog entry {Id}", id);
            return StatusCode(500, new { error = "Failed to delete changelog entry" });
        }
    }

    private static ChangelogEntryModel MapToModel(ChangelogEntryEntity entity)
    {
        return new ChangelogEntryModel
        {
            Id = entity.Id,
            Version = entity.Version,
            Date = entity.Date.ToString("yyyy-MM-dd"),
            Title = entity.Title,
            Points = entity.Points
        };
    }
}

public record ChangelogEntryRequest(
    string? Version,
    DateTime? Date,
    string? Title,
    List<string>? Points
);

public record ChangelogEntryModel
{
    public string Id { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public List<string> Points { get; set; } = new();
}
