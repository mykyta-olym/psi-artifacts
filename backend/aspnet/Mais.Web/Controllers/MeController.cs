using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Mais.Web.Models;
using Mais.Web.Data;

namespace Mais.Web.Controllers;

[Authorize]
public class MeController : BaseController
{
    private readonly AppDbContext _db;

    public MeController(IWebHostEnvironment env, IConfiguration config, AppDbContext db) : base(env, config)
    {
        _db = db;
    }

    /// <summary>
    /// Get current authenticated user information
    /// </summary>
    /// <returns>User profile information including role-specific data</returns>
    /// <remarks>
    /// Returns comprehensive user information based on the authenticated user's role:
    /// - For teachers: faculty information, departments, subjects, office hours, working hours, rating
    /// - For students: study program, faculty, degree, study year, enrollment semester
    /// 
    /// If multiple student records exist for the same email, returns the non-archived one with most recent activity.
    /// Includes last login timestamp from user credentials.
    /// </remarks>
    [HttpGet]
    [Route("/api/me")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMe()
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "student";
        var cred = await _db.UserCredentials.AsNoTracking().FirstOrDefaultAsync(x => x.Email.ToLower() == email.ToLower());

        string fullName = email;
        string? facultyName = null;
        string? program = null;
        string? department = null;
        string? degree = null;
        int? studyYear = null;
        string? phone = null;
        string? office = null;
        object officeHours = new { };
        object workingHours = new { };
        List<string> departments = new();
        List<string> subjects = new();
        double? rating = null;

        if (role == "teacher")
        {
            var f = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(x => x.Email.ToLower() == email.ToLower());
            if (f != null)
            {
                fullName = f.FullName;
                facultyName = f.Faculty;
                program = f.Program;
                department = f.Department;
                phone = f.Phone;
                office = f.Office;
                try
                {
                    officeHours = string.IsNullOrWhiteSpace(f.OfficeHoursJson)
                        ? new Dictionary<string, object>()
                        : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(f.OfficeHoursJson!) ?? new Dictionary<string, object>();
                }
                catch { officeHours = new Dictionary<string, object>(); }
                try
                {
                    workingHours = string.IsNullOrWhiteSpace(f.WorkingHoursJson)
                        ? new Dictionary<string, object>()
                        : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(f.WorkingHoursJson!) ?? new Dictionary<string, object>();
                }
                catch { workingHours = new Dictionary<string, object>(); }
                try
                {
                    departments = string.IsNullOrWhiteSpace(f.DepartmentsJson)
                        ? new List<string>()
                        : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.DepartmentsJson!) ?? new List<string>();
                }
                catch { departments = new List<string>(); }
                try
                {
                    subjects = string.IsNullOrWhiteSpace(f.SubjectsJson)
                        ? new List<string>()
                        : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.SubjectsJson!) ?? new List<string>();
                }
                catch { subjects = new List<string>(); }
                
                // Get dynamic rating from TeacherRatings table
                var avgRating = await _db.TeacherRatings
                    .Where(r => r.TeacherId == f.Id)
                    .AverageAsync(r => (double?)r.Rating);
                rating = avgRating.HasValue ? Math.Round(avgRating.Value, 2) : 0.0;
            }
        }
        else
        {
            // If multiple students with same email exist, prefer non-archived ones, then by most recent activity
            var s = await _db.Students.AsNoTracking()
                .Where(x => x.Email.ToLower() == email.ToLower())
                .OrderByDescending(x => x.IsArchived == false) // Non-archived first
                .ThenByDescending(x => x.LastActivity != null ? x.LastActivity : "") // Most recent activity
                .ThenByDescending(x => x.StudyYear) // Higher year first
                .FirstOrDefaultAsync();
            if (s != null)
            {
                fullName = s.FullName;
                facultyName = s.Faculty;
                program = s.Program;
                degree = s.Degree;
                studyYear = s.StudyYear;
            }
        }

        var user = new { email, role, fullName };
        var result = new Dictionary<string, object?>
        {
            ["user"] = user,
            ["faculty"] = facultyName,
            ["program"] = program,
            ["department"] = department,
            ["degree"] = degree,
            ["studyYear"] = studyYear,
            ["phone"] = phone,
            ["office"] = office,
            ["officeHours"] = officeHours,
            ["workingHours"] = workingHours,
            ["departments"] = departments,
            ["subjects"] = subjects,
            ["rating"] = rating,
            ["lastLoginAt"] = cred?.LastLoginAt?.ToString("o")
        };

        // Add student enrollment semester if student
        if (role == "student")
        {
            // If multiple students with same email exist, prefer non-archived ones, then by most recent activity
            var s = await _db.Students.AsNoTracking()
                .Where(x => x.Email.ToLower() == email.ToLower())
                .OrderByDescending(x => x.IsArchived == false) // Non-archived first
                .ThenByDescending(x => x.LastActivity != null ? x.LastActivity : "") // Most recent activity
                .ThenByDescending(x => x.StudyYear) // Higher year first
                .FirstOrDefaultAsync();
            if (s != null)
            {
                result["student"] = new
                {
                    id = s.Id,
                    personId = s.PersonId,
                    enrollmentSemester = s.EnrollmentSemester,
                    gradeKey = s.EnrollmentSemester, // For backward compatibility
                };
            }
        }

        return Ok(result);
    }
}
