using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Services;
using Mais.Web.Hubs;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class GradesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDataUpdateService _dataUpdates;
    private readonly IHubContext<GradesHub> _gradesHub;
    private readonly IHubContext<AttendanceHub> _attendanceHub;

    public GradesController(AppDbContext db, IDataUpdateService dataUpdates, IHubContext<GradesHub> gradesHub, IHubContext<AttendanceHub> attendanceHub)
    {
        _db = db;
        _dataUpdates = dataUpdates;
        _gradesHub = gradesHub;
        _attendanceHub = attendanceHub;
    }

    public class UpsertGradePayload
    {
        public string StudentId { get; set; } = string.Empty;
        public string CourseCode { get; set; } = string.Empty;
        public string TeacherEmail { get; set; } = string.Empty;
        public string AssessmentType { get; set; } = "KZ"; // KZ | ZS
        public int? ContinuousPercent { get; set; } // optional, if points provided we'll compute
        public int? FinalPercent { get; set; } // optional
        public int? TotalPercent { get; set; } // for KZ or computed for ZS
        public int? ContinuousPoints { get; set; } // optional new
        public int? FinalPoints { get; set; } // optional new
    }

    private static int Clamp(int v, int lo, int hi) => Math.Max(lo, Math.Min(hi, v));

    private static (int total, string letter) ComputeTotalsByPercent(string assessmentType, int? cont, int? fin, int? totalOpt)
    {
        int total;
        if (string.Equals(assessmentType, "ZS", StringComparison.OrdinalIgnoreCase))
        {
            var c = Clamp(cont ?? 0, 0, 100);
            var f = Clamp(fin ?? 0, 0, 100);
            total = Clamp(c + f, 0, 100);
        }
        else
        {
            total = Clamp(totalOpt ?? 0, 0, 100);
        }
        // Letter scale: A>=90, B>=80, C>=70, D>=60, E>=50, F otherwise
        var letter = total >= 90 ? "A" : total >= 80 ? "B" : total >= 70 ? "C" : total >= 60 ? "D" : total >= 50 ? "E" : "F";
        return (total, letter);
    }

    private async Task<(int contMax, int finMax)> GetSchemeAsync(string courseCode)
    {
        var s = await _db.CourseGradingSchemes.AsNoTracking().FirstOrDefaultAsync(x => x.CourseCode == courseCode);
        if (s == null) return (40, 60); // sensible defaults
        return (Math.Max(1, s.MaxContinuousPoints), Math.Max(1, s.MaxFinalPoints));
    }

    /// <summary>
    /// Create or update a course grade (teachers only)
    /// </summary>
    /// <param name="body">Grade upsert payload with student, course, assessment type, and grade values</param>
    /// <returns>Updated course grade entity</returns>
    /// <remarks>
    /// Requires teacher role. Creates or updates a course grade for a student.
    /// 
    /// Assessment types:
    /// - KZ: Single assessment (uses TotalPercent)
    /// - ZS: Continuous + Final assessment (uses ContinuousPercent + FinalPercent, or computes from points)
    /// 
    /// Grade calculation:
    /// - Can provide percentages directly (ContinuousPercent, FinalPercent, TotalPercent)
    /// - Or provide points (ContinuousPoints, FinalPoints) which are converted to percentages using course grading scheme
    /// - Letter grades: A (greater than or equal to 90%), B (greater than or equal to 80%), C (greater than or equal to 70%), D (greater than or equal to 60%), E (greater than or equal to 50%), F (less than 50%)
    /// 
    /// Exam access gate:
    /// - For ZS type, requires >= half+1 of continuous max points before allowing final points/percent
    /// - Prevents students from taking final exam without sufficient continuous assessment
    /// 
    /// Only the specified teacher (matching authenticated user) can modify grades.
    /// </remarks>
    [HttpPut("grades")]
    [Authorize(Roles = "teacher")]
    [ProducesResponseType(typeof(StudentCourseGradeEntity), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpsertGrade([FromBody] UpsertGradePayload body)
    {
        if (body == null) return BadRequest(new { error = "Missing body" });
        if (string.IsNullOrWhiteSpace(body.StudentId) || string.IsNullOrWhiteSpace(body.CourseCode) || string.IsNullOrWhiteSpace(body.TeacherEmail))
            return BadRequest(new { error = "Missing required fields" });

        var requesterEmail = User.FindFirstValue(ClaimTypes.Email)?.ToLowerInvariant() ?? string.Empty;
        if (!string.Equals(requesterEmail, body.TeacherEmail.ToLowerInvariant(), StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == body.StudentId);
        if (student == null) return BadRequest(new { error = "Student not found" });
        var course = await _db.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Code == body.CourseCode);
        if (course == null) return BadRequest(new { error = "Course not found" });

        // Resolve grading scheme and convert optional points -> percents
        var scheme = await GetSchemeAsync(body.CourseCode);
        var contMax = scheme.contMax; var finMax = scheme.finMax; var totalMax = Math.Max(1, contMax + finMax);

        int? contPct = body.ContinuousPercent;
        int? finPct = body.FinalPercent;
        if (body.ContinuousPoints.HasValue) contPct = Clamp((int)Math.Round(body.ContinuousPoints.Value * 100.0 / contMax), 0, 100);
        if (body.FinalPoints.HasValue) finPct = Clamp((int)Math.Round(body.FinalPoints.Value * 100.0 / finMax), 0, 100);

        // Enforce exam access: require >= half+1 of continuous max before allowing final points/percent
        int contPtsForGate;
        if (body.ContinuousPoints.HasValue) contPtsForGate = Clamp(body.ContinuousPoints.Value, 0, contMax);
        else if (contPct.HasValue) contPtsForGate = (int)Math.Round(contPct.Value / 100.0 * contMax);
        else
        {
            // Try read existing record for gate
            var ex0 = await _db.CourseGrades.AsNoTracking().FirstOrDefaultAsync(g => g.StudentId == body.StudentId && g.CourseCode == body.CourseCode);
            contPtsForGate = ex0?.ContinuousPercent != null ? (int)Math.Round((ex0.ContinuousPercent!.Value / 100.0) * contMax) : 0;
        }
        var threshold = (contMax / 2) + 1; // half + 1
        if ((body.FinalPoints.HasValue || finPct.HasValue) && contPtsForGate < threshold && string.Equals(body.AssessmentType, "ZS", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = "Exam not allowed: insufficient continuous points", minRequired = threshold, current = contPtsForGate, maxContinuous = contMax });
        }

        // Compute total percent with proper weighting
        int total;
        if (string.Equals(body.AssessmentType, "ZS", StringComparison.OrdinalIgnoreCase))
        {
            var cp = Clamp(contPtsForGate, 0, contMax);
            // If teacher also provides final now, recompute from provided value; else keep existing
            int finalPtsForTotal;
            if (body.FinalPoints.HasValue) finalPtsForTotal = Clamp(body.FinalPoints.Value, 0, finMax);
            else if (finPct.HasValue) finalPtsForTotal = (int)Math.Round(finPct.Value / 100.0 * finMax);
            else
            {
                var exPrev = await _db.CourseGrades.AsNoTracking().FirstOrDefaultAsync(g => g.StudentId == body.StudentId && g.CourseCode == body.CourseCode);
                finalPtsForTotal = exPrev?.FinalPercent != null ? (int)Math.Round((exPrev.FinalPercent!.Value / 100.0) * finMax) : 0;
            }
            total = Clamp((int)Math.Round((cp + finalPtsForTotal) * 100.0 / totalMax), 0, 100);
        }
        else
        {
            total = Clamp(body.TotalPercent ?? 0, 0, 100);
        }
        var letter = total >= 90 ? "A" : total >= 80 ? "B" : total >= 70 ? "C" : total >= 60 ? "D" : total >= 50 ? "E" : "F";

        var existing = await _db.CourseGrades.FirstOrDefaultAsync(g => g.StudentId == body.StudentId && g.CourseCode == body.CourseCode);
        if (existing == null)
        {
            existing = new StudentCourseGradeEntity
            {
                StudentId = body.StudentId,
                CourseCode = body.CourseCode,
                TeacherEmail = body.TeacherEmail,
                AssessmentType = body.AssessmentType.ToUpperInvariant(),
                ContinuousPercent = contPct,
                FinalPercent = finPct,
                TotalPercent = total,
                LetterGrade = letter,
                AwardedAt = DateTime.UtcNow
            };
            _db.CourseGrades.Add(existing);
        }
        else
        {
            existing.TeacherEmail = body.TeacherEmail;
            existing.AssessmentType = body.AssessmentType.ToUpperInvariant();
            existing.ContinuousPercent = contPct;
            existing.FinalPercent = finPct;
            existing.TotalPercent = total;
            existing.LetterGrade = letter;
            existing.AwardedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        // Notify via GradesHub
        var studentEntity = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == body.StudentId || s.PersonId == body.StudentId);
        if (studentEntity != null)
        {
            await _gradesHub.Clients.Group($"user:{studentEntity.Email.ToLowerInvariant()}").SendAsync("GradeUpdated", new { studentId = body.StudentId, courseCode = body.CourseCode });
        }
        await _gradesHub.Clients.Group("students").SendAsync("GradeUpdated", new { studentId = body.StudentId, courseCode = body.CourseCode });
        await _gradesHub.Clients.Group("teachers").SendAsync("GradeUpdated", new { studentId = body.StudentId, courseCode = body.CourseCode });

        // Create activity for grade creation/update
        await CreateActivityForGradeUpsertAsync(existing, body, default);

        // Notify about grade update
        await _dataUpdates.NotifyGradeUpdated(body.StudentId, body.CourseCode, body.TeacherEmail);

        return Ok(existing);
    }

    /// <summary>
    /// Get course grades for a teacher's course (teachers only)
    /// </summary>
    /// <param name="email">Teacher email address</param>
    /// <param name="code">Course code</param>
    /// <returns>List of course grades for all students in the course</returns>
    /// <remarks>
    /// Requires teacher role. Returns all course grades for students enrolled in the specified course.
    /// Only the owner teacher (matching authenticated user) can access their course grades.
    /// </remarks>
    [HttpGet("teachers/{email}/courses/{code}/grades")]
    [Authorize(Roles = "teacher")]
    [ProducesResponseType(typeof(List<StudentCourseGradeEntity>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListCourseGradesForTeacher(string email, string code)
    {
        var requesterEmail = User.FindFirstValue(ClaimTypes.Email)?.ToLowerInvariant() ?? string.Empty;
        if (!string.Equals(requesterEmail, (email ?? string.Empty).ToLowerInvariant(), StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }
        email = (email ?? string.Empty).ToLowerInvariant();
        code = (code ?? string.Empty).Trim();
        var items = await _db.CourseGrades.AsNoTracking()
            .Where(g => g.TeacherEmail.ToLower() == email && g.CourseCode == code)
            .OrderBy(g => g.StudentId)
            .ToListAsync();
        return Ok(items);
    }

    /// <summary>
    /// Get all grades for a student
    /// </summary>
    /// <param name="id">Student identifier</param>
    /// <returns>List of course grades for the student</returns>
    /// <remarks>
    /// Returns all course grades for a student across all courses.
    /// Students can only access their own grades (verified by email and Id/PersonId match).
    /// Teachers can access any student's grades.
    /// </remarks>
    [HttpGet("students/{id}/grades")]
    [ProducesResponseType(typeof(List<StudentCourseGradeEntity>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListStudentGrades(string id)
    {
        if (User.IsInRole("student"))
        {
            var email = User.FindFirstValue(ClaimTypes.Email)?.ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email))
            {
                return Forbid();
            }

            // Check if the requested student ID belongs to any student record with the same email
            // (students can have multiple records: archived and ongoing)
            // Check both Id and PersonId fields
            var normalizedId = id?.Trim() ?? string.Empty;
            var student = await _db.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Email.ToLower() == email &&
                    (s.Id.ToLower() == normalizedId.ToLower() ||
                     (!string.IsNullOrWhiteSpace(s.PersonId) && s.PersonId.ToLower() == normalizedId.ToLower())));
            if (student == null)
            {
                return Forbid();
            }
        }

        var items = await _db.CourseGrades.AsNoTracking()
            .Where(g => g.StudentId == id)
            .OrderBy(g => g.CourseCode)
            .ToListAsync();
        return Ok(items);
    }

    /// <summary>
    /// Get grading scheme for a course
    /// </summary>
    /// <param name="code">Course code</param>
    /// <returns>Course grading scheme with max points and exam threshold</returns>
    /// <remarks>
    /// Returns the grading scheme (MaxContinuousPoints, MaxFinalPoints) for a course.
    /// Also includes the exam access threshold (half+1 of continuous max).
    /// If no scheme exists, returns default values (40, 60) with threshold 21.
    /// </remarks>
    [HttpGet("courses/{code}/grading-scheme")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetScheme(string code)
    {
        code = (code ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(code)) return BadRequest(new { error = "Missing code" });
        var s = await _db.CourseGradingSchemes.AsNoTracking().FirstOrDefaultAsync(x => x.CourseCode == code);
        var cont = 40; var fin = 60;
        if (s != null) { cont = s.MaxContinuousPoints; fin = s.MaxFinalPoints; }
        var threshold = (cont / 2) + 1;
        return Ok(new { courseCode = code, maxContinuousPoints = cont, maxFinalPoints = fin, threshold });
    }

    public class SaveSchemePayload { public int MaxContinuousPoints { get; set; } public int MaxFinalPoints { get; set; } }

    /// <summary>
    /// Create or update grading scheme for a course (teachers only)
    /// </summary>
    /// <param name="code">Course code</param>
    /// <param name="body">Grading scheme payload with MaxContinuousPoints and MaxFinalPoints</param>
    /// <returns>Updated grading scheme entity</returns>
    /// <remarks>
    /// Requires teacher role. Creates or updates the grading scheme for a course.
    /// 
    /// The grading scheme defines:
    /// - MaxContinuousPoints: Maximum points for continuous assessment (default: 40, min: 1)
    /// - MaxFinalPoints: Maximum points for final exam (default: 60, min: 1)
    /// 
    /// These values are used to:
    /// - Convert assignment points to percentages
    /// - Calculate exam access thresholds (requires >= half+1 of continuous max)
    /// - Compute final course grades
    /// </remarks>
    [HttpPut("courses/{code}/grading-scheme")]
    [Authorize(Roles = "teacher")]
    [ProducesResponseType(typeof(CourseGradingSchemeEntity), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> PutScheme(string code, [FromBody] SaveSchemePayload body)
    {
        code = (code ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(code)) return BadRequest(new { error = "Missing code" });
        var cont = Math.Max(1, body?.MaxContinuousPoints ?? 40);
        var fin = Math.Max(1, body?.MaxFinalPoints ?? 60);
        var s = await _db.CourseGradingSchemes.FirstOrDefaultAsync(x => x.CourseCode == code);
        if (s == null)
        {
            s = new Entities.CourseGradingSchemeEntity { CourseCode = code, MaxContinuousPoints = cont, MaxFinalPoints = fin, UpdatedAt = DateTime.UtcNow };
            _db.CourseGradingSchemes.Add(s);
        }
        else
        {
            s.MaxContinuousPoints = cont;
            s.MaxFinalPoints = fin;
            s.UpdatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync();

        // Notify about grading scheme update
        var email = User?.FindFirstValue(ClaimTypes.Email);
        await _dataUpdates.NotifyAssignmentUpdated(code, email);

        // Create activity for grading scheme update
        await CreateActivityForGradingSchemeUpdateAsync(s, email ?? "system", default);

        var threshold = (cont / 2) + 1;
        return Ok(new { courseCode = code, maxContinuousPoints = cont, maxFinalPoints = fin, threshold });
    }

    private async Task CreateActivityForGradeUpsertAsync(
        StudentCourseGradeEntity grade,
        UpsertGradePayload body,
        CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            // Get student
            var student = await _db.Students
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == body.StudentId || (!string.IsNullOrWhiteSpace(s.PersonId) && s.PersonId == body.StudentId), ct);
            var studentEmail = student?.Email ?? "";
            var studentName = student?.FullName ?? body.StudentId;

            // Get teacher
            var teacher = await _db.Faculty
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.Email.ToLower() == body.TeacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? body.TeacherEmail;

            // Get course
            var course = await _db.Courses
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Code == body.CourseCode, ct);
            var courseName = course?.NameEn ?? course?.NameSk ?? body.CourseCode;

            var meta = new Dictionary<string, object>
            {
                ["courseCode"] = body.CourseCode,
                ["assessmentType"] = body.AssessmentType,
                ["totalPercent"] = grade.TotalPercent,
                ["letterGrade"] = grade.LetterGrade ?? "",
                ["continuousPercent"] = grade.ContinuousPercent ?? 0,
                ["finalPercent"] = grade.FinalPercent ?? 0
            };

            // Create activity for student
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "grades",
                Title = $"Grade updated: {courseName}",
                Description = $"Grade: {grade.LetterGrade} ({grade.TotalPercent}%) • Assessment: {body.AssessmentType}",
                Subject = courseName,
                CourseCode = body.CourseCode,
                TeacherEmail = body.TeacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = studentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = true,
                Priority = "high",
                MetaJson = System.Text.Json.JsonSerializer.Serialize(meta, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)),
                CreatedByEmail = body.TeacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "grades",
                Title = $"Grade recorded: {studentName} - {courseName}",
                Description = $"Grade: {grade.LetterGrade} ({grade.TotalPercent}%) • Assessment: {body.AssessmentType}",
                Subject = courseName,
                CourseCode = body.CourseCode,
                TeacherEmail = body.TeacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = studentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = System.Text.Json.JsonSerializer.Serialize(meta, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)),
                CreatedByEmail = body.TeacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception)
        {
            // Log but don't fail the request
        }
    }

    private async Task CreateActivityForGradingSchemeUpdateAsync(CourseGradingSchemeEntity scheme, string teacherEmail, CancellationToken ct)
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
                .Where(e => e.CourseCode == scheme.CourseCode && e.Status == "Confirmed")
                .Select(e => e.StudentId)
                .Distinct()
                .ToListAsync(ct);

            var students = await _db.Students
                .AsNoTracking()
                .Where(s => enrolledStudents.Contains(s.Id) || (!string.IsNullOrWhiteSpace(s.PersonId) && enrolledStudents.Contains(s.PersonId)))
                .ToListAsync(ct);

            var course = await _db.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Code == scheme.CourseCode, ct);
            var courseName = course?.NameEn ?? course?.NameSk ?? scheme.CourseCode;

            var meta = new Dictionary<string, object>
            {
                ["courseCode"] = scheme.CourseCode ?? "",
                ["maxContinuousPoints"] = scheme.MaxContinuousPoints,
                ["maxFinalPoints"] = scheme.MaxFinalPoints
            };

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Updated grading scheme: {courseName}",
                Description = $"Continuous: {scheme.MaxContinuousPoints} pts • Final: {scheme.MaxFinalPoints} pts",
                Subject = scheme.CourseCode ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = System.Text.Json.JsonSerializer.Serialize(meta, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)),
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
                    Title = $"Grading scheme updated: {courseName}",
                    Description = $"Continuous: {scheme.MaxContinuousPoints} pts • Final: {scheme.MaxFinalPoints} pts",
                    Subject = scheme.CourseCode ?? "",
                    TeacherEmail = teacherEmail,
                    TeacherDisplay = teacherName,
                    StudentEmail = studentEmail,
                    StudentName = student.FullName,
                    Timestamp = now.ToString("o"),
                    RequiresAction = true,
                    Priority = "high",
                    MetaJson = System.Text.Json.JsonSerializer.Serialize(meta, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)),
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
