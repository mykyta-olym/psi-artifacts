using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Models;
using Mais.Web.Services;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/equipment")]
[Authorize]
public class EquipmentController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<EquipmentController> _logger;
    private readonly IDataUpdateService _dataUpdates;

    public EquipmentController(AppDbContext db, ILogger<EquipmentController> logger, IDataUpdateService dataUpdates)
    {
        _db = db;
        _logger = logger;
        _dataUpdates = dataUpdates;
    }

    private string? CurrentEmail => User.FindFirstValue(ClaimTypes.Email);
    private string? CurrentRole => User.FindFirstValue(ClaimTypes.Role);
    private bool IsTeacher => string.Equals(CurrentRole, "teacher", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Get all equipment with optional filtering and pagination
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(EquipmentResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<EquipmentResponse>> GetEquipment(
        [FromQuery] string? type,
        [FromQuery] string? status,
        [FromQuery] string? location,
        [FromQuery] string? search,
        [FromQuery] string? sort = "name",
        [FromQuery] string? dir = "asc",
        [FromQuery] int page = 1,
        [FromQuery] int perPage = 50,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Equipment.AsNoTracking();

        // Type filter
        if (!string.IsNullOrWhiteSpace(type))
        {
            query = query.Where(e => e.Type != null && e.Type.ToLower() == type.ToLower());
        }

        // Status filter
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(e => e.Status != null && e.Status.ToLower() == status.ToLower());
        }

        // Location filter
        if (!string.IsNullOrWhiteSpace(location))
        {
            query = query.Where(e => e.Location != null && e.Location.ToLower().Contains(location.ToLower()));
        }

        // Search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.Trim().ToLower();
            query = query.Where(e =>
                (e.Name != null && e.Name.ToLower().Contains(searchTerm)) ||
                (e.Type != null && e.Type.ToLower().Contains(searchTerm)) ||
                (e.Location != null && e.Location.ToLower().Contains(searchTerm)) ||
                (e.AssignedTo != null && e.AssignedTo.ToLower().Contains(searchTerm)));
        }

        // Sorting
        query = (sort?.ToLower(), dir?.ToLower()) switch
        {
            ("type", "asc") => query.OrderBy(e => e.Type).ThenBy(e => e.Name),
            ("type", _) => query.OrderByDescending(e => e.Type).ThenBy(e => e.Name),
            ("status", "asc") => query.OrderBy(e => e.Status).ThenBy(e => e.Name),
            ("status", _) => query.OrderByDescending(e => e.Status).ThenBy(e => e.Name),
            ("location", "asc") => query.OrderBy(e => e.Location).ThenBy(e => e.Name),
            ("location", _) => query.OrderByDescending(e => e.Location).ThenBy(e => e.Name),
            ("name", "desc") => query.OrderByDescending(e => e.Name),
            _ => query.OrderBy(e => e.Name)
        };

        var total = await query.CountAsync(cancellationToken);
        var totalPages = (int)Math.Ceiling(total / (double)perPage);
        var safePage = Math.Max(1, Math.Min(page, Math.Max(1, totalPages)));
        var skip = (safePage - 1) * perPage;

        var entities = await query
            .Skip(skip)
            .Take(perPage)
            .ToListAsync(cancellationToken);

        // Calculate next bookings from resource reservations based on room location
        var locations = entities
            .Where(e => !string.IsNullOrWhiteSpace(e.Location))
            .Select(e => e.Location!)
            .ToHashSet();
        
        var now = DateTime.UtcNow;
        
        // Get next reservation for each room (equipment location)
        var nextBookings = await _db.ResourceReservations
            .AsNoTracking()
            .Where(r => r.ResourceType == "room" && locations.Contains(r.ResourceName))
            .Where(r => r.StartTime > now && r.Status == "active")
            .GroupBy(r => r.ResourceName)
            .Select(g => new
            {
                RoomName = g.Key,
                NextReservation = g.OrderBy(r => r.StartTime).First()
            })
            .ToDictionaryAsync(x => x.RoomName, x => x.NextReservation, cancellationToken);

        var equipment = entities.Select(entity =>
        {
            // If equipment is in a room and that room has a next booking, inherit it
            if (!string.IsNullOrWhiteSpace(entity.Location) && 
                nextBookings.TryGetValue(entity.Location, out var nextReservation))
            {
                entity.NextBookingStart = nextReservation.StartTime;
                entity.NextBookingEnd = nextReservation.EndTime;
                entity.ReservedBy = nextReservation.ReservedBy;
            }
            return MapToModel(entity);
        }).ToList();

        return Ok(new EquipmentResponse
        {
            Equipment = equipment,
            Total = total,
            Page = safePage,
            PerPage = perPage,
            TotalPages = totalPages
        });
    }

    /// <summary>
    /// Get a single equipment item by ID
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(EquipmentModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EquipmentModel>> GetEquipmentItem(string id, CancellationToken cancellationToken)
    {
        var entity = await _db.Equipment.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (entity == null)
        {
            return NotFound(new ProblemDetails { Title = "Equipment not found" });
        }

        return Ok(MapToModel(entity));
    }

    /// <summary>
    /// Create a new equipment item (teachers only)
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(EquipmentModel), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<EquipmentModel>> CreateEquipment(
        [FromBody] CreateEquipmentRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsTeacher)
        {
            return StatusCode(403, new ProblemDetails { Title = "Only teachers can create equipment" });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new ProblemDetails { Title = "Equipment name is required" });
        }

        if (string.IsNullOrWhiteSpace(request.Type))
        {
            return BadRequest(new ProblemDetails { Title = "Equipment type is required" });
        }

        var id = $"EQ-{Guid.NewGuid():N}";
        var entity = new EquipmentEntity
        {
            Id = id,
            Name = request.Name,
            Type = request.Type,
            Status = request.Status ?? "available",
            Location = string.IsNullOrWhiteSpace(request.Location) ? null : request.Location,
            AssignedTo = string.IsNullOrWhiteSpace(request.AssignedTo) ? null : request.AssignedTo,
            NextBookingStart = request.NextBookingStart,
            NextBookingEnd = request.NextBookingEnd,
            ReservedBy = request.NextBookingStart.HasValue ? CurrentEmail : null
        };

        _db.Equipment.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Equipment created: {Id} by {Email}", id, CurrentEmail);
        await _dataUpdates.NotifyEquipmentUpdated(null, "created");

        return CreatedAtAction(nameof(GetEquipmentItem), new { id }, MapToModel(entity));
    }

    /// <summary>
    /// Update equipment (teachers only)
    /// </summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(EquipmentModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<EquipmentModel>> UpdateEquipment(
        string id,
        [FromBody] UpdateEquipmentRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsTeacher)
        {
            return StatusCode(403, new ProblemDetails { Title = "Only teachers can update equipment" });
        }

        var entity = await _db.Equipment.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (entity == null)
        {
            return NotFound(new ProblemDetails { Title = "Equipment not found" });
        }

        if (request.Name != null) entity.Name = request.Name;
        if (request.Type != null) entity.Type = request.Type;
        if (request.Status != null) entity.Status = request.Status;
        
        // Location - handle explicit null or empty string
        if (request.Location != null)
        {
            entity.Location = string.IsNullOrWhiteSpace(request.Location) ? null : request.Location;
        }
        
        // AssignedTo - ALWAYS update if present in request (even if null)
        // Also automatically update status based on assignment
        entity.AssignedTo = string.IsNullOrWhiteSpace(request.AssignedTo) ? null : request.AssignedTo;
        
        // Auto-update status: if assigned to someone and status is 'available', change to 'in-use'
        // If unassigned and status is 'in-use', change back to 'available'
        if (!string.IsNullOrWhiteSpace(entity.AssignedTo) && entity.Status == "available")
        {
            entity.Status = "in-use";
        }
        else if (string.IsNullOrWhiteSpace(entity.AssignedTo) && entity.Status == "in-use")
        {
            entity.Status = "available";
        }
        
        if (request.NextBookingStart.HasValue) 
        {
            entity.NextBookingStart = request.NextBookingStart;
            entity.ReservedBy = CurrentEmail;
        }
        if (request.NextBookingEnd.HasValue) entity.NextBookingEnd = request.NextBookingEnd;

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Equipment updated: {Id} by {Email}", id, CurrentEmail);
        await _dataUpdates.NotifyEquipmentUpdated(null, "updated");

        return Ok(MapToModel(entity));
    }

    /// <summary>
    /// Delete equipment (teachers only)
    /// </summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteEquipment(string id, CancellationToken cancellationToken)
    {
        if (!IsTeacher)
        {
            return StatusCode(403, new ProblemDetails { Title = "Only teachers can delete equipment" });
        }

        var entity = await _db.Equipment.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (entity == null)
        {
            return NotFound(new ProblemDetails { Title = "Equipment not found" });
        }

        _db.Equipment.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Equipment deleted: {Id} by {Email}", id, CurrentEmail);
        await _dataUpdates.NotifyEquipmentUpdated(null, "deleted");

        return NoContent();
    }

    /// <summary>
    /// Bulk delete equipment (teachers only)
    /// </summary>
    [HttpPost("bulk-delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> BulkDeleteEquipment(
        [FromBody] List<string> ids,
        CancellationToken cancellationToken)
    {
        if (!IsTeacher)
        {
            return StatusCode(403, new ProblemDetails { Title = "Only teachers can delete equipment" });
        }

        if (ids == null || ids.Count == 0)
        {
            return BadRequest(new ProblemDetails { Title = "Equipment IDs are required" });
        }

        var equipment = await _db.Equipment.Where(e => ids.Contains(e.Id)).ToListAsync(cancellationToken);
        _db.Equipment.RemoveRange(equipment);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Bulk deleted {Count} equipment items by {Email}", equipment.Count, CurrentEmail);
        await _dataUpdates.NotifyEquipmentUpdated(null, "deleted");

        return NoContent();
    }

    private static EquipmentModel MapToModel(EquipmentEntity entity)
    {
        var now = DateTime.UtcNow;
        var isAvailable = !entity.NextBookingStart.HasValue || 
                         !entity.NextBookingEnd.HasValue ||
                         entity.NextBookingEnd.Value < now;
        
        return new EquipmentModel
        {
            Id = entity.Id,
            Name = entity.Name,
            Type = entity.Type,
            Status = entity.Status,
            Location = entity.Location,
            AssignedTo = entity.AssignedTo,
            NextBookingStart = entity.NextBookingStart,
            NextBookingEnd = entity.NextBookingEnd,
            ReservedBy = entity.ReservedBy,
            IsAvailable = isAvailable
        };
    }
}
