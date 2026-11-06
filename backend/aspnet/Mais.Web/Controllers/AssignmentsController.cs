using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Services;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api")]
[Authorize(Roles = "teacher")]
public class AssignmentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDataUpdateService _dataUpdates;
    public AssignmentsController(AppDbContext db, IDataUpdateService dataUpdates)
    {
        _db = db;
        _dataUpdates = dataUpdates;
    }

    private string RequesterEmail() => User.FindFirstValue(ClaimTypes.Email)?.ToLowerInvariant() ?? string.Empty;
    private bool IsOwner(string email) => string.Equals(RequesterEmail(), (email ?? string.Empty).ToLowerInvariant(), StringComparison.OrdinalIgnoreCase);

    private static string MaisId(string ns, string raw)
    {
        // simple deterministic id
        unchecked
        {
            uint h = 2166136261;
            foreach (var ch in (raw ?? string.Empty)) { h ^= ch; h *= 16777619; }
            var base36 = ToBase36((int)(h & 0x7FFFFFFF));
            var chk = Math.Abs(((int)h ^ 1609459200) % 97).ToString().PadLeft(2, '0');
            return $"{ns.ToUpperInvariant()}-{base36}-{chk}";
        }
    }
    private static string ToBase36(int value)
    {
        const string alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (value == 0) return "0";
        var v = Math.Abs(value);
        var chars = new Stack<char>();
        while (v > 0) { chars.Push(alphabet[v % 36]); v /= 36; }
        return new string(chars.ToArray());
    }

    /// <summary>
    /// Get list of assignments for a teacher's course (teachers only)
    /// </summary>
    /// <param name="email">Teacher email address</param>
    /// <param name="code">Course code</param>
    /// <returns>List of assignments ordered by due date and name</returns>
    /// <remarks>
    /// Requires teacher role. Returns all assignments for a specific teacher and course.
    /// Only the owner teacher (matching authenticated user) can access their assignments.
    /// Assignments are ordered by due date (ascending) and then by name (ascending).
    /// </remarks>
    [HttpGet("teachers/{email}/courses/{code}/assignments")]
    [ProducesResponseType(typeof(List<AssignmentEntity>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListAssignments(string email, string code)
    {
        if (!IsOwner(email))
        {
            return Forbid();
        }
        email = (email ?? string.Empty).ToLowerInvariant();
        code = (code ?? string.Empty).Trim();
        var items = await _db.Assignments.AsNoTracking()
            .Where(a => a.TeacherEmail.ToLower() == email && a.CourseCode == code)
            .OrderBy(a => a.DueDate).ThenBy(a => a.Name)
            .ToListAsync();
        return Ok(items);
    }

    public class BulkSaveAssignmentsRequest
    {
        public string ClassId { get; set; } = string.Empty;
        public string CourseCode { get; set; } = string.Empty;
        public string TeacherEmail { get; set; } = string.Empty;
        public List<AssignmentEntity> Assignments { get; set; } = new();
    }

    /// <summary>
    /// Bulk save assignments for a teacher's course (teachers only)
    /// </summary>
    /// <param name="email">Teacher email address</param>
    /// <param name="code">Course code</param>
    /// <param name="body">Bulk save request with assignments list</param>
    /// <param name="sync">If true, deletes assignments not in the request list (default: false)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Updated list of assignments</returns>
    /// <remarks>
    /// Requires teacher role. Performs bulk create/update/delete of assignments.
    /// 
    /// Behavior:
    /// - Creates new assignments if ID doesn't exist
    /// - Updates existing assignments if ID matches
    /// - If sync=true, deletes assignments not present in the request (and their grades)
    /// 
    /// Assignment IDs are auto-generated if not provided using deterministic algorithm.
    /// Only the owner teacher (matching authenticated user) can modify their assignments.
    /// 
    /// Notifies about assignment updates after save.
    /// </remarks>
    [HttpPut("teachers/{email}/courses/{code}/assignments")]
    [ProducesResponseType(typeof(List<AssignmentEntity>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> BulkSaveAssignments(string email, string code, [FromBody] BulkSaveAssignmentsRequest body, [FromQuery] bool sync = false, CancellationToken ct = default)
    {
        if (!IsOwner(email))
        {
            return Forbid();
        }
        email = (email ?? string.Empty).ToLowerInvariant();
        code = (code ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code) || body == null) return BadRequest(new { error = "Missing parameters" });
        var now = DateTime.UtcNow;

        var existing = await _db.Assignments.Where(a => a.TeacherEmail.ToLower() == email && a.CourseCode == code).ToListAsync();
        var byId = existing.ToDictionary(a => a.Id, a => a);
        var incomingIds = new HashSet<string>();

        foreach (var a in body.Assignments ?? new List<AssignmentEntity>())
        {
            var id = string.IsNullOrWhiteSpace(a.Id) ? MaisId("asg", $"{email}|{code}|{a.Name}|{a.DueDate}") : a.Id;
            incomingIds.Add(id);
            if (byId.TryGetValue(id, out var ex))
            {
                var wasUpdated = ex.Name != (a.Name ?? ex.Name) ||
                                 ex.Category != (string.Equals(a.Category, "exam", StringComparison.OrdinalIgnoreCase) ? "exam" : "continuous") ||
                                 ex.TotalPoints != a.TotalPoints ||
                                 ex.DueDate != (a.DueDate ?? ex.DueDate) ||
                                 ex.Description != a.Description ||
                                 (!string.IsNullOrWhiteSpace(body.ClassId) && ex.ClassId != body.ClassId);

                ex.Name = a.Name ?? ex.Name;
                ex.Category = string.Equals(a.Category, "exam", StringComparison.OrdinalIgnoreCase) ? "exam" : "continuous";
                ex.TotalPoints = a.TotalPoints;
                ex.DueDate = a.DueDate ?? ex.DueDate;
                ex.Description = a.Description;
                ex.UpdatedAt = now;
                if (!string.IsNullOrWhiteSpace(body.ClassId)) ex.ClassId = body.ClassId;

                // Create activity for assignment update if it was actually changed
                if (wasUpdated)
                {
                    await CreateActivityForAssignmentUpdateAsync(ex, email, ct);
                }
            }
            else
            {
                var rec = new AssignmentEntity
                {
                    Id = id,
                    ClassId = body.ClassId,
                    CourseCode = code,
                    TeacherEmail = email,
                    Name = a.Name ?? string.Empty,
                    Category = string.Equals(a.Category, "exam", StringComparison.OrdinalIgnoreCase) ? "exam" : "continuous",
                    TotalPoints = a.TotalPoints,
                    DueDate = a.DueDate ?? string.Empty,
                    Description = a.Description,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                _db.Assignments.Add(rec);

                // Create activity for new assignment
                await CreateActivityForAssignmentCreationAsync(rec, email, ct);
            }
        }

        await _db.SaveChangesAsync();

        if (sync && !string.IsNullOrWhiteSpace(body.ClassId))
        {
            var toDelete = await _db.Assignments
                .Where(a => a.TeacherEmail.ToLower() == email && a.CourseCode == code && a.ClassId == body.ClassId && !incomingIds.Contains(a.Id))
                .Select(a => a.Id)
                .ToListAsync();
            if (toDelete.Count > 0)
            {
                var gradesToDelete = _db.AssignmentGrades.Where(g => toDelete.Contains(g.AssignmentId));
                _db.AssignmentGrades.RemoveRange(gradesToDelete);
                var assignmentsToDelete = _db.Assignments.Where(a => toDelete.Contains(a.Id)).ToList();

                // Create activities for deleted assignments
                foreach (var assignment in assignmentsToDelete)
                {
                    await CreateActivityForAssignmentDeletionAsync(assignment, email, ct);
                }

                _db.Assignments.RemoveRange(assignmentsToDelete);
                await _db.SaveChangesAsync();
            }
        }

        // Notify about assignment updates
        await _dataUpdates.NotifyAssignmentUpdated(code, email);

        var items = await _db.Assignments.AsNoTracking()
            .Where(a => a.TeacherEmail.ToLower() == email && a.CourseCode == code)
            .OrderBy(a => a.DueDate).ThenBy(a => a.Name)
            .ToListAsync();
        return Ok(items);
    }

    public class GradeEntry { public string StudentId { get; set; } = string.Empty; public string AssignmentId { get; set; } = string.Empty; public int Points { get; set; } }
    public class BulkSaveGradesRequest { public List<GradeEntry> Entries { get; set; } = new(); }

    private async Task<(int contMax, int finMax)> GetSchemeAsync(string courseCode)
    {
        var s = await _db.CourseGradingSchemes.AsNoTracking().FirstOrDefaultAsync(x => x.CourseCode == courseCode);
        return s != null ? (Math.Max(1, s.MaxContinuousPoints), Math.Max(1, s.MaxFinalPoints)) : (40, 60);
    }
    /// <summary>
    /// Bulk save assignment grades for a teacher's course (teachers only)
    /// </summary>
    /// <param name="email">Teacher email address</param>
    /// <param name="code">Course code</param>
    /// <param name="body">Bulk save request with grade entries (studentId, assignmentId, points)</param>
    /// <returns>Updated course grades (final grades) for students</returns>
    /// <remarks>
    /// Requires teacher role. Performs bulk save of assignment grades and automatically updates course final grades.
    /// 
    /// Behavior:
    /// - Saves assignment grades (points) for each student-assignment pair
    /// - Automatically calculates and updates course final grades (ZS type)
    /// - Uses grading scheme (MaxContinuousPoints, MaxFinalPoints) from course
    /// - Separates continuous and exam assignment points
    /// - Calculates letter grades (A-F) based on total percentage
    /// 
    /// Only the owner teacher (matching authenticated user) can modify grades.
    /// </remarks>
    [HttpPut("teachers/{email}/courses/{code}/assignment-grades")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> BulkSaveGrades(string email, string code, [FromBody] BulkSaveGradesRequest body)
    {
        if (!IsOwner(email))
        {
            return Forbid();
        }
        email = (email ?? string.Empty).ToLowerInvariant();
        code = (code ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code) || body == null) return BadRequest(new { error = "Missing parameters" });
        var now = DateTime.UtcNow;

        // Upsert assignment grades
        var ids = body.Entries.Select(e => e.AssignmentId).Distinct().ToList();
        var knownAssignments = await _db.Assignments.AsNoTracking().Where(a => ids.Contains(a.Id) && a.CourseCode == code && a.TeacherEmail.ToLower() == email).ToDictionaryAsync(a => a.Id, a => a);
        var byKey = await _db.AssignmentGrades.Where(g => ids.Contains(g.AssignmentId)).ToDictionaryAsync(g => (g.StudentId + "|" + g.AssignmentId));
        foreach (var e in body.Entries)
        {
            if (!knownAssignments.ContainsKey(e.AssignmentId)) continue; // ignore invalid
            var k = e.StudentId + "|" + e.AssignmentId;
            if (byKey.TryGetValue(k, out var ex))
            {
                ex.Points = Math.Max(0, e.Points);
                ex.LastUpdated = now;
            }
            else
            {
                var rec = new StudentAssignmentGradeEntity { Id = MaisId("ag", k), StudentId = e.StudentId, AssignmentId = e.AssignmentId, Points = Math.Max(0, e.Points), LastUpdated = now };
                _db.AssignmentGrades.Add(rec);
                byKey[k] = rec;
            }
        }
        await _db.SaveChangesAsync();
        // Recompute final grades by student for this course
        var assignmentIds = await _db.Assignments.AsNoTracking().Where(a => a.CourseCode == code && a.TeacherEmail.ToLower() == email).Select(a => a.Id).ToListAsync();
        var grades = await _db.AssignmentGrades.AsNoTracking().Where(g => assignmentIds.Contains(g.AssignmentId)).ToListAsync();
        var assignments = await _db.Assignments.AsNoTracking().Where(a => assignmentIds.Contains(a.Id)).ToDictionaryAsync(a => a.Id, a => a);
        var (contMax, finMax) = await GetSchemeAsync(code);
        var totalMax = Math.Max(1, contMax + finMax);

        var byStudent = grades.GroupBy(g => g.StudentId);
        var updatedFinals = new List<StudentCourseGradeEntity>();
        foreach (var g in byStudent)
        {
            int contPts = 0, finPts = 0;
            foreach (var row in g)
            {
                if (!assignments.TryGetValue(row.AssignmentId, out var asg)) continue;
                if (string.Equals(asg.Category, "exam", StringComparison.OrdinalIgnoreCase)) finPts += row.Points;
                else contPts += row.Points;
            }
            contPts = Math.Max(0, Math.Min(contMax, contPts));
            finPts = Math.Max(0, Math.Min(finMax, finPts));
            var totalPct = (int)Math.Round((contPts + finPts) * 100.0 / totalMax);
            var letter = totalPct >= 90 ? "A" : totalPct >= 80 ? "B" : totalPct >= 70 ? "C" : totalPct >= 60 ? "D" : totalPct >= 50 ? "E" : "F";

            var existing = await _db.CourseGrades.FirstOrDefaultAsync(x => x.StudentId == g.Key && x.CourseCode == code);
            if (existing == null)
            {
                existing = new StudentCourseGradeEntity
                {
                    Id = MaisId("cg", g.Key + "|" + code),
                    StudentId = g.Key,
                    CourseCode = code,
                    TeacherEmail = email,
                    AssessmentType = "ZS",
                    ContinuousPercent = (int)Math.Round(contPts * 100.0 / contMax),
                    FinalPercent = (int)Math.Round(finPts * 100.0 / finMax),
                    TotalPercent = totalPct,
                    LetterGrade = letter,
                    AwardedAt = now
                };
                _db.CourseGrades.Add(existing);
            }
            else
            {
                existing.TeacherEmail = email;
                existing.AssessmentType = "ZS";
                existing.ContinuousPercent = (int)Math.Round(contPts * 100.0 / contMax);
                existing.FinalPercent = (int)Math.Round(finPts * 100.0 / finMax);
                existing.TotalPercent = totalPct;
                existing.LetterGrade = letter;
                existing.AwardedAt = now;
            }
            updatedFinals.Add(existing);
        }
        await _db.SaveChangesAsync();

        // Notify about grade updates
        foreach (var final in updatedFinals)
        {
            await _dataUpdates.NotifyGradeUpdated(final.StudentId, code, email);
        }

        return Ok(updatedFinals);
    }

    /// <summary>
    /// Delete an assignment (teachers only)
    /// </summary>
    /// <param name="email">Teacher email address</param>
    /// <param name="code">Course code</param>
    /// <param name="id">Assignment identifier</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Requires teacher role. Deletes an assignment and all associated grades.
    /// Only the owner teacher (matching authenticated user) can delete their assignments.
    /// Notifies about assignment updates after deletion.
    /// </remarks>
    [HttpDelete("teachers/{email}/courses/{code}/assignments/{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAssignment(string email, string code, string id, CancellationToken ct = default)
    {
        email = (email ?? string.Empty).ToLowerInvariant();
        code = (code ?? string.Empty).Trim();
        id = id ?? string.Empty;
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(id)) return BadRequest(new { error = "Missing parameters" });

        var asg = await _db.Assignments.FirstOrDefaultAsync(a => a.Id == id && a.CourseCode == code && a.TeacherEmail.ToLower() == email);
        if (asg == null) return NotFound();

        // Create activity for assignment deletion
        await CreateActivityForAssignmentDeletionAsync(asg, email, ct);

        var grades = _db.AssignmentGrades.Where(g => g.AssignmentId == id);
        _db.AssignmentGrades.RemoveRange(grades);
        _db.Assignments.Remove(asg);
        await _db.SaveChangesAsync();

        // Notify about assignment deletion
        await _dataUpdates.NotifyAssignmentUpdated(code, email);

        return NoContent();
    }

    private async Task CreateActivityForAssignmentCreationAsync(AssignmentEntity assignment, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            // Get enrolled students for this course
            var enrollmentStudentIds = await _db.Enrollments
                .Where(e => e.CourseCode == assignment.CourseCode && e.Status == "Confirmed")
                .Select(e => e.StudentId)
                .Distinct()
                .ToListAsync(ct);

            var enrolledStudents = await _db.Students
                .AsNoTracking()
                .Where(s => enrollmentStudentIds.Contains(s.Id) || (!string.IsNullOrWhiteSpace(s.PersonId) && enrollmentStudentIds.Contains(s.PersonId)))
                .Select(s => new { StudentEmail = s.Email ?? "", StudentId = s.Id })
                .ToListAsync(ct);

            // Get teacher name
            var teacher = await _db.Faculty
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var meta = new Dictionary<string, object>
            {
                ["assignmentId"] = assignment.Id,
                ["courseCode"] = assignment.CourseCode,
                ["category"] = assignment.Category,
                ["totalPoints"] = assignment.TotalPoints,
                ["dueDate"] = assignment.DueDate ?? ""
            };

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "submissions",
                Title = $"Created assignment: {assignment.Name}",
                Description = $"Assignment for {assignment.CourseCode} • {assignment.TotalPoints} points • Due: {assignment.DueDate ?? "No due date"}",
                Subject = assignment.CourseCode,
                ClassId = assignment.ClassId,
                CourseCode = assignment.CourseCode,
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                AssignmentId = assignment.Id,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            // Create activities for enrolled students
            foreach (var student in enrolledStudents)
            {
                if (string.IsNullOrWhiteSpace(student.StudentEmail)) continue;

                var studentEntity = await _db.Students
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == student.StudentEmail.ToLower() || s.Id == student.StudentId, ct);
                var studentName = studentEntity?.FullName ?? student.StudentEmail;

                var studentActivity = new ActivityEntity
                {
                    Id = $"{activityId}_s_{student.StudentEmail.GetHashCode()}",
                    Type = "submissions",
                    Title = $"New assignment: {assignment.Name}",
                    Description = $"Assignment for {assignment.CourseCode} • {assignment.TotalPoints} points • Due: {assignment.DueDate ?? "No due date"}",
                    Subject = assignment.CourseCode,
                    ClassId = assignment.ClassId,
                    CourseCode = assignment.CourseCode,
                    TeacherEmail = teacherEmail,
                    TeacherDisplay = teacherName,
                    StudentEmail = student.StudentEmail,
                    StudentName = studentName,
                    AssignmentId = assignment.Id,
                    Timestamp = now.ToString("o"),
                    RequiresAction = true,
                    Priority = "high",
                    MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                    CreatedByEmail = teacherEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(studentActivity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception)
        {
            // Log but don't fail the request
            // Could inject ILogger if needed
        }
    }

    private async Task CreateActivityForAssignmentDeletionAsync(AssignmentEntity assignment, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            // Get enrolled students for this course
            var enrollmentStudentIds = await _db.Enrollments
                .Where(e => e.CourseCode == assignment.CourseCode && e.Status == "Confirmed")
                .Select(e => e.StudentId)
                .Distinct()
                .ToListAsync(ct);

            var enrolledStudents = await _db.Students
                .AsNoTracking()
                .Where(s => enrollmentStudentIds.Contains(s.Id) || (!string.IsNullOrWhiteSpace(s.PersonId) && enrollmentStudentIds.Contains(s.PersonId)))
                .Select(s => new { StudentEmail = s.Email ?? "", StudentId = s.Id })
                .ToListAsync(ct);

            // Get teacher name
            var teacher = await _db.Faculty
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var meta = new Dictionary<string, object>
            {
                ["assignmentId"] = assignment.Id,
                ["courseCode"] = assignment.CourseCode,
                ["assignmentName"] = assignment.Name
            };

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "submissions",
                Title = $"Deleted assignment: {assignment.Name}",
                Description = $"Assignment for {assignment.CourseCode} was deleted",
                Subject = assignment.CourseCode,
                ClassId = assignment.ClassId,
                CourseCode = assignment.CourseCode,
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                AssignmentId = assignment.Id,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            // Create activities for enrolled students
            foreach (var student in enrolledStudents)
            {
                if (string.IsNullOrWhiteSpace(student.StudentEmail)) continue;

                var studentEntity = await _db.Students
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == student.StudentEmail.ToLower() || s.Id == student.StudentId, ct);
                var studentName = studentEntity?.FullName ?? student.StudentEmail;

                var studentActivity = new ActivityEntity
                {
                    Id = $"{activityId}_s_{student.StudentEmail.GetHashCode()}",
                    Type = "submissions",
                    Title = $"Assignment deleted: {assignment.Name}",
                    Description = $"Assignment for {assignment.CourseCode} was deleted by {teacherName}",
                    Subject = assignment.CourseCode,
                    ClassId = assignment.ClassId,
                    CourseCode = assignment.CourseCode,
                    TeacherEmail = teacherEmail,
                    TeacherDisplay = teacherName,
                    StudentEmail = student.StudentEmail,
                    StudentName = studentName,
                    AssignmentId = assignment.Id,
                    Timestamp = now.ToString("o"),
                    RequiresAction = false,
                    Priority = "low",
                    MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                    CreatedByEmail = teacherEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(studentActivity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception)
        {
            // Log but don't fail the request
            // Could inject ILogger if needed
        }
    }

    private async Task CreateActivityForAssignmentUpdateAsync(AssignmentEntity assignment, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            // Get enrolled students for this course
            var enrolledStudents = await _db.Enrollments
                .AsNoTracking()
                .Where(e => e.CourseCode == assignment.CourseCode && e.Status == "Confirmed")
                .Select(e => e.StudentId)
                .Distinct()
                .ToListAsync(ct);

            var students = await _db.Students
                .AsNoTracking()
                .Where(s => enrolledStudents.Contains(s.Id) || (!string.IsNullOrWhiteSpace(s.PersonId) && enrolledStudents.Contains(s.PersonId)))
                .ToListAsync(ct);

            var meta = new Dictionary<string, object>
            {
                ["assignmentId"] = assignment.Id,
                ["courseCode"] = assignment.CourseCode ?? "",
                ["name"] = assignment.Name ?? "",
                ["category"] = assignment.Category ?? "",
                ["totalPoints"] = assignment.TotalPoints,
                ["dueDate"] = assignment.DueDate ?? ""
            };

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Updated assignment: {assignment.Name}",
                Description = $"Course: {assignment.CourseCode} • Category: {assignment.Category} • Points: {assignment.TotalPoints} • Due: {assignment.DueDate}",
                Subject = assignment.CourseCode ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            // Create activities for enrolled students
            foreach (var student in students)
            {
                var studentEmail = student.Email;
                if (string.IsNullOrWhiteSpace(studentEmail)) continue;

                var studentActivity = new ActivityEntity
                {
                    Id = $"{activityId}_student_{student.Id}",
                    Type = "announcements",
                    Title = $"Assignment updated: {assignment.Name}",
                    Description = $"Course: {assignment.CourseCode} • Category: {assignment.Category} • Points: {assignment.TotalPoints} • Due: {assignment.DueDate}",
                    Subject = assignment.CourseCode ?? "",
                    TeacherEmail = teacherEmail,
                    TeacherDisplay = teacherName,
                    StudentEmail = studentEmail,
                    StudentName = student.FullName,
                    Timestamp = now.ToString("o"),
                    RequiresAction = true,
                    Priority = "high",
                    MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                    CreatedByEmail = teacherEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(studentActivity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }
}
