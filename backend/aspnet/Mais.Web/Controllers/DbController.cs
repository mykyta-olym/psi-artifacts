using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Services;

namespace Mais.Web.Controllers;

[Authorize(Roles = "teacher")]
[ApiController]
public class DbController : ControllerBase
{
    private readonly AppDbContext _db;

    public DbController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Get database summary statistics (teachers only)
    /// </summary>
    /// <returns>Database connection status and entity counts</returns>
    /// <remarks>
    /// Requires teacher role. Returns database connection status and counts of various entities:
    /// - Courses, Faculty, Students (unique by PersonId or Email), Rooms, Equipment, Timetable entries
    /// - Departments, Programs, ClassGroups, Enrollments, Grades, Attendance, Payments
    /// - Activities, Surveys, News, KnowledgeBase articles
    ///
    /// Students are counted uniquely by PersonId (if available) or Email (if PersonId is empty).
    /// This handles cases where the same student has multiple records (e.g., BC and ING degrees).
    /// </remarks>
    [HttpGet("api/db/summary")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Summary()
    {
        try
        {
            var canConnect = await _db.Database.CanConnectAsync();

            // Count unique students by PersonId (or Email if PersonId is empty)
            int uniqueStudents = 0;
            if (canConnect)
            {
                var studentsWithPersonId = await _db.Students
                    .Where(s => !string.IsNullOrWhiteSpace(s.PersonId))
                    .Select(s => s.PersonId)
                    .Distinct()
                    .CountAsync();

                var studentsWithoutPersonId = await _db.Students
                    .Where(s => string.IsNullOrWhiteSpace(s.PersonId))
                    .Select(s => s.Email)
                    .Distinct()
                    .CountAsync();

                uniqueStudents = studentsWithPersonId + studentsWithoutPersonId;
            }

            var payload = new
            {
                canConnect,
                // Core entities
                departments = canConnect ? await _db.Departments.CountAsync() : 0,
                programs = canConnect ? await _db.Programs.CountAsync() : 0,
                classGroups = canConnect ? await _db.ClassGroups.CountAsync() : 0,
                faculty = canConnect ? await _db.Faculty.CountAsync() : 0,
                students = uniqueStudents,
                courses = canConnect ? await _db.Courses.CountAsync() : 0,
                // Schedule & enrollment
                rooms = canConnect ? await _db.Rooms.CountAsync() : 0,
                equipment = canConnect ? await _db.Equipment.CountAsync() : 0,
                timetable = canConnect ? await _db.Timetable.CountAsync() : 0,
                enrollments = canConnect ? await _db.Enrollments.CountAsync() : 0,
                // Academic records
                assignments = canConnect ? await _db.Assignments.CountAsync() : 0,
                assignmentGrades = canConnect ? await _db.AssignmentGrades.CountAsync() : 0,
                grades = canConnect ? await _db.CourseGrades.CountAsync() : 0,
                attendance = canConnect ? await _db.Attendance.CountAsync() : 0,
                // Exams & Thesis
                examTerms = canConnect ? await _db.ExamTerms.CountAsync() : 0,
                examRegistrations = canConnect ? await _db.ExamRegistrations.CountAsync() : 0,
                thesisTopics = canConnect ? await _db.ThesisTopics.CountAsync() : 0,
                // Financial
                payments = canConnect ? await _db.Payments.CountAsync() : 0,
                // Communication & activities
                activities = canConnect ? await _db.Activities.CountAsync() : 0,
                surveys = canConnect ? await _db.Surveys.CountAsync() : 0,
                news = canConnect ? await _db.News.CountAsync() : 0,
                knowledgeBase = canConnect ? await _db.KnowledgeBaseArticles.CountAsync() : 0,
                // System data
                changelog = canConnect ? await _db.ChangelogEntries.CountAsync() : 0,
                facultyOptions = canConnect ? await _db.FacultyOptions.CountAsync() : 0
            };

            return Ok(payload);
        }
        catch (Exception ex)
        {
            return Ok(new { canConnect = false, error = ex.Message });
        }
    }

    /// <summary>
    /// Reseed the database with initial data (teachers only)
    /// </summary>
    /// <param name="seeder">Database seeder service</param>
    /// <param name="reset">If true, clears all tables before reseeding (default: false)</param>
    /// <returns>Database summary after reseeding</returns>
    /// <remarks>
    /// Requires teacher role. Reseeds the database with initial data.
    ///
    /// If reset=true, clears all tables (Timetable, Enrollments, Exams, Grades, Thesis, Equipment, Rooms, Students, Faculty, Courses) before reseeding.
    /// Otherwise, only ensures database schema and adds missing data.
    ///
    /// Returns database summary after reseeding.
    /// </remarks>
    [HttpPost("api/db/reseed")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Reseed([FromServices] DbSeeder seeder, [FromQuery] bool reset = false)
    {
        try
        {
            // Ensure database and schema exist before any operations
            await _db.Database.EnsureCreatedAsync();

            if (reset)
            {
                // Clear all tables before reseeding
                await _db.Activities.ExecuteDeleteAsync();
                await _db.Timetable.ExecuteDeleteAsync();
                await _db.Enrollments.ExecuteDeleteAsync();
                await _db.ExamRegistrations.ExecuteDeleteAsync();
                await _db.ExamTerms.ExecuteDeleteAsync();
                await _db.CourseGrades.ExecuteDeleteAsync();
                await _db.ThesisSupervisions.ExecuteDeleteAsync();
                await _db.ThesisRequests.ExecuteDeleteAsync();
                await _db.ThesisTopics.ExecuteDeleteAsync();
                await _db.Equipment.ExecuteDeleteAsync();
                await _db.Rooms.ExecuteDeleteAsync();
                await _db.Students.ExecuteDeleteAsync();
                await _db.Faculty.ExecuteDeleteAsync();
                await _db.Courses.ExecuteDeleteAsync();
            }

            await seeder.EnsureCreatedAndSeededAsync();
            return await Summary();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Clear specific database tables (teachers only)
    /// </summary>
    /// <param name="schedules">Clear timetable entries (default: false)</param>
    /// <param name="enrollments">Clear student enrollments (default: false)</param>
    /// <param name="exams">Clear exam terms and registrations (default: false)</param>
    /// <param name="grades">Clear course grades (default: false)</param>
    /// <param name="thesis">Clear thesis topics, requests, and supervisions (default: false)</param>
    /// <returns>Database summary after clearing</returns>
    /// <remarks>
    /// Requires teacher role. Selectively clears database tables based on query parameters.
    ///
    /// Can clear:
    /// - schedules: Timetable entries
    /// - enrollments: Student enrollments
    /// - exams: Exam terms and registrations
    /// - grades: Course grades
    /// - thesis: Thesis topics, requests, and supervisions
    ///
    /// Returns database summary after clearing.
    /// </remarks>
    [HttpPost("api/db/clear")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Clear(
        [FromQuery] bool schedules = false,
        [FromQuery] bool enrollments = false,
        [FromQuery] bool exams = false,
        [FromQuery] bool grades = false,
        [FromQuery] bool thesis = false)
    {
        try
        {
            var tasks = new List<Task>();

            if (grades)
                tasks.Add(_db.CourseGrades.ExecuteDeleteAsync());

            if (exams)
            {
                tasks.Add(_db.ExamRegistrations.ExecuteDeleteAsync());
                tasks.Add(_db.ExamTerms.ExecuteDeleteAsync());
            }

            if (enrollments)
                tasks.Add(_db.Enrollments.ExecuteDeleteAsync());

            if (schedules)
                tasks.Add(_db.Timetable.ExecuteDeleteAsync());

            if (thesis)
            {
                tasks.Add(_db.ThesisSupervisions.ExecuteDeleteAsync());
                tasks.Add(_db.ThesisRequests.ExecuteDeleteAsync());
                tasks.Add(_db.ThesisTopics.ExecuteDeleteAsync());
            }

            await Task.WhenAll(tasks);

            return await Summary();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Upgrade Students table schema to add new profile columns (teachers only)
    /// </summary>
    /// <returns>Success status</returns>
    /// <remarks>
    /// Requires teacher role. Performs a best-effort schema upgrade for the Students table.
    ///
    /// Adds the following columns if they don't exist:
    /// - Phone, Phone2, AltEmail, Address, ClassName
    /// - IsicCardNumber, StudentNumber, StudyNumber, PassportId
    /// - BirthDate, BirthPlace, Nationality, FamilyStatus, HealthStatus, ParentName
    /// - ConsentPersonalData, ConsentCompanyOffers (boolean)
    /// - PersonId, IsArchived (boolean, default false)
    ///
    /// Uses PostgreSQL ALTER TABLE IF EXISTS and ADD COLUMN IF NOT EXISTS to avoid errors if columns already exist.
    /// </remarks>
    [HttpPost("api/db/upgrade/students")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> UpgradeStudents()
    {
        var sql = @"
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""Phone"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""Phone2"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""AltEmail"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""Address"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""ClassName"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""IsicCardNumber"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""StudentNumber"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""StudyNumber"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""PassportId"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""BirthDate"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""BirthPlace"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""Nationality"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""FamilyStatus"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""HealthStatus"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""ParentName"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""ConsentPersonalData"" boolean;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""ConsentCompanyOffers"" boolean;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""PersonId"" text;
            ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""IsArchived"" boolean DEFAULT false;";

        try
        {
            await _db.Database.ExecuteSqlRawAsync(sql);
            return Ok(new { ok = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Sync Faculty and Program from teachers to courses (teachers only)
    /// </summary>
    /// <returns>Sync result with count of updated courses</returns>
    /// <remarks>
    /// Requires teacher role. Syncs Faculty and Program fields from teacher profiles to courses that don't have them.
    ///
    /// Process:
    /// 1. Finds courses missing Faculty or Program
    /// 2. Looks up teachers assigned to those courses via timetable entries
    /// 3. Copies Faculty and Program from teacher profiles to courses
    ///
    /// Only updates courses that are missing these fields. Does not overwrite existing values.
    /// Returns count of updated courses.
    /// </remarks>
    [HttpPost("api/db/sync-courses-faculty-program")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> SyncCoursesFacultyProgram()
    {
        try
        {
            // Get all courses that need Faculty/Program
            var coursesNeedingUpdate = await _db.Courses
                .Where(c => string.IsNullOrWhiteSpace(c.Faculty) || string.IsNullOrWhiteSpace(c.Program))
                .ToListAsync();

            if (!coursesNeedingUpdate.Any())
            {
                return Ok(new { updated = 0, total = 0, message = "All courses already have Faculty and Program" });
            }

            // Get timetable entries grouped by course code
            var timetableEntries = await _db.Timetable.AsNoTracking()
                .Where(t => !string.IsNullOrWhiteSpace(t.CourseCode) &&
                            !string.IsNullOrWhiteSpace(t.TeacherEmail))
                .GroupBy(t => t.CourseCode)
                .Select(g => new
                {
                    CourseCode = g.Key,
                    TeacherEmail = g.First().TeacherEmail
                })
                .ToListAsync();

            // Get teachers by email
            var teachersByEmail = await _db.Faculty.AsNoTracking()
                .Where(f =>
                    !string.IsNullOrWhiteSpace(f.Email) &&
                    (!string.IsNullOrWhiteSpace(f.Faculty) ||
                     !string.IsNullOrWhiteSpace(f.Program)))
                .ToDictionaryAsync(
                    f => f.Email.ToLowerInvariant(),
                    f => f
                );

            int updatedCount = 0;

            foreach (var course in coursesNeedingUpdate)
            {
                var timetableEntry = timetableEntries.FirstOrDefault(t =>
                    string.Equals(t.CourseCode, course.Code, StringComparison.OrdinalIgnoreCase));

                if (timetableEntry != null &&
                    !string.IsNullOrWhiteSpace(timetableEntry.TeacherEmail) &&
                    teachersByEmail.TryGetValue(timetableEntry.TeacherEmail.ToLowerInvariant(), out var teacher))
                {
                    bool updated = false;

                    if (string.IsNullOrWhiteSpace(course.Faculty) &&
                        !string.IsNullOrWhiteSpace(teacher.Faculty))
                    {
                        course.Faculty = teacher.Faculty;
                        updated = true;
                    }

                    if (string.IsNullOrWhiteSpace(course.Program) &&
                        !string.IsNullOrWhiteSpace(teacher.Program))
                    {
                        course.Program = teacher.Program;
                        updated = true;
                    }

                    if (updated)
                    {
                        updatedCount++;
                    }
                }
            }

            if (updatedCount > 0)
            {
                await _db.SaveChangesAsync();
            }

            return Ok(new
            {
                updated = updatedCount,
                total = coursesNeedingUpdate.Count,
                message = $"Sync completed. Updated {updatedCount} courses."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Fix TypeSk values
    /// </summary>
    [HttpPost("api/db/fix-course-types")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> FixCourseTypes()
    {
        try
        {
            var courses = await _db.Courses.ToListAsync();
            int fixedCount = 0;

            var profileValues = new[] { "PV", "PP", "PVP", "PV/PVP" };

            foreach (var course in courses)
            {
                if (string.IsNullOrWhiteSpace(course.TypeSk))
                {
                    course.TypeSk = "P+CL";
                    fixedCount++;
                    continue;
                }

                var typeSk = course.TypeSk.Trim();

                if (profileValues.Contains(typeSk, StringComparer.OrdinalIgnoreCase))
                {
                    course.TypeSk = "P+CL";
                    fixedCount++;
                }
                else if (typeSk.Equals("S", StringComparison.OrdinalIgnoreCase))
                {
                    // keep "S" as is
                }
                else
                {
                    var upper = typeSk.ToUpperInvariant();

                    if (upper.Contains('P') || upper.Contains("CL") || upper.Contains('L'))
                    {
                        if (!typeSk.Equals("P+CL", StringComparison.Ordinal))
                        {
                            course.TypeSk = "P+CL";
                            fixedCount++;
                        }
                    }
                }
            }

            if (fixedCount > 0)
            {
                await _db.SaveChangesAsync();
            }

            return Ok(new
            {
                fixedCount,
                total = courses.Count,
                message = $"Fixed {fixedCount} courses. TypeSk should now be either 'P+CL' or 'S'."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}