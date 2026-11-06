using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Models;
using Mais.Web.Services;
using Mais.Web.Hubs;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/activities")]
[Authorize]
public class ActivitiesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<ActivitiesController> _logger;
    private readonly IDataUpdateService _dataUpdates;
    private readonly IHubContext<ActivitiesHub> _hub;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    public ActivitiesController(AppDbContext db, ILogger<ActivitiesController> logger, IDataUpdateService dataUpdates, IHubContext<ActivitiesHub> hub)
    {
        _db = db;
        _logger = logger;
        _dataUpdates = dataUpdates;
        _hub = hub;
    }

    private string? CurrentEmail => User.FindFirstValue(ClaimTypes.Email);
    private string? CurrentRole => User.FindFirstValue(ClaimTypes.Role);

    private bool IsTeacher => string.Equals(CurrentRole, "teacher", StringComparison.OrdinalIgnoreCase);
    private bool IsStudent => string.Equals(CurrentRole, "student", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Get activities with filtering, sorting, and pagination
    /// </summary>
    /// <param name="type">Filter by activity type (submissions, communications, attendance, grades, announcements, schedule). Use 'all' or omit for all types.</param>
    /// <param name="q">Search query to filter activities by title, description, subject, or student name</param>
    /// <param name="from">Start date filter (ISO 8601 format)</param>
    /// <param name="to">End date filter (ISO 8601 format)</param>
    /// <param name="requiresAction">Filter activities that require action (true) or all activities (false/null)</param>
    /// <param name="sort">Sort field: 'time' (default), 'type', 'priority', or 'action'</param>
    /// <param name="dir">Sort direction: 'asc' or 'desc' (default)</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="perPage">Items per page (default: 10)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Paginated list of activities with total count and pagination metadata</returns>
    /// <remarks>
    /// Teachers can see all activities. Students can only see their own activities.
    /// Activities are filtered by role automatically.
    /// </remarks>
    [HttpGet]
    [ProducesResponseType(typeof(ActivitiesResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ActivitiesResponse>> GetActivities(
        [FromQuery] string? type,
        [FromQuery] string? q,
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] bool? requiresAction,
        [FromQuery] string? sort = "time",
        [FromQuery] string? dir = "desc",
        [FromQuery] int page = 1,
        [FromQuery] int perPage = 10,
        CancellationToken cancellationToken = default)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized(new ProblemDetails { Title = "User email missing" });
        }

        var normalized = email.Trim().ToLowerInvariant();

        var query = _db.Activities.AsNoTracking()
            .Where(a => !a.IsArchived);

        // Role-based filtering
        if (IsTeacher)
        {
            // Teachers see ALL activities (no filtering for teachers)
            // This allows teachers to see system-wide announcements, student activities, etc.
        }
        else if (IsStudent)
        {
            // Students see:
            // 1. Activities where StudentEmail matches their email (their own activities)
            // 2. General activities without StudentEmail (announcements, schedule updates, system notices)
            //    These are broadcast activities meant for all students
            query = query.Where(a =>
                (a.StudentEmail != null && a.StudentEmail.ToLower() == normalized) ||
                (a.StudentEmail == null));
        }
        else
        {
            return Forbid();
        }

        // Type filter
        if (!string.IsNullOrWhiteSpace(type) && type != "all" && type != "pinned")
        {
            query = query.Where(a => a.Type == type);
        }

        // Requires action filter
        if (requiresAction.HasValue && requiresAction.Value)
        {
            query = query.Where(a => a.RequiresAction && !a.IsResolved);
        }

        // Date range filters
        if (!string.IsNullOrWhiteSpace(from))
        {
            if (DateTime.TryParse(from, out var fromDate))
            {
                var fromTimestamp = fromDate.ToString("o");
                query = query.Where(a => string.Compare(a.Timestamp, fromTimestamp) >= 0);
            }
        }

        if (!string.IsNullOrWhiteSpace(to))
        {
            if (DateTime.TryParse(to, out var toDate))
            {
                // Include the entire day
                var toDateEnd = toDate.AddDays(1).AddTicks(-1);
                var toTimestamp = toDateEnd.ToString("o");
                query = query.Where(a => string.Compare(a.Timestamp, toTimestamp) <= 0);
            }
        }

        // Search query
        if (!string.IsNullOrWhiteSpace(q))
        {
            var searchTerm = q.Trim().ToLower();
            query = query.Where(a =>
                (a.Title != null && a.Title.ToLower().Contains(searchTerm)) ||
                (a.Description != null && a.Description.ToLower().Contains(searchTerm)) ||
                (a.Subject != null && a.Subject.ToLower().Contains(searchTerm)) ||
                (a.StudentName != null && a.StudentName.ToLower().Contains(searchTerm)));
        }

        // Sorting
        query = (sort?.ToLower(), dir?.ToLower()) switch
        {
            ("type", "asc") => query.OrderBy(a => a.Type).ThenByDescending(a => a.Timestamp),
            ("type", _) => query.OrderByDescending(a => a.Type).ThenByDescending(a => a.Timestamp),
            ("priority", "asc") => query.OrderBy(a => a.Priority == "high" ? 1 : a.Priority == "medium" ? 2 : a.Priority == "low" ? 3 : 4).ThenByDescending(a => a.Timestamp),
            ("priority", _) => query.OrderByDescending(a => a.Priority == "high" ? 1 : a.Priority == "medium" ? 2 : a.Priority == "low" ? 3 : 4).ThenByDescending(a => a.Timestamp),
            ("action", "asc") => query.OrderBy(a => a.RequiresAction ? 0 : 1).ThenByDescending(a => a.Timestamp),
            ("action", _) => query.OrderByDescending(a => a.RequiresAction ? 0 : 1).ThenByDescending(a => a.Timestamp),
            ("time", "asc") => query.OrderBy(a => a.Timestamp),
            _ => query.OrderByDescending(a => a.Timestamp)
        };

        var total = await query.CountAsync(cancellationToken);
        var totalPages = (int)Math.Ceiling(total / (double)perPage);
        var safePage = Math.Max(1, Math.Min(page, totalPages));
        var skip = (safePage - 1) * perPage;

        _logger.LogInformation(
            "Fetching activities for {Email} (role: {Role}): total={Total}, page={Page}, perPage={PerPage}",
            normalized, CurrentRole, total, safePage, perPage);

        var entities = await query
            .Skip(skip)
            .Take(perPage)
            .ToListAsync(cancellationToken);

        var activities = entities.Select(MapToModel).ToList();

        _logger.LogInformation(
            "Returning {Count} activities for {Email}",
            activities.Count, normalized);

        return Ok(new ActivitiesResponse
        {
            Activities = activities,
            Total = total,
            Page = safePage,
            PerPage = perPage,
            TotalPages = totalPages
        });
    }

    /// <summary>
    /// Get a single activity by ID
    /// </summary>
    /// <param name="id">Activity identifier</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Activity details</returns>
    /// <remarks>
    /// Teachers can access any activity. Students can only access their own activities.
    /// Returns 404 if activity not found or access denied.
    /// </remarks>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ActivityModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ActivityModel>> GetActivity(string id, CancellationToken cancellationToken)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized(new ProblemDetails { Title = "User email missing" });
        }

        var normalized = email.Trim().ToLowerInvariant();

        var entity = await _db.Activities.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsArchived, cancellationToken);

        if (entity == null)
        {
            return NotFound(new ProblemDetails { Title = "Activity not found" });
        }

        // Check permissions
        if (IsTeacher)
        {
            if (!string.IsNullOrWhiteSpace(entity.TeacherEmail) &&
                entity.TeacherEmail.ToLower() != normalized)
            {
                return Forbid();
            }
        }
        else if (IsStudent)
        {
            if (string.IsNullOrWhiteSpace(entity.StudentEmail) ||
                entity.StudentEmail.ToLower() != normalized)
            {
                return Forbid();
            }
        }
        else
        {
            return Forbid();
        }

        return Ok(MapToModel(entity));
    }

    /// <summary>
    /// Get activities for a specific user
    /// </summary>
    /// <param name="userEmail">Email of the user whose activities to fetch</param>
    /// <param name="type">Filter by activity type</param>
    /// <param name="requiresAction">Filter by action requirement</param>
    /// <param name="sort">Sort field (time, type, priority)</param>
    /// <param name="dir">Sort direction (asc, desc)</param>
    /// <param name="page">Page number (1-based)</param>
    /// <param name="perPage">Items per page</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Paginated list of activities for the specified user</returns>
    /// <remarks>
    /// Teachers can view any user's activities.
    /// Students can only view activities of other students (not teachers).
    /// This is useful for viewing activity history in profile modals.
    /// </remarks>
    [HttpGet("user/{userEmail}")]
    [ProducesResponseType(typeof(ActivitiesResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ActivitiesResponse>> GetUserActivities(
        string userEmail,
        [FromQuery] string? type = null,
        [FromQuery] bool? requiresAction = null,
        [FromQuery] string? sort = "time",
        [FromQuery] string? dir = "desc",
        [FromQuery] int page = 1,
        [FromQuery] int perPage = 10,
        CancellationToken cancellationToken = default)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized(new ProblemDetails { Title = "User email missing" });
        }

        if (string.IsNullOrWhiteSpace(userEmail))
        {
            return BadRequest(new ProblemDetails { Title = "User email parameter is required" });
        }

        var normalizedUserEmail = userEmail.Trim().ToLowerInvariant();
        var normalizedCurrentEmail = email.Trim().ToLowerInvariant();

        // Start with non-archived activities
        var query = _db.Activities.AsNoTracking().Where(a => !a.IsArchived);

        if (IsTeacher)
        {
            // Teachers can view activities for any user (teachers or students)
            query = query.Where(a =>
                (a.TeacherEmail != null && a.TeacherEmail.ToLower() == normalizedUserEmail) ||
                (a.StudentEmail != null && a.StudentEmail.ToLower() == normalizedUserEmail));
        }
        else if (IsStudent)
        {
            // Students can only view activities where the target user is a student (not teacher)
            // First check if we're looking at our own activities
            if (normalizedUserEmail == normalizedCurrentEmail)
            {
                // Viewing own activities
                query = query.Where(a => a.StudentEmail != null && a.StudentEmail.ToLower() == normalizedUserEmail);
            }
            else
            {
                // Viewing another user's activities - only allow if target is a student
                // We filter for activities where userEmail is the student (not the teacher)
                query = query.Where(a =>
                    a.StudentEmail != null &&
                    a.StudentEmail.ToLower() == normalizedUserEmail &&
                    a.TeacherEmail != normalizedUserEmail); // Ensure userEmail is not in teacher role
            }
        }
        else
        {
            return Forbid();
        }

        // Apply filters
        if (!string.IsNullOrWhiteSpace(type))
        {
            query = query.Where(a => a.Type == type);
        }

        if (requiresAction.HasValue)
        {
            query = query.Where(a => a.RequiresAction == requiresAction.Value);
        }

        // Sorting
        query = (sort?.ToLower(), dir?.ToLower()) switch
        {
            ("type", "asc") => query.OrderBy(a => a.Type).ThenByDescending(a => a.Timestamp),
            ("type", _) => query.OrderByDescending(a => a.Type).ThenByDescending(a => a.Timestamp),
            ("priority", "asc") => query.OrderBy(a => a.Priority == "high" ? 1 : a.Priority == "medium" ? 2 : a.Priority == "low" ? 3 : 4).ThenByDescending(a => a.Timestamp),
            ("priority", _) => query.OrderByDescending(a => a.Priority == "high" ? 1 : a.Priority == "medium" ? 2 : a.Priority == "low" ? 3 : 4).ThenByDescending(a => a.Timestamp),
            ("action", "asc") => query.OrderBy(a => a.RequiresAction ? 0 : 1).ThenByDescending(a => a.Timestamp),
            ("action", _) => query.OrderByDescending(a => a.RequiresAction ? 0 : 1).ThenByDescending(a => a.Timestamp),
            ("time", "asc") => query.OrderBy(a => a.Timestamp),
            _ => query.OrderByDescending(a => a.Timestamp)
        };

        var total = await query.CountAsync(cancellationToken);
        var totalPages = (int)Math.Ceiling(total / (double)perPage);
        var safePage = Math.Max(1, Math.Min(page, totalPages));
        var skip = (safePage - 1) * perPage;

        _logger.LogInformation(
            "Fetching activities for user {UserEmail} by {Email} (role: {Role}): total={Total}, page={Page}, perPage={PerPage}",
            normalizedUserEmail, normalizedCurrentEmail, CurrentRole, total, safePage, perPage);

        var entities = await query
            .Skip(skip)
            .Take(perPage)
            .ToListAsync(cancellationToken);

        var activities = entities.Select(MapToModel).ToList();

        _logger.LogInformation(
            "Returning {Count} activities for user {UserEmail}",
            activities.Count, normalizedUserEmail);

        return Ok(new ActivitiesResponse
        {
            Activities = activities,
            Total = total,
            Page = safePage,
            PerPage = perPage,
            TotalPages = totalPages
        });
    }

    /// <summary>
    /// Create a new activity (teachers only)
    /// </summary>
    /// <param name="request">Activity creation request with type, title, description, and related entities</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Created activity with generated ID</returns>
    /// <remarks>
    /// Only teachers can create activities. The activity will be visible to:
    /// - All teachers (if no specific student/teacher email is set)
    /// - Specific student (if studentEmail is provided)
    /// - Specific teacher (if teacherEmail is provided)
    /// 
    /// Activity types: submissions, communications, attendance, grades, announcements, schedule
    /// </remarks>
    [HttpPost]
    [ProducesResponseType(typeof(ActivityModel), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ActivityModel>> CreateActivity(
        [FromBody] CreateActivityRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsTeacher)
        {
            return StatusCode(403, new ProblemDetails { Title = "Only teachers can create activities" });
        }

        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized(new ProblemDetails { Title = "User email missing" });
        }

        var now = DateTime.UtcNow;
        var id = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

        var entity = new ActivityEntity
        {
            Id = id,
            Type = request.Type,
            Title = request.Title,
            Description = request.Description,
            Subject = request.Subject,
            ClassId = request.ClassId,
            CourseCode = request.CourseCode,
            TeacherEmail = request.TeacherEmail ?? email,
            TeacherDisplay = request.TeacherDisplay,
            StudentEmail = request.StudentEmail,
            StudentName = request.StudentName,
            Room = request.Room,
            Location = request.Location,
            AssignmentId = request.AssignmentId,
            Timestamp = !string.IsNullOrWhiteSpace(request.Timestamp)
                ? request.Timestamp
                : now.ToString("o"),
            RequiresAction = request.RequiresAction,
            Priority = request.Priority,
            MetaJson = request.Meta != null
                ? JsonSerializer.Serialize(request.Meta, _jsonOptions)
                : null,
            CreatedByEmail = email,
            CreatedAt = now.ToString("o"),
            UpdatedAt = now.ToString("o"),
            IsResolved = false,
            IsArchived = false
        };

        _db.Activities.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        // Notify via SignalR
        await NotifyActivityEventAsync(entity, "ActivityCreated", cancellationToken);

        return CreatedAtAction(nameof(GetActivity), new { id }, MapToModel(entity));
    }

    /// <summary>
    /// Update an activity (teachers can update any, students can only update their own)
    /// </summary>
    /// <param name="id">Activity identifier</param>
    /// <param name="request">Update request with fields to modify (title, description, requiresAction, priority, isResolved)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Updated activity</returns>
    /// <remarks>
    /// Teachers can update any activity. Students can only update activities where they are the studentEmail.
    /// Only provided fields will be updated (partial update).
    /// </remarks>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ActivityModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ActivityModel>> UpdateActivity(
        string id,
        [FromBody] UpdateActivityRequest request,
        CancellationToken cancellationToken)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized(new ProblemDetails { Title = "User email missing" });
        }

        var normalized = email.Trim().ToLowerInvariant();

        var entity = await _db.Activities
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsArchived, cancellationToken);

        if (entity == null)
        {
            return NotFound(new ProblemDetails { Title = "Activity not found" });
        }

        // Check permissions
        if (IsTeacher)
        {
            // Teachers can update any activity
        }
        else if (IsStudent)
        {
            // Students can only update their own activities
            if (string.IsNullOrWhiteSpace(entity.StudentEmail) ||
                entity.StudentEmail.ToLower() != normalized)
            {
                return StatusCode(403, new ProblemDetails { Title = "You can only update your own activities" });
            }
        }
        else
        {
            return StatusCode(403, new ProblemDetails { Title = "Unauthorized" });
        }

        // Update fields
        if (request.Title != null) entity.Title = request.Title;
        if (request.Description != null) entity.Description = request.Description;
        if (request.RequiresAction.HasValue) entity.RequiresAction = request.RequiresAction.Value;
        if (request.Priority != null) entity.Priority = request.Priority;
        if (request.Meta != null) entity.MetaJson = JsonSerializer.Serialize(request.Meta, _jsonOptions);
        if (request.IsResolved.HasValue) entity.IsResolved = request.IsResolved.Value;

        entity.UpdatedAt = DateTime.UtcNow.ToString("o");

        await _db.SaveChangesAsync(cancellationToken);

        // Notify via SignalR
        await NotifyActivityEventAsync(entity, "ActivityUpdated", cancellationToken);

        return Ok(MapToModel(entity));
    }

    /// <summary>
    /// Mark activities as resolved (no longer require action)
    /// </summary>
    /// <param name="ids">List of activity IDs to mark as resolved</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Marks specified activities as resolved and removes the requiresAction flag.
    /// Teachers can resolve any activity. Students can only resolve their own activities.
    /// </remarks>
    [HttpPost("resolve")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ResolveActivities(
        [FromBody] List<string> ids,
        CancellationToken cancellationToken)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized(new ProblemDetails { Title = "User email missing" });
        }

        var normalized = email.Trim().ToLowerInvariant();

        if (ids == null || ids.Count == 0)
        {
            return BadRequest(new ProblemDetails { Title = "Activity IDs are required" });
        }

        var query = _db.Activities
            .Where(a => ids.Contains(a.Id) && !a.IsArchived);

        // Role-based filtering
        if (IsStudent)
        {
            query = query.Where(a =>
                (a.StudentEmail != null && a.StudentEmail.ToLower() == normalized) ||
                (a.StudentEmail == null));
        }
        // Teachers can resolve any activity

        var activities = await query.ToListAsync(cancellationToken);

        foreach (var activity in activities)
        {
            activity.IsResolved = true;
            activity.RequiresAction = false;
            activity.UpdatedAt = DateTime.UtcNow.ToString("o");
        }

        await _db.SaveChangesAsync(cancellationToken);

        // Notify via SignalR for each resolved activity
        foreach (var activity in activities)
        {
            await NotifyActivityEventAsync(activity, "ActivityUpdated", cancellationToken);
        }

        return NoContent();
    }

    /// <summary>
    /// Mark activities as requiring action (teachers only)
    /// </summary>
    /// <param name="ids">List of activity IDs to mark as requiring action</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Only teachers can mark activities as requiring action.
    /// This sets requiresAction=true and isResolved=false for the specified activities.
    /// </remarks>
    [HttpPost("mark-needs-action")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> MarkActivitiesNeedsAction(
        [FromBody] List<string> ids,
        CancellationToken cancellationToken)
    {
        if (!IsTeacher)
        {
            return StatusCode(403, new ProblemDetails { Title = "Only teachers can mark activities as requiring action" });
        }

        if (ids == null || ids.Count == 0)
        {
            return BadRequest(new ProblemDetails { Title = "Activity IDs are required" });
        }

        var activities = await _db.Activities
            .Where(a => ids.Contains(a.Id) && !a.IsArchived)
            .ToListAsync(cancellationToken);

        foreach (var activity in activities)
        {
            activity.RequiresAction = true;
            activity.IsResolved = false;
            activity.UpdatedAt = DateTime.UtcNow.ToString("o");
        }

        await _db.SaveChangesAsync(cancellationToken);

        // Notify via SignalR for each marked activity
        foreach (var activity in activities)
        {
            await NotifyActivityEventAsync(activity, "ActivityUpdated", cancellationToken);
        }

        return NoContent();
    }

    /// <summary>
    /// Delete activities (soft delete - archive) (teachers only)
    /// </summary>
    /// <param name="ids">List of activity IDs to delete</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Only teachers can delete activities. This performs a soft delete by setting isArchived=true.
    /// Archived activities are excluded from normal queries but remain in the database.
    /// </remarks>
    [HttpPost("bulk-delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteActivities(
        [FromBody] List<string> ids,
        CancellationToken cancellationToken)
    {
        if (!IsTeacher)
        {
            return StatusCode(403, new ProblemDetails { Title = "Only teachers can delete activities" });
        }

        if (ids == null || ids.Count == 0)
        {
            return BadRequest(new ProblemDetails { Title = "Activity IDs are required" });
        }

        var activities = await _db.Activities
            .Where(a => ids.Contains(a.Id) && !a.IsArchived)
            .ToListAsync(cancellationToken);

        foreach (var activity in activities)
        {
            activity.IsArchived = true;
            activity.UpdatedAt = DateTime.UtcNow.ToString("o");
        }

        await _db.SaveChangesAsync(cancellationToken);

        // Notify via SignalR for each deleted activity
        foreach (var activity in activities)
        {
            var payload = new { activityId = activity.Id };
            if (!string.IsNullOrWhiteSpace(activity.StudentEmail))
            {
                await _hub.Clients.Group($"user:{activity.StudentEmail.ToLowerInvariant()}")
                    .SendAsync("ActivityDeleted", payload, cancellationToken);
            }
            if (!string.IsNullOrWhiteSpace(activity.TeacherEmail) && activity.TeacherEmail != activity.StudentEmail)
            {
                await _hub.Clients.Group($"user:{activity.TeacherEmail.ToLowerInvariant()}")
                    .SendAsync("ActivityDeleted", payload, cancellationToken);
            }
            await _hub.Clients.Group("students").SendAsync("ActivityDeleted", payload, cancellationToken);
            await _hub.Clients.Group("teachers").SendAsync("ActivityDeleted", payload, cancellationToken);
        }

        return NoContent();
    }

    /// <summary>
    /// Get activity statistics for the current user
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Statistics object with total count, activities requiring action, and counts by type</returns>
    /// <remarks>
    /// Returns statistics filtered by user role:
    /// - Teachers: all activities they can access
    /// - Students: only their own activities
    /// 
    /// Statistics include:
    /// - total: total number of activities
    /// - needsAction: count of activities requiring action
    /// - byType: object with counts per activity type
    /// </remarks>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(Dictionary<string, object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<Dictionary<string, object>>> GetStats(
        CancellationToken cancellationToken)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized(new ProblemDetails { Title = "User email missing" });
        }

        var normalized = email.Trim().ToLowerInvariant();

        var query = _db.Activities.AsNoTracking()
            .Where(a => !a.IsArchived);

        // Role-based filtering
        if (IsTeacher)
        {
            // Teachers see ALL activities (no filtering for teachers)
        }
        else if (IsStudent)
        {
            query = query.Where(a =>
                (a.StudentEmail != null && a.StudentEmail.ToLower() == normalized) ||
                (a.StudentEmail == null));
        }
        else
        {
            return Forbid();
        }

        var total = await query.CountAsync(cancellationToken);
        var needsAction = await query.CountAsync(a => a.RequiresAction && !a.IsResolved, cancellationToken);

        var byType = await query
            .GroupBy(a => a.Type)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var stats = new Dictionary<string, object>
        {
            ["total"] = total,
            ["needsAction"] = needsAction,
            ["byType"] = byType.ToDictionary(x => x.Type, x => (object)x.Count)
        };

        return Ok(stats);
    }

    private ActivityModel MapToModel(ActivityEntity entity)
    {
        Dictionary<string, object>? meta = null;
        if (!string.IsNullOrWhiteSpace(entity.MetaJson))
        {
            try
            {
                meta = JsonSerializer.Deserialize<Dictionary<string, object>>(entity.MetaJson, _jsonOptions);
            }
            catch
            {
                // Ignore parse errors
            }
        }

        return new ActivityModel
        {
            Id = entity.Id,
            Type = entity.Type,
            Title = entity.Title,
            Description = entity.Description,
            Subject = entity.Subject,
            ClassId = entity.ClassId,
            CourseCode = entity.CourseCode,
            TeacherEmail = entity.TeacherEmail,
            TeacherDisplay = entity.TeacherDisplay,
            StudentEmail = entity.StudentEmail,
            StudentName = entity.StudentName,
            Room = entity.Room,
            Location = entity.Location,
            AssignmentId = entity.AssignmentId,
            Timestamp = entity.Timestamp,
            RequiresAction = entity.RequiresAction,
            Priority = entity.Priority,
            Meta = meta,
            CreatedByEmail = entity.CreatedByEmail,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            IsResolved = entity.IsResolved,
            IsArchived = entity.IsArchived
        };
    }

    private async Task NotifyActivityEventAsync(ActivityEntity activity, string eventName, CancellationToken ct)
    {
        var payload = MapToModel(activity);
        
        // Send to specific user groups
        if (!string.IsNullOrWhiteSpace(activity.StudentEmail))
        {
            await _hub.Clients.Group($"user:{activity.StudentEmail.ToLowerInvariant()}")
                .SendAsync(eventName, payload, ct);
        }
        
        if (!string.IsNullOrWhiteSpace(activity.TeacherEmail) && 
            activity.TeacherEmail != activity.StudentEmail)
        {
            await _hub.Clients.Group($"user:{activity.TeacherEmail.ToLowerInvariant()}")
                .SendAsync(eventName, payload, ct);
        }
        
        // Send to role-based groups
        await _hub.Clients.Group("students").SendAsync(eventName, payload, ct);
        await _hub.Clients.Group("teachers").SendAsync(eventName, payload, ct);
    }
}

