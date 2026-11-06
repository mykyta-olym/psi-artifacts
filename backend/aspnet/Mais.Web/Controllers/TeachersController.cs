using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Models;
using Mais.Web.Entities;
using Mais.Web.Services;

using Microsoft.AspNetCore.Authorization;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/teachers")]
[Authorize]
public class TeachersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDataUpdateService _dataUpdates;
    
    public TeachersController(AppDbContext db, IDataUpdateService dataUpdates) 
    { 
        _db = db;
        _dataUpdates = dataUpdates;
    }

    /// <summary>
    /// Get list of courses taught by a teacher
    /// </summary>
    /// <param name="email">Teacher email address</param>
    /// <returns>List of courses taught by the teacher</returns>
    /// <remarks>
    /// Returns all courses that a teacher teaches based on their timetable entries.
    /// Courses are extracted from schedule events where the teacher is assigned.
    /// Returns empty list if teacher not found or has no courses.
    /// </remarks>
    [HttpGet("{email}/courses")]
    [ProducesResponseType(typeof(List<CourseModel>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListTeacherCourses(string email)
    {
        email = (email ?? string.Empty).ToLowerInvariant();
        
        // Get courses from timetable
        var timetableEntries = await _db.Timetable.AsNoTracking()
            .Where(t => t.TeacherEmail.ToLower() == email)
            .ToListAsync();

        var timetableCodes = timetableEntries.Select(e => e.CourseCode).Distinct().ToList();
        
        // Get courses from faculty subjects
        var faculty = await _db.Faculty.AsNoTracking()
            .FirstOrDefaultAsync(f => f.Email.ToLower() == email);
        
        var subjectCodes = new List<string>();
        if (faculty != null && !string.IsNullOrEmpty(faculty.SubjectsJson))
        {
            try
            {
                subjectCodes = System.Text.Json.JsonSerializer.Deserialize<List<string>>(faculty.SubjectsJson) ?? new List<string>();
            }
            catch
            {
                // If JSON parsing fails, continue with empty list
            }
        }
        
        // Combine both sources
        var allCodes = timetableCodes.Union(subjectCodes).Distinct().ToList();
        
        if (allCodes.Count == 0) return Ok(new List<CourseModel>());

        var courses = await _db.Courses.AsNoTracking()
            .Where(c => allCodes.Contains(c.Code))
            .Select(c => new CourseModel
            {
                Id = c.Code,
                Code = c.Code,
                NameSk = c.NameSk,
                NameEn = c.NameEn,
                CompletionSk = c.CompletionSk,
                Credits = c.Credits,
                TypeSk = c.TypeSk,
                Profile = c.Profile,
                HoursSk = c.HoursSk,
                Faculty = c.Faculty,
                Program = c.Program,
                PeriodSk = c.PeriodSk
            })
            .ToListAsync();

        return Ok(courses);
    }

    /// <summary>
    /// Get course roster (list of enrolled students) for a teacher's course
    /// </summary>
    /// <param name="email">Teacher email address</param>
    /// <param name="code">Course code</param>
    /// <returns>Course roster with schedule entries and enrolled students</returns>
    /// <remarks>
    /// Returns the roster (list of enrolled students) for a specific course taught by a teacher.
    /// 
    /// Includes:
    /// - Schedule entries (timetable events) for the course
    /// - List of enrolled students with their details (name, email, PersonId, group keys)
    /// 
    /// Students are deduplicated by StudentId. Supports both Id and PersonId for student lookup.
    /// Each roster item includes the schedule event ID and optional group key from the schedule event.
    /// </remarks>
    [HttpGet("{email}/courses/{code}/roster")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetCourseRoster(string email, string code)
    {
        email = (email ?? string.Empty).ToLowerInvariant();
        code = (code ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(code)) return BadRequest(new { error = "Missing course code" });

        // Find teacher's timetable entries for this course
        var classEntries = await _db.Timetable.AsNoTracking()
            .Where(t => t.TeacherEmail.ToLower() == email && t.CourseCode == code)
            .ToListAsync();

        if (classEntries.Count == 0)
        {
            return Ok(new { entries = new List<object>(), roster = new List<RosterItemModel>() });
        }

        var eventIds = classEntries.Select(e => e.Id).ToList();

        // Map ScheduleEventId -> GroupKey (if any)
        var groupMap = new Dictionary<string, string?>();
        foreach (var e in classEntries)
        {
            string? gk = null;
            if (!string.IsNullOrWhiteSpace(e.ClassGroupKeysJson))
            {
                try
                {
                    var arr = System.Text.Json.JsonSerializer.Deserialize<List<string>>(e.ClassGroupKeysJson);
                    gk = arr != null && arr.Count > 0 ? arr[0] : null; // first key if present
                }
                catch { gk = null; }
            }
            groupMap[e.Id] = gk;
        }

        // Load enrollments for these events
        var enrollments = await _db.Enrollments.AsNoTracking()
            .Where(en => en.CourseCode == code && en.ScheduleEventId != null && eventIds.Contains(en.ScheduleEventId))
            .ToListAsync();

        // Deduplicate enrollments: one student can have multiple enrollments for the same schedule event
        // Group by ScheduleEventId and StudentId, then take the first one
        var uniqueEnrollments = enrollments
            .GroupBy(en => new { en.ScheduleEventId, en.StudentId })
            .Select(g => g.First())
            .ToList();

        var studentIds = uniqueEnrollments.Select(en => en.StudentId).Distinct().ToList();
        // Find students by both Id and PersonId (enrollments may use PersonId)
        var students = await _db.Students.AsNoTracking()
            .Where(s => studentIds.Contains(s.Id) || (!string.IsNullOrWhiteSpace(s.PersonId) && studentIds.Contains(s.PersonId)))
            .ToListAsync();

        // Create a map that can look up by both Id and PersonId
        var studentMap = new Dictionary<string, StudentEntity>();
        foreach (var s in students)
        {
            if (!string.IsNullOrWhiteSpace(s.Id) && studentIds.Contains(s.Id))
            {
                studentMap[s.Id] = s;
            }
            if (!string.IsNullOrWhiteSpace(s.PersonId) && studentIds.Contains(s.PersonId))
            {
                studentMap[s.PersonId] = s;
            }
        }

        var roster = new List<RosterItemModel>();
        // Deduplicate roster by StudentId to avoid duplicates
        var seenStudentIds = new HashSet<string>();
        foreach (var en in uniqueEnrollments)
        {
            // Skip if we've already added this student to the roster
            if (seenStudentIds.Contains(en.StudentId)) continue;
            seenStudentIds.Add(en.StudentId);

            // Try to find student by StudentId (which may be PersonId or Id)
            if (!studentMap.TryGetValue(en.StudentId, out var s))
            {
                // If not found, try to find by PersonId or Id in the students list
                s = students.FirstOrDefault(st =>
                    (!string.IsNullOrWhiteSpace(st.PersonId) && st.PersonId == en.StudentId) ||
                    st.Id == en.StudentId);
            }

            roster.Add(new RosterItemModel
            {
                StudentId = en.StudentId,
                PersonId = s?.PersonId ?? string.Empty, // Include PersonId to handle students with multiple records
                StudentEmail = s?.Email ?? string.Empty,
                StudentName = !string.IsNullOrWhiteSpace(s?.FullName) ? s.FullName : (s?.GivenName != null && s?.FamilyName != null ? $"{s.GivenName} {s.FamilyName}" : en.StudentId),
                CourseCode = code,
                ScheduleEventId = en.ScheduleEventId,
                GroupKey = (en.ScheduleEventId != null && groupMap.ContainsKey(en.ScheduleEventId)) ? groupMap[en.ScheduleEventId] : null
            });
        }

        // Also return a compact entries list to let UI show groups/schedule
        var entriesDto = classEntries.Select(e => new
        {
            id = e.Id,
            courseCode = e.CourseCode,
            day = e.Day,
            slot = e.Slot,
            room = e.Room,
            type = e.Type,
            groupKeys = e.ClassGroupKeysJson
        });

        return Ok(new { entries = entriesDto, roster });
    }
}
