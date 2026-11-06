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
[Route("api/rooms")]
[Authorize]
public class RoomsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<RoomsController> _logger;
    private readonly IDataUpdateService _dataUpdates;

    public RoomsController(AppDbContext db, ILogger<RoomsController> logger, IDataUpdateService dataUpdates)
    {
        _db = db;
        _logger = logger;
        _dataUpdates = dataUpdates;
    }

    private string? CurrentEmail => User.FindFirstValue(ClaimTypes.Email);
    private string? CurrentRole => User.FindFirstValue(ClaimTypes.Role);
    private bool IsTeacher => string.Equals(CurrentRole, "teacher", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Get all rooms with optional filtering and pagination
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(RoomsResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<RoomsResponse>> GetRooms(
        [FromQuery] string? type,
        [FromQuery] string? search,
        [FromQuery] int? minCapacity,
        [FromQuery] int? maxCapacity,
        [FromQuery] bool? active,
        [FromQuery] string? building,
        [FromQuery] string? sort = "name",
        [FromQuery] string? dir = "asc",
        [FromQuery] int page = 1,
        [FromQuery] int perPage = 50,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Rooms.AsNoTracking();

        // Type filter
        if (!string.IsNullOrWhiteSpace(type))
        {
            query = query.Where(r => r.Type != null && r.Type.ToLower() == type.ToLower());
        }

        // Search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.Trim().ToLower();
            query = query.Where(r =>
                (r.Name != null && r.Name.ToLower().Contains(searchTerm)) ||
                (r.Type != null && r.Type.ToLower().Contains(searchTerm)) ||
                (r.Location != null && r.Location.ToLower().Contains(searchTerm)));
        }

        // Capacity filters
        if (minCapacity.HasValue)
        {
            query = query.Where(r => r.Capacity >= minCapacity.Value);
        }
        if (maxCapacity.HasValue)
        {
            query = query.Where(r => r.Capacity <= maxCapacity.Value);
        }

        // Active filter
        if (active.HasValue)
        {
            query = query.Where(r => r.Active == active.Value);
        }

        // Building filter
        if (!string.IsNullOrWhiteSpace(building))
        {
            query = query.Where(r => r.Building != null && r.Building.ToLower().Contains(building.ToLower()));
        }

        // Sorting
        query = (sort?.ToLower(), dir?.ToLower()) switch
        {
            ("type", "asc") => query.OrderBy(r => r.Type).ThenBy(r => r.Name),
            ("type", _) => query.OrderByDescending(r => r.Type).ThenBy(r => r.Name),
            ("capacity", "asc") => query.OrderBy(r => r.Capacity).ThenBy(r => r.Name),
            ("capacity", _) => query.OrderByDescending(r => r.Capacity).ThenBy(r => r.Name),
            ("name", "desc") => query.OrderByDescending(r => r.Name),
            _ => query.OrderBy(r => r.Name)
        };

        var total = await query.CountAsync(cancellationToken);
        var totalPages = (int)Math.Ceiling(total / (double)perPage);
        var safePage = Math.Max(1, Math.Min(page, Math.Max(1, totalPages)));
        var skip = (safePage - 1) * perPage;

        var entities = await query
            .Skip(skip)
            .Take(perPage)
            .ToListAsync(cancellationToken);

        // Calculate next bookings from resource reservations for all rooms at once
        var roomNames = entities.Select(e => e.Name).ToHashSet();
        var now = DateTime.UtcNow;
        
        // Get next reservation for each room
        var nextBookings = await _db.ResourceReservations
            .AsNoTracking()
            .Where(r => r.ResourceType == "room" && roomNames.Contains(r.ResourceName))
            .Where(r => r.StartTime > now && r.Status == "active")
            .GroupBy(r => r.ResourceName)
            .Select(g => new
            {
                RoomName = g.Key,
                NextReservation = g.OrderBy(r => r.StartTime).First()
            })
            .ToDictionaryAsync(x => x.RoomName, x => x.NextReservation, cancellationToken);

        var rooms = entities.Select(entity =>
        {
            // If we have a next booking from reservations, use it
            if (nextBookings.TryGetValue(entity.Name, out var nextReservation))
            {
                entity.NextBookingStart = nextReservation.StartTime;
                entity.NextBookingEnd = nextReservation.EndTime;
                entity.ReservedBy = nextReservation.ReservedBy;
            }
            return MapToModel(entity);
        }).ToList();

        return Ok(new RoomsResponse
        {
            Rooms = rooms,
            Total = total,
            Page = safePage,
            PerPage = perPage,
            TotalPages = totalPages
        });
    }

    /// <summary>
    /// Get a single room by ID
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(RoomModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomModel>> GetRoom(string id, CancellationToken cancellationToken)
    {
        var entity = await _db.Rooms.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (entity == null)
        {
            return NotFound(new ProblemDetails { Title = "Room not found" });
        }

        return Ok(MapToModel(entity));
    }

    /// <summary>
    /// Create a new room (teachers only)
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(RoomModel), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<RoomModel>> CreateRoom(
        [FromBody] CreateRoomRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsTeacher)
        {
            return StatusCode(403, new ProblemDetails { Title = "Only teachers can create rooms" });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new ProblemDetails { Title = "Room name is required" });
        }

        // Check for duplicate name
        var exists = await _db.Rooms.AnyAsync(r => r.Name.ToLower() == request.Name.ToLower(), cancellationToken);
        if (exists)
        {
            return BadRequest(new ProblemDetails { Title = "A room with this name already exists" });
        }

        var id = $"room:{Guid.NewGuid():N}";
        var entity = new RoomEntity
        {
            Id = id,
            Name = request.Name,
            Type = request.Type,
            Capacity = request.Capacity,
            Link = request.Link,
            Email = request.Email,
            Location = request.Location,
            Building = request.Building,
            Floor = request.Floor,
            Description = request.Description,
            Active = request.Active
        };

        _db.Rooms.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Room created: {Id} by {Email}", id, CurrentEmail);
        await _dataUpdates.NotifyRoomUpdated(null, "created");

        return CreatedAtAction(nameof(GetRoom), new { id }, MapToModel(entity));
    }

    /// <summary>
    /// Update a room (teachers only)
    /// </summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(RoomModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<RoomModel>> UpdateRoom(
        string id,
        [FromBody] UpdateRoomRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsTeacher)
        {
            return StatusCode(403, new ProblemDetails { Title = "Only teachers can update rooms" });
        }

        var entity = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (entity == null)
        {
            return NotFound(new ProblemDetails { Title = "Room not found" });
        }

        // Check for duplicate name (if changing name)
        if (!string.IsNullOrWhiteSpace(request.Name) && request.Name != entity.Name)
        {
            var exists = await _db.Rooms.AnyAsync(
                r => r.Id != id && r.Name.ToLower() == request.Name.ToLower(),
                cancellationToken);
            if (exists)
            {
                return BadRequest(new ProblemDetails { Title = "A room with this name already exists" });
            }
            entity.Name = request.Name;
        }

        if (request.Type != null) entity.Type = request.Type;
        if (request.Capacity.HasValue) entity.Capacity = request.Capacity.Value;
        if (request.Link != null) entity.Link = request.Link;
        if (request.Email != null) entity.Email = request.Email;
        if (request.Location != null) entity.Location = request.Location;
        if (request.Building != null) entity.Building = request.Building;
        if (request.Floor != null) entity.Floor = request.Floor;
        if (request.Description != null) entity.Description = request.Description;
        if (request.Active.HasValue) entity.Active = request.Active.Value;

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Room updated: {Id} by {Email}", id, CurrentEmail);
        await _dataUpdates.NotifyRoomUpdated(null, "updated");

        return Ok(MapToModel(entity));
    }

    /// <summary>
    /// Delete a room (teachers only)
    /// </summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteRoom(string id, CancellationToken cancellationToken)
    {
        if (!IsTeacher)
        {
            return StatusCode(403, new ProblemDetails { Title = "Only teachers can delete rooms" });
        }

        var entity = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (entity == null)
        {
            return NotFound(new ProblemDetails { Title = "Room not found" });
        }

        _db.Rooms.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Room deleted: {Id} by {Email}", id, CurrentEmail);
        await _dataUpdates.NotifyRoomUpdated(null, "deleted");

        return NoContent();
    }

    /// <summary>
    /// Bulk delete rooms (teachers only)
    /// </summary>
    [HttpPost("bulk-delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> BulkDeleteRooms(
        [FromBody] List<string> ids,
        CancellationToken cancellationToken)
    {
        if (!IsTeacher)
        {
            return StatusCode(403, new ProblemDetails { Title = "Only teachers can delete rooms" });
        }

        if (ids == null || ids.Count == 0)
        {
            return BadRequest(new ProblemDetails { Title = "Room IDs are required" });
        }

        var rooms = await _db.Rooms.Where(r => ids.Contains(r.Id)).ToListAsync(cancellationToken);
        _db.Rooms.RemoveRange(rooms);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Bulk deleted {Count} rooms by {Email}", rooms.Count, CurrentEmail);
        await _dataUpdates.NotifyRoomUpdated(null, "deleted");

        return NoContent();
    }

    private static RoomModel MapToModel(RoomEntity entity)
    {
        var now = DateTime.UtcNow;
        var isAvailable = !entity.NextBookingStart.HasValue || 
                         !entity.NextBookingEnd.HasValue ||
                         entity.NextBookingEnd.Value < now;
        
        return new RoomModel
        {
            Id = entity.Id,
            Name = entity.Name,
            Type = entity.Type,
            Capacity = entity.Capacity,
            Link = entity.Link,
            Email = entity.Email,
            Location = entity.Location,
            Building = entity.Building,
            Floor = entity.Floor,
            Description = entity.Description,
            Active = entity.Active,
            NextBookingStart = entity.NextBookingStart,
            NextBookingEnd = entity.NextBookingEnd,
            ReservedBy = entity.ReservedBy,
            IsAvailable = isAvailable
        };
    }
}
