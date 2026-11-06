using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Models;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/courses/manage")]
[Authorize]
public class CoursesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<CoursesController> _logger;

    public CoursesController(AppDbContext db, ILogger<CoursesController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Normalize TypeSk value - fix Profile values that were incorrectly stored as Type
    /// </summary>
    private static string NormalizeTypeSk(string? typeSk)
    {
        if (string.IsNullOrWhiteSpace(typeSk))
            return "P+CL";

        var normalized = typeSk.Trim();

        // Profile values that should be in Profile field, not TypeSk
        var profileValues = new[] { "PV", "PP", "PVP", "PV/PVP" };
        if (profileValues.Contains(normalized, StringComparer.OrdinalIgnoreCase))
            return "P+CL";

        // Old format conversions
        if (normalized.Equals("P", StringComparison.OrdinalIgnoreCase) ||
            normalized.Equals("CL", StringComparison.OrdinalIgnoreCase) ||
            normalized.Equals("L", StringComparison.OrdinalIgnoreCase))
            return "P+CL";

        // Seminar is correct
        if (normalized.Equals("S", StringComparison.OrdinalIgnoreCase))
            return "S";

        // Already normalized
        if (normalized == "P+CL")
            return "P+CL";

        // Default
        return "P+CL";
    }

    /// <summary>
    /// Get all courses with optional filtering
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<CourseModel>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCourses(
        [FromQuery] string? faculty = null,
        [FromQuery] string? program = null,
        [FromQuery] string? search = null)
    {
        try
        {
            var query = _db.Courses.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(faculty))
                query = query.Where(c => c.Faculty == faculty);

            if (!string.IsNullOrWhiteSpace(program))
                query = query.Where(c => c.Program == program);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                query = query.Where(c =>
                    c.Code.ToLower().Contains(s) ||
                    (c.NameEn != null && c.NameEn.ToLower().Contains(s)) ||
                    (c.NameSk != null && c.NameSk.ToLower().Contains(s)) ||
                    (c.Faculty != null && c.Faculty.ToLower().Contains(s)) ||
                    (c.Program != null && c.Program.ToLower().Contains(s))
                );
            }

            var courses = await query
                .OrderBy(c => c.Code)
                .Select(c => new CourseModel
                {
                    Code = c.Code,
                    NameEn = c.NameEn,
                    NameSk = c.NameSk,
                    Credits = c.Credits,
                    TypeSk = c.TypeSk, // Will be normalized when returned
                    CompletionSk = c.CompletionSk,
                    Faculty = c.Faculty,
                    Program = c.Program,
                    Profile = c.Profile,
                    HoursSk = c.HoursSk,
                    PeriodSk = c.PeriodSk
                })
                .ToListAsync();

            // Normalize TypeSk values on the fly
            foreach (var course in courses)
            {
                course.TypeSk = NormalizeTypeSk(course.TypeSk);
            }

            return Ok(new { items = courses, total = courses.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get courses");
            return StatusCode(500, new { error = "Failed to retrieve courses" });
        }
    }

    /// <summary>
    /// Get course by code
    /// </summary>
    [HttpGet("{code}")]
    [ProducesResponseType(typeof(CourseModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCourse(string code)
    {
        try
        {
            var course = await _db.Courses.AsNoTracking()
                .Where(c => c.Code == code)
                .Select(c => new CourseModel
                {
                    Code = c.Code,
                    NameEn = c.NameEn,
                    NameSk = c.NameSk,
                    Credits = c.Credits,
                    TypeSk = c.TypeSk,
                    CompletionSk = c.CompletionSk,
                    Faculty = c.Faculty,
                    Program = c.Program,
                    Profile = c.Profile,
                    HoursSk = c.HoursSk,
                    PeriodSk = c.PeriodSk
                })
                .FirstOrDefaultAsync();

            if (course == null)
                return NotFound(new { error = $"Course {code} not found" });

            // Normalize TypeSk value
            course.TypeSk = NormalizeTypeSk(course.TypeSk);

            return Ok(course);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get course {Code}", code);
            return StatusCode(500, new { error = "Failed to retrieve course" });
        }
    }

    /// <summary>
    /// Create new course
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "RequireTeacher")]
    [ProducesResponseType(typeof(CourseModel), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCourse([FromBody] CourseModel model)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(model.Code))
                return BadRequest(new { error = "Course code is required" });

            if (string.IsNullOrWhiteSpace(model.NameEn))
                return BadRequest(new { error = "Course name (English) is required" });

            // Check if course already exists
            var exists = await _db.Courses.AnyAsync(c => c.Code == model.Code);
            if (exists)
                return BadRequest(new { error = $"Course with code {model.Code} already exists" });

            var course = new CourseEntity
            {
                Code = model.Code,
                NameEn = model.NameEn,
                NameSk = model.NameSk,
                Credits = model.Credits,
                TypeSk = model.TypeSk ?? "P",
                CompletionSk = model.CompletionSk,
                Faculty = model.Faculty,
                Program = model.Program,
                Profile = model.Profile,
                HoursSk = model.HoursSk,
                PeriodSk = model.PeriodSk
            };

            _db.Courses.Add(course);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Created course {Code}", course.Code);

            return CreatedAtAction(nameof(GetCourse), new { code = course.Code }, model);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create course");
            return StatusCode(500, new { error = "Failed to create course" });
        }
    }

    /// <summary>
    /// Update existing course
    /// </summary>
    [HttpPut("{code}")]
    [Authorize(Policy = "RequireTeacher")]
    [ProducesResponseType(typeof(CourseModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCourse(string code, [FromBody] CourseModel model)
    {
        try
        {
            var course = await _db.Courses.FirstOrDefaultAsync(c => c.Code == code);
            if (course == null)
                return NotFound(new { error = $"Course {code} not found" });

            if (!string.IsNullOrWhiteSpace(model.NameEn))
                course.NameEn = model.NameEn;

            course.NameSk = model.NameSk;
            course.Credits = model.Credits;

            if (!string.IsNullOrWhiteSpace(model.TypeSk))
                course.TypeSk = model.TypeSk;

            course.CompletionSk = model.CompletionSk;
            course.Faculty = model.Faculty;
            course.Program = model.Program;
            course.Profile = model.Profile;
            course.HoursSk = model.HoursSk;
            course.PeriodSk = model.PeriodSk;

            await _db.SaveChangesAsync();

            _logger.LogInformation("Updated course {Code}", code);

            return Ok(model);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update course {Code}", code);
            return StatusCode(500, new { error = "Failed to update course" });
        }
    }

    /// <summary>
    /// Delete course
    /// </summary>
    [HttpDelete("{code}")]
    [Authorize(Policy = "RequireTeacher")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DeleteCourse(string code)
    {
        try
        {
            var course = await _db.Courses.FirstOrDefaultAsync(c => c.Code == code);
            if (course == null)
                return NotFound(new { error = $"Course {code} not found" });

            // Check if course is used in schedule
            var usedInSchedule = await _db.Timetable.AnyAsync(t => t.CourseCode == code);
            if (usedInSchedule)
                return BadRequest(new { error = "Cannot delete course that is used in schedule" });

            // Check if course has enrollments
            var hasEnrollments = await _db.Enrollments.AnyAsync(e => e.CourseCode == code);
            if (hasEnrollments)
                return BadRequest(new { error = "Cannot delete course that has student enrollments" });

            _db.Courses.Remove(course);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Deleted course {Code}", code);

            return Ok(new { message = "Course deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete course {Code}", code);
            return StatusCode(500, new { error = "Failed to delete course" });
        }
    }

    /// <summary>
    /// Get distinct faculties from courses
    /// </summary>
    [HttpGet("faculties/distinct")]
    [ProducesResponseType(typeof(List<string>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDistinctFaculties()
    {
        try
        {
            var faculties = await _db.Courses
                .Where(c => !string.IsNullOrEmpty(c.Faculty))
                .Select(c => c.Faculty!)
                .Distinct()
                .OrderBy(f => f)
                .ToListAsync();

            return Ok(faculties);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get distinct faculties");
            return StatusCode(500, new { error = "Failed to retrieve faculties" });
        }
    }

    /// <summary>
    /// Get distinct programs from courses
    /// </summary>
    [HttpGet("programs/distinct")]
    [ProducesResponseType(typeof(List<string>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDistinctPrograms([FromQuery] string? faculty = null)
    {
        try
        {
            var query = _db.Courses.Where(c => !string.IsNullOrEmpty(c.Program));

            if (!string.IsNullOrWhiteSpace(faculty))
                query = query.Where(c => c.Faculty == faculty);

            var programs = await query
                .Select(c => c.Program!)
                .Distinct()
                .OrderBy(p => p)
                .ToListAsync();

            return Ok(programs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get distinct programs");
            return StatusCode(500, new { error = "Failed to retrieve programs" });
        }
    }
}
