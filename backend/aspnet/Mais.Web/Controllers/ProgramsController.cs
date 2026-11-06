using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Services;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/programs")]
[Authorize]
public class ProgramsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<ProgramsController> _logger;
    private readonly IDataUpdateService _dataUpdates;

    public ProgramsController(AppDbContext db, ILogger<ProgramsController> logger, IDataUpdateService dataUpdates)
    {
        _db = db;
        _logger = logger;
        _dataUpdates = dataUpdates;
    }

    /// <summary>
    /// Get all distinct programs from Programs table
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<ProgramResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPrograms([FromQuery] string? faculty)
    {
        try
        {
            var query = _db.Programs.AsNoTracking().Where(p => p.Active);
            
            if (!string.IsNullOrWhiteSpace(faculty))
                query = query.Where(p => p.Faculty == faculty);

            var programs = await query
                .OrderBy(p => p.Faculty)
                .ThenBy(p => p.Name)
                .ToListAsync();

            var result = programs.Select(p => new ProgramResponse
            {
                Id = p.Id,
                Name = p.Name,
                Code = p.Code,
                Faculty = p.Faculty ?? "",
                DepartmentId = p.DepartmentId,
                Level = p.Level ?? "",
                DurationYears = p.DurationYears,
                AwardedDegree = p.AwardedDegree,
                Description = p.Description,
                Active = p.Active
            }).ToList();

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get programs");
            return StatusCode(500, new { error = "Failed to retrieve programs" });
        }
    }

    /// <summary>
    /// Check if program can be safely deleted
    /// </summary>
    [HttpGet("{name}/usage")]
    [ProducesResponseType(typeof(ProgramUsageResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProgramUsage(string name)
    {
        try
        {
            var coursesCount = await _db.Courses.CountAsync(c => c.Program == name);
            var facultyCount = await _db.Faculty.CountAsync(f => f.Program == name);
            var classGroupsCount = await _db.ClassGroups.CountAsync(g => g.Program == name && g.IsActive);

            var response = new ProgramUsageResponse
            {
                Program = name,
                CoursesCount = coursesCount,
                FacultyCount = facultyCount,
                ClassGroupsCount = classGroupsCount,
                TotalUsage = coursesCount + facultyCount + classGroupsCount,
                CanDelete = coursesCount == 0 && facultyCount == 0 && classGroupsCount == 0
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get program usage for {Name}", name);
            return StatusCode(500, new { error = "Failed to check program usage" });
        }
    }

    public class ProgramResponse
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Faculty { get; set; } = string.Empty;
        public string? DepartmentId { get; set; }
        public string Level { get; set; } = string.Empty;
        public int DurationYears { get; set; }
        public string? AwardedDegree { get; set; }
        public string? Description { get; set; }
        public bool Active { get; set; }
    }

    public class ProgramUsageResponse
    {
        public string Program { get; set; } = string.Empty;
        public int CoursesCount { get; set; }
        public int FacultyCount { get; set; }
        public int ClassGroupsCount { get; set; }
        public int TotalUsage { get; set; }
        public bool CanDelete { get; set; }
    }
}
