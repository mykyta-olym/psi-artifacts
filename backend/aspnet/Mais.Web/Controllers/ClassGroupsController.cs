using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Services;
using System.Security.Claims;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/class-groups")]
[Authorize]
public class ClassGroupsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDataUpdateService _dataUpdates;

    public ClassGroupsController(AppDbContext db, IDataUpdateService dataUpdates)
    {
        _db = db;
        _dataUpdates = dataUpdates;
    }

    public record CreateClassGroupRequest(
        string Name,
        string Faculty,
        string Program,
        int? Capacity,
        string? Description
    );

    public record UpdateClassGroupRequest(
        string? Name,
        string? Faculty,
        string? Program,
        int? Capacity,
        string? Description,
        bool? IsActive
    );

    /// <summary>
    /// Get all class groups with optional filtering
    /// </summary>
    /// <param name="faculty">Filter by faculty code</param>
    /// <param name="program">Filter by program name</param>
    /// <param name="teacherEmail">Filter by teacher email</param>
    /// <param name="activeOnly">Return only active groups (default: true)</param>
    /// <returns>List of class groups</returns>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetClassGroups(
        [FromQuery] string? faculty,
        [FromQuery] string? program,
        [FromQuery] string? teacherEmail,
        [FromQuery] bool activeOnly = true)
    {
        var query = _db.ClassGroups.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(faculty))
            query = query.Where(g => g.Faculty.ToLower() == faculty.ToLower());

        if (!string.IsNullOrWhiteSpace(program))
            query = query.Where(g => g.Program.ToLower() == program.ToLower());

        if (!string.IsNullOrWhiteSpace(teacherEmail))
            query = query.Where(g => g.TeacherEmail != null && g.TeacherEmail.ToLower() == teacherEmail.ToLower());

        if (activeOnly)
            query = query.Where(g => g.IsActive);

        var groups = await query.OrderBy(g => g.Faculty).ThenBy(g => g.Program).ThenBy(g => g.Name).ToListAsync();
        return Ok(groups);
    }

    /// <summary>
    /// Get distinct faculties from class groups and courses
    /// </summary>
    /// <returns>List of unique faculty codes</returns>
    [HttpGet("faculties")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetFaculties()
    {
        var fromGroups = await _db.ClassGroups.AsNoTracking()
            .Where(g => !string.IsNullOrWhiteSpace(g.Faculty))
            .Select(g => g.Faculty)
            .Distinct()
            .ToListAsync();

        var fromCourses = await _db.Courses.AsNoTracking()
            .Where(c => !string.IsNullOrWhiteSpace(c.Faculty))
            .Select(c => c.Faculty!)
            .Distinct()
            .ToListAsync();

        var fromFaculty = await _db.Faculty.AsNoTracking()
            .Where(f => !string.IsNullOrWhiteSpace(f.Faculty))
            .Select(f => f.Faculty)
            .Distinct()
            .ToListAsync();

        var combined = fromGroups.Concat(fromCourses).Concat(fromFaculty)
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(f => f)
            .ToList();

        return Ok(combined);
    }

    /// <summary>
    /// Get distinct programs from class groups and courses
    /// </summary>
    /// <param name="faculty">Optional: filter programs by faculty</param>
    /// <returns>List of unique program names</returns>
    [HttpGet("programs")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPrograms([FromQuery] string? faculty)
    {
        IQueryable<string> fromGroups = _db.ClassGroups.AsNoTracking()
            .Where(g => !string.IsNullOrWhiteSpace(g.Program))
            .Select(g => g.Program);

        IQueryable<string> fromCourses = _db.Courses.AsNoTracking()
            .Where(c => !string.IsNullOrWhiteSpace(c.Program))
            .Select(c => c.Program!);

        IQueryable<string> fromFaculty = _db.Faculty.AsNoTracking()
            .Where(f => !string.IsNullOrWhiteSpace(f.Program))
            .Select(f => f.Program!);

        if (!string.IsNullOrWhiteSpace(faculty))
        {
            var facNorm = faculty.ToLower();
            fromGroups = _db.ClassGroups.AsNoTracking()
                .Where(g => !string.IsNullOrWhiteSpace(g.Program) && g.Faculty.ToLower() == facNorm)
                .Select(g => g.Program);
            fromCourses = _db.Courses.AsNoTracking()
                .Where(c => !string.IsNullOrWhiteSpace(c.Program) && c.Faculty != null && c.Faculty.ToLower() == facNorm)
                .Select(c => c.Program!);
            fromFaculty = _db.Faculty.AsNoTracking()
                .Where(f => !string.IsNullOrWhiteSpace(f.Program) && !string.IsNullOrWhiteSpace(f.Faculty) && f.Faculty.ToLower() == facNorm)
                .Select(f => f.Program!);
        }

        var groupPrograms = await fromGroups.ToListAsync();
        var coursePrograms = await fromCourses.ToListAsync();
        var facultyPrograms = await fromFaculty.ToListAsync();

        var combined = groupPrograms.Concat(coursePrograms).Concat(facultyPrograms)
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(p => p)
            .ToList();

        return Ok(combined);
    }

    /// <summary>
    /// Get a specific class group by ID
    /// </summary>
    /// <param name="id">Class group identifier</param>
    /// <returns>Class group details</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetClassGroup(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
            return BadRequest(new { error = "ID required" });

        var group = await _db.ClassGroups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id);
        if (group == null)
            return NotFound(new { error = "Class group not found" });

        return Ok(group);
    }

    /// <summary>
    /// Create a new class group (teachers only)
    /// </summary>
    /// <param name="req">Class group creation request</param>
    /// <returns>Created class group</returns>
    [Authorize(Policy = "RequireTeacher")]
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateClassGroup([FromBody] CreateClassGroupRequest req)
    {
        if (req == null)
            return BadRequest(new { error = "Body required" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { error = "Name is required" });

        if (string.IsNullOrWhiteSpace(req.Faculty))
            return BadRequest(new { error = "Faculty is required" });

        if (string.IsNullOrWhiteSpace(req.Program))
            return BadRequest(new { error = "Program is required" });

        var teacherEmail = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        if (string.IsNullOrWhiteSpace(teacherEmail))
            return Unauthorized(new { error = "Teacher email not found" });

        // Validate capacity (max 30)
        var capacity = req.Capacity ?? 30;
        if (capacity < 1 || capacity > 30)
            return BadRequest(new { error = "Capacity must be between 1 and 30" });

        // Generate ID: slugify name + faculty + program
        var slugName = req.Name.Trim().ToLowerInvariant().Replace(" ", "-");
        var slugFaculty = req.Faculty.Trim().ToLowerInvariant();
        var slugProgram = req.Program.Trim().ToLowerInvariant().Replace(" ", "-");
        var baseId = $"{slugName}-{slugFaculty}-{slugProgram}";

        // Ensure uniqueness
        var id = baseId;
        var counter = 1;
        while (await _db.ClassGroups.AnyAsync(g => g.Id == id))
        {
            id = $"{baseId}-{counter++}";
        }

        var now = DateTime.UtcNow;
        var group = new ClassGroupEntity
        {
            Id = id,
            Name = req.Name.Trim(),
            Faculty = req.Faculty.Trim(),
            Program = req.Program.Trim(),
            Capacity = capacity,
            StudentCount = 0,
            TeacherEmail = teacherEmail,
            Description = !string.IsNullOrWhiteSpace(req.Description) ? req.Description.Trim() : null,
            CreatedAt = now.ToString("o"),
            UpdatedAt = now.ToString("o"),
            IsActive = true
        };

        _db.ClassGroups.Add(group);
        await _db.SaveChangesAsync();

        // Notify via SignalR
        await _dataUpdates.NotifyClassGroupUpdated(group.Id, "created", teacherEmail);

        return Created($"/api/class-groups/{group.Id}", group);
    }

    /// <summary>
    /// Update an existing class group (teachers only)
    /// </summary>
    /// <param name="id">Class group identifier</param>
    /// <param name="req">Update request with fields to modify</param>
    /// <returns>Updated class group</returns>
    [Authorize(Policy = "RequireTeacher")]
    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateClassGroup(string id, [FromBody] UpdateClassGroupRequest req)
    {
        if (string.IsNullOrWhiteSpace(id))
            return BadRequest(new { error = "ID required" });

        var group = await _db.ClassGroups.FirstOrDefaultAsync(g => g.Id == id);
        if (group == null)
            return NotFound(new { error = "Class group not found" });

        var teacherEmail = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        if (string.IsNullOrWhiteSpace(teacherEmail))
            return Unauthorized(new { error = "Teacher email not found" });

        // Only the creator can update (or any teacher if no creator set)
        if (!string.IsNullOrWhiteSpace(group.TeacherEmail) &&
            !group.TeacherEmail.Equals(teacherEmail, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        // Validate capacity if provided
        if (req.Capacity.HasValue)
        {
            if (req.Capacity.Value < 1 || req.Capacity.Value > 30)
                return BadRequest(new { error = "Capacity must be between 1 and 30" });

            if (req.Capacity.Value < group.StudentCount)
                return BadRequest(new { error = $"Cannot reduce capacity below current student count ({group.StudentCount})" });

            group.Capacity = req.Capacity.Value;
        }

        if (!string.IsNullOrWhiteSpace(req.Name))
            group.Name = req.Name.Trim();

        if (!string.IsNullOrWhiteSpace(req.Faculty))
            group.Faculty = req.Faculty.Trim();

        if (!string.IsNullOrWhiteSpace(req.Program))
            group.Program = req.Program.Trim();

        if (req.Description != null)
            group.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();

        if (req.IsActive.HasValue)
            group.IsActive = req.IsActive.Value;

        group.UpdatedAt = DateTime.UtcNow.ToString("o");

        await _db.SaveChangesAsync();

        // Notify via SignalR
        await _dataUpdates.NotifyClassGroupUpdated(id, "updated", group.TeacherEmail);

        return Ok(group);
    }

    /// <summary>
    /// Delete a class group (teachers only)
    /// </summary>
    /// <param name="id">Class group identifier</param>
    /// <returns>Success status</returns>
    [Authorize(Policy = "RequireTeacher")]
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteClassGroup(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
            return BadRequest(new { error = "ID required" });

        var group = await _db.ClassGroups.FirstOrDefaultAsync(g => g.Id == id);
        if (group == null)
            return NotFound(new { error = "Class group not found" });

        var teacherEmail = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        if (string.IsNullOrWhiteSpace(teacherEmail))
            return Unauthorized(new { error = "Teacher email not found" });

        // Only the creator can delete (or any teacher if no creator set)
        if (!string.IsNullOrWhiteSpace(group.TeacherEmail) &&
            !group.TeacherEmail.Equals(teacherEmail, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        // Prevent deletion if students are enrolled
        if (group.StudentCount > 0)
            return Conflict(new { error = $"Cannot delete class group with {group.StudentCount} enrolled students" });

        _db.ClassGroups.Remove(group);
        await _db.SaveChangesAsync();

        // Notify via SignalR
        await _dataUpdates.NotifyClassGroupUpdated(id, "deleted", group.TeacherEmail);

        return Ok(new { ok = true, message = "Class group deleted successfully" });
    }
}
