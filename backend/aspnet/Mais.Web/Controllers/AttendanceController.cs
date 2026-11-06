using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Hubs;
using Mais.Web.Services;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AttendanceController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<AttendanceHub> _hub;
    private readonly IDataUpdateService _dataUpdates;

    public AttendanceController(AppDbContext db, IHubContext<AttendanceHub> hub, IDataUpdateService dataUpdates)
    {
        _db = db;
        _hub = hub;
        _dataUpdates = dataUpdates;
    }

    private string? CurrentEmail => User.FindFirstValue(ClaimTypes.Email);
    private string? CurrentRole => User.FindFirstValue(ClaimTypes.Role);

    /// <summary>
    /// Get attendance records for a course
    /// </summary>
    [HttpGet("course/{courseCode}")]
    public async Task<IActionResult> GetByCourse(
        string courseCode,
        [FromQuery] string? date = null,
        [FromQuery] string? studentId = null,
        CancellationToken ct = default)
    {
        var query = _db.Attendance
            .AsNoTracking()
            .Where(a => a.CourseCode == courseCode);

        if (!string.IsNullOrWhiteSpace(date) && DateOnly.TryParse(date, out var dateOnly))
        {
            query = query.Where(a => a.SessionDate == dateOnly);
        }

        if (!string.IsNullOrWhiteSpace(studentId))
        {
            query = query.Where(a => a.StudentId == studentId);
        }

        var records = await query
            .OrderByDescending(a => a.SessionDate)
            .ThenBy(a => a.TimeSlot)
            .ToListAsync(ct);

        return Ok(records);
    }

    /// <summary>
    /// Get attendance records for a student
    /// </summary>
    [HttpGet("student/{studentId}")]
    public async Task<IActionResult> GetByStudent(
        string studentId,
        [FromQuery] string? courseCode = null,
        CancellationToken ct = default)
    {
        var query = _db.Attendance
            .AsNoTracking()
            .Where(a => a.StudentId == studentId);

        if (!string.IsNullOrWhiteSpace(courseCode))
        {
            query = query.Where(a => a.CourseCode == courseCode);
        }

        var records = await query
            .OrderByDescending(a => a.SessionDate)
            .ThenBy(a => a.TimeSlot)
            .ToListAsync(ct);

        return Ok(records);
    }

    /// <summary>
    /// Get attendance statistics for a course
    /// </summary>
    [HttpGet("stats/course/{courseCode}")]
    public async Task<IActionResult> GetCourseStats(string courseCode, CancellationToken ct = default)
    {
        var records = await _db.Attendance
            .AsNoTracking()
            .Where(a => a.CourseCode == courseCode)
            .ToListAsync(ct);

        var totalRecords = records.Count;
        var presentCount = records.Count(r => r.Status == "present");
        var lateCount = records.Count(r => r.Status == "late");
        var absentCount = records.Count(r => r.Status == "absent");
        var excusedCount = records.Count(r => r.Status == "excused");

        var attendanceRate = totalRecords > 0
            ? Math.Round((double)(presentCount + lateCount) / totalRecords * 100, 1)
            : 0;

        var byStudent = records
            .GroupBy(r => r.StudentId)
            .Select(g => new
            {
                StudentId = g.Key,
                StudentEmail = g.First().StudentEmail,
                Total = g.Count(),
                Present = g.Count(r => r.Status == "present"),
                Late = g.Count(r => r.Status == "late"),
                Absent = g.Count(r => r.Status == "absent"),
                Excused = g.Count(r => r.Status == "excused"),
                Rate = g.Count() > 0
                    ? Math.Round((double)(g.Count(r => r.Status == "present") + g.Count(r => r.Status == "late")) / g.Count() * 100, 1)
                    : 0
            })
            .OrderBy(s => s.StudentId)
            .ToList();

        var byDate = records
            .GroupBy(r => r.SessionDate)
            .Select(g => new
            {
                Date = g.Key.ToString("yyyy-MM-dd"),
                Total = g.Count(),
                Present = g.Count(r => r.Status == "present"),
                Late = g.Count(r => r.Status == "late"),
                Absent = g.Count(r => r.Status == "absent"),
                Excused = g.Count(r => r.Status == "excused"),
                Rate = g.Count() > 0
                    ? Math.Round((double)(g.Count(r => r.Status == "present") + g.Count(r => r.Status == "late")) / g.Count() * 100, 1)
                    : 0
            })
            .OrderByDescending(d => d.Date)
            .ToList();

        return Ok(new
        {
            courseCode,
            totalRecords,
            presentCount,
            lateCount,
            absentCount,
            excusedCount,
            attendanceRate,
            byStudent,
            byDate
        });
    }

    /// <summary>
    /// Get attendance statistics for a student
    /// </summary>
    [HttpGet("stats/student/{studentId}")]
    public async Task<IActionResult> GetStudentStats(string studentId, CancellationToken ct = default)
    {
        var records = await _db.Attendance
            .AsNoTracking()
            .Where(a => a.StudentId == studentId)
            .ToListAsync(ct);

        var totalRecords = records.Count;
        var presentCount = records.Count(r => r.Status == "present");
        var lateCount = records.Count(r => r.Status == "late");
        var absentCount = records.Count(r => r.Status == "absent");
        var excusedCount = records.Count(r => r.Status == "excused");

        var attendanceRate = totalRecords > 0
            ? Math.Round((double)(presentCount + lateCount) / totalRecords * 100, 1)
            : 0;

        var byCourse = records
            .GroupBy(r => r.CourseCode)
            .Select(g => new
            {
                CourseCode = g.Key,
                Total = g.Count(),
                Present = g.Count(r => r.Status == "present"),
                Late = g.Count(r => r.Status == "late"),
                Absent = g.Count(r => r.Status == "absent"),
                Excused = g.Count(r => r.Status == "excused"),
                Rate = g.Count() > 0
                    ? Math.Round((double)(g.Count(r => r.Status == "present") + g.Count(r => r.Status == "late")) / g.Count() * 100, 1)
                    : 0
            })
            .OrderBy(c => c.CourseCode)
            .ToList();

        return Ok(new
        {
            studentId,
            totalRecords,
            presentCount,
            lateCount,
            absentCount,
            excusedCount,
            attendanceRate,
            byCourse
        });
    }

    /// <summary>
    /// Get attendance summary for teacher's classes
    /// </summary>
    [HttpGet("teacher/{teacherEmail}/summary")]
    public async Task<IActionResult> GetTeacherSummary(string teacherEmail, CancellationToken ct = default)
    {
        var records = await _db.Attendance
            .AsNoTracking()
            .Where(a => a.TeacherEmail.ToLower() == teacherEmail.ToLower())
            .ToListAsync(ct);

        var byCourse = records
            .GroupBy(r => r.CourseCode)
            .Select(g => new
            {
                CourseCode = g.Key,
                TotalSessions = g.Select(r => new { r.SessionDate, r.TimeSlot }).Distinct().Count(),
                TotalRecords = g.Count(),
                PresentCount = g.Count(r => r.Status == "present"),
                LateCount = g.Count(r => r.Status == "late"),
                AbsentCount = g.Count(r => r.Status == "absent"),
                ExcusedCount = g.Count(r => r.Status == "excused"),
                AttendanceRate = g.Count() > 0
                    ? Math.Round((double)(g.Count(r => r.Status == "present") + g.Count(r => r.Status == "late")) / g.Count() * 100, 1)
                    : 0
            })
            .OrderBy(c => c.CourseCode)
            .ToList();

        var overallRate = records.Count > 0
            ? Math.Round((double)(records.Count(r => r.Status == "present") + records.Count(r => r.Status == "late")) / records.Count * 100, 1)
            : 0;

        return Ok(new
        {
            teacherEmail,
            totalRecords = records.Count,
            overallRate,
            byCourse
        });
    }

    public sealed class MarkAttendanceRequest
    {
        public string CourseCode { get; set; } = string.Empty;
        public string StudentId { get; set; } = string.Empty;
        public string? StudentEmail { get; set; }
        public string Date { get; set; } = string.Empty;
        public string? TimeSlot { get; set; }
        public string? Room { get; set; }
        public string Status { get; set; } = "present";
        public string? Notes { get; set; }
        public string? ClassGroupKey { get; set; }
    }

    /// <summary>
    /// Mark attendance for a student
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> MarkAttendance([FromBody] MarkAttendanceRequest request, CancellationToken ct = default)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.CourseCode) ||
            string.IsNullOrWhiteSpace(request.StudentId) ||
            string.IsNullOrWhiteSpace(request.Date))
        {
            return BadRequest(new { error = "CourseCode, StudentId, and Date are required" });
        }

        if (!DateOnly.TryParse(request.Date, out var sessionDate))
        {
            return BadRequest(new { error = "Invalid date format. Use YYYY-MM-DD" });
        }

        var validStatuses = new[] { "present", "absent", "late", "excused" };
        if (!validStatuses.Contains(request.Status.ToLower()))
        {
            return BadRequest(new { error = "Invalid status. Use: present, absent, late, excused" });
        }

        // Check if record already exists
        var existing = await _db.Attendance
            .FirstOrDefaultAsync(a =>
                a.CourseCode == request.CourseCode &&
                a.StudentId == request.StudentId &&
                a.SessionDate == sessionDate &&
                (string.IsNullOrEmpty(request.TimeSlot) || a.TimeSlot == request.TimeSlot),
                ct);

        if (existing != null)
        {
            // Update existing record
            existing.Status = request.Status.ToLower();
            existing.Notes = request.Notes;
            existing.Room = request.Room;
            existing.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            // Notify via SignalR
            await _hub.Clients.Group($"course:{request.CourseCode}").SendAsync("AttendanceUpdated", new
            {
                courseCode = request.CourseCode,
                studentId = request.StudentId,
                date = request.Date,
                status = request.Status.ToLower()
            }, ct);

            return Ok(existing);
        }

        // Create new record
        var record = new AttendanceEntity
        {
            CourseCode = request.CourseCode,
            StudentId = request.StudentId,
            StudentEmail = request.StudentEmail,
            TeacherEmail = email,
            SessionDate = sessionDate,
            TimeSlot = request.TimeSlot,
            Room = request.Room,
            Status = request.Status.ToLower(),
            Notes = request.Notes,
            ClassGroupKey = request.ClassGroupKey,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Attendance.Add(record);
        await _db.SaveChangesAsync(ct);

        // Notify via SignalR
        await _hub.Clients.Group($"course:{request.CourseCode}").SendAsync("AttendanceMarked", new
        {
            courseCode = request.CourseCode,
            studentId = request.StudentId,
            date = request.Date,
            status = request.Status.ToLower()
        }, ct);

        return CreatedAtAction(nameof(GetByCourse), new { courseCode = request.CourseCode }, record);
    }

    public sealed class BulkAttendanceRequest
    {
        public string CourseCode { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string? TimeSlot { get; set; }
        public string? Room { get; set; }
        public string? ClassGroupKey { get; set; }
        public List<StudentAttendanceItem> Students { get; set; } = new();
    }

    public sealed class StudentAttendanceItem
    {
        public string StudentId { get; set; } = string.Empty;
        public string? StudentEmail { get; set; }
        public string Status { get; set; } = "present";
        public string? Notes { get; set; }
    }

    /// <summary>
    /// Bulk mark attendance for multiple students
    /// </summary>
    [HttpPost("bulk")]
    public async Task<IActionResult> BulkMarkAttendance([FromBody] BulkAttendanceRequest request, CancellationToken ct = default)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.CourseCode) ||
            string.IsNullOrWhiteSpace(request.Date) ||
            request.Students.Count == 0)
        {
            return BadRequest(new { error = "CourseCode, Date, and Students are required" });
        }

        if (!DateOnly.TryParse(request.Date, out var sessionDate))
        {
            return BadRequest(new { error = "Invalid date format. Use YYYY-MM-DD" });
        }

        var validStatuses = new[] { "present", "absent", "late", "excused" };
        var created = 0;
        var updated = 0;

        foreach (var student in request.Students)
        {
            if (string.IsNullOrWhiteSpace(student.StudentId)) continue;
            if (!validStatuses.Contains(student.Status.ToLower())) continue;

            var existing = await _db.Attendance
                .FirstOrDefaultAsync(a =>
                    a.CourseCode == request.CourseCode &&
                    a.StudentId == student.StudentId &&
                    a.SessionDate == sessionDate &&
                    (string.IsNullOrEmpty(request.TimeSlot) || a.TimeSlot == request.TimeSlot),
                    ct);

            if (existing != null)
            {
                existing.Status = student.Status.ToLower();
                existing.Notes = student.Notes;
                existing.Room = request.Room;
                existing.UpdatedAt = DateTime.UtcNow;
                updated++;
            }
            else
            {
                _db.Attendance.Add(new AttendanceEntity
                {
                    CourseCode = request.CourseCode,
                    StudentId = student.StudentId,
                    StudentEmail = student.StudentEmail,
                    TeacherEmail = email,
                    SessionDate = sessionDate,
                    TimeSlot = request.TimeSlot,
                    Room = request.Room,
                    Status = student.Status.ToLower(),
                    Notes = student.Notes,
                    ClassGroupKey = request.ClassGroupKey,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
                created++;
            }
        }

        await _db.SaveChangesAsync(ct);

        // Notify via SignalR
        await _hub.Clients.Group($"course:{request.CourseCode}").SendAsync("BulkAttendanceUpdated", new
        {
            courseCode = request.CourseCode,
            date = request.Date,
            created,
            updated
        }, ct);

        return Ok(new { created, updated, total = created + updated });
    }

    /// <summary>
    /// Delete an attendance record
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct = default)
    {
        var record = await _db.Attendance.FindAsync(new object[] { id }, ct);
        if (record == null)
        {
            return NotFound();
        }

        _db.Attendance.Remove(record);
        await _db.SaveChangesAsync(ct);

        // Notify via SignalR
        await _hub.Clients.Group($"course:{record.CourseCode}").SendAsync("AttendanceDeleted", new
        {
            id,
            courseCode = record.CourseCode,
            studentId = record.StudentId,
            date = record.SessionDate.ToString("yyyy-MM-dd")
        }, ct);

        return NoContent();
    }
}
