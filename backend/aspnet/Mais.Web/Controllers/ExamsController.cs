using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Hubs;
using System.Text.Json;
using Mais.Web.Services;

namespace Mais.Web.Controllers;

[Authorize]
public class ExamsController : BaseController
{
    private readonly AppDbContext _db;
    private readonly IDataUpdateService _dataUpdateService;
    private readonly IHubContext<ExamsHub> _examsHub;
    private const int JOIN_CUTOFF_HOURS = 24;
    private const int WITHDRAW_CUTOFF_HOURS = 24;

    public ExamsController(IWebHostEnvironment env, IConfiguration config, AppDbContext db, IDataUpdateService dataUpdateService, IHubContext<ExamsHub> examsHub) : base(env, config)
    {
        _db = db;
        _dataUpdateService = dataUpdateService;
        _examsHub = examsHub;
    }

    private static DateTime EnsureUtc(DateTime dt) => dt.Kind == DateTimeKind.Utc ? dt : DateTime.SpecifyKind(dt, DateTimeKind.Utc);

    private async Task<(string email, string? studentId)> GetMe()
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var stu = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Email.ToLower() == email.ToLower());
        return (email, stu?.Id);
    }

    /// <summary>
    /// Get available exam terms for the authenticated student
    /// </summary>
    /// <param name="range">Optional time range filter: "30d" for ±30 days from now</param>
    /// <param name="term">Optional term filter (not currently used)</param>
    /// <returns>List of available exam terms for courses the student is enrolled in</returns>
    /// <remarks>
    /// Returns exam terms for courses where the student has confirmed enrollment.
    /// Each term includes registration count, whether the student is registered, and whether registration is still open.
    /// Registration closes 24 hours before the exam start time.
    /// </remarks>
    [HttpGet("/api/exams/terms/available")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Available([FromQuery] string? range, [FromQuery] string? term)
    {
        var (email, studentId) = await GetMe();
        if (studentId == null) return Ok(Array.Empty<object>());

        var enrolledCodes = await _db.Enrollments.AsNoTracking()
            .Where(e => e.StudentId == studentId && (e.Status == "Confirmed"))
            .Select(e => e.CourseCode)
            .Distinct()
            .ToListAsync();

        var now = DateTime.UtcNow;
        var q = _db.ExamTerms.AsNoTracking().Where(t => enrolledCodes.Contains(t.CourseCode));
        if (string.Equals(range, "30d", StringComparison.OrdinalIgnoreCase))
        {
            var from = now.AddDays(-30); var to = now.AddDays(30);
            q = q.Where(t => t.StartAt >= from && t.StartAt <= to);
        }

        var terms = await q.OrderBy(t => t.StartAt).ToListAsync();

        // Batch-load registration counts and my flags
        var ids = terms.Select(t => t.Id).ToList();
        var regs = await _db.ExamRegistrations.AsNoTracking()
            .Where(r => ids.Contains(r.TermId))
            .GroupBy(r => r.TermId)
            .Select(g => new { TermId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TermId, x => x.Count);
        var mySet = new HashSet<string>(await _db.ExamRegistrations.AsNoTracking()
            .Where(r => ids.Contains(r.TermId) && r.StudentEmail.ToLower() == email.ToLower())
            .Select(r => r.TermId).ToListAsync());

        var list = terms.Select(t => new
        {
            id = t.Id,
            courseCode = t.CourseCode,
            courseName = t.CourseName,
            credits = t.Credits,
            startAt = t.StartAt,
            endAt = t.EndAt,
            building = t.Building,
            room = t.Room,
            examiner = t.Examiner,
            capacity = t.Capacity,
            registered = regs.TryGetValue(t.Id, out var c) ? c : 0,
            meRegistered = mySet.Contains(t.Id),
            regOpen = (t.StartAt - now) >= TimeSpan.FromHours(JOIN_CUTOFF_HOURS),
        });
        return Ok(list);
    }

    /// <summary>
    /// Get exam terms the authenticated student is registered for
    /// </summary>
    /// <param name="range">Optional time range filter: "30d" for ±30 days from now</param>
    /// <param name="term">Optional term filter (not currently used)</param>
    /// <returns>List of exam terms the student is registered for</returns>
    /// <remarks>
    /// Returns all exam terms where the authenticated student has registered.
    /// Each term includes registration count and whether registration is still open.
    /// </remarks>
    [HttpGet("/api/exams/terms/my")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> MyTerms([FromQuery] string? range, [FromQuery] string? term)
    {
        var (email, _) = await GetMe();
        var now = DateTime.UtcNow;
        var regs = _db.ExamRegistrations.AsNoTracking().Where(r => r.StudentEmail.ToLower() == email.ToLower());
        if (string.Equals(range, "30d", StringComparison.OrdinalIgnoreCase))
        {
            var from = now.AddDays(-30); var to = now.AddDays(30);
            regs = regs.Where(r => r.RegisteredAt >= from && r.RegisteredAt <= to);
        }
        var joins = await regs.Join(_db.ExamTerms.AsNoTracking(), r => r.TermId, t => t.Id, (r, t) => new { r, t }).ToListAsync();
        var ids = joins.Select(x => x.t.Id).ToList();
        var counts = await _db.ExamRegistrations.AsNoTracking()
            .Where(r => ids.Contains(r.TermId))
            .GroupBy(r => r.TermId)
            .Select(g => new { TermId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TermId, x => x.Count);

        var list = joins.Select(x => new
        {
            id = x.t.Id,
            courseCode = x.t.CourseCode,
            courseName = x.t.CourseName,
            credits = x.t.Credits,
            startAt = x.t.StartAt,
            endAt = x.t.EndAt,
            building = x.t.Building,
            room = x.t.Room,
            examiner = x.t.Examiner,
            capacity = x.t.Capacity,
            registered = counts.TryGetValue(x.t.Id, out var c) ? c : 0,
            meRegistered = true,
            regOpen = (x.t.StartAt - now) >= TimeSpan.FromHours(JOIN_CUTOFF_HOURS),
        });
        return Ok(list);
    }

    public class RegisterBody { }

    /// <summary>
    /// Register for an exam term (students only)
    /// </summary>
    /// <param name="id">Exam term identifier</param>
    /// <param name="_">Optional request body (not used)</param>
    /// <returns>Registration success status</returns>
    /// <remarks>
    /// Requires authentication. Registers the authenticated student for an exam term.
    /// 
    /// Validation rules:
    /// - Student must be enrolled in the course (confirmed enrollment)
    /// - Registration must be at least 24 hours before exam start
    /// - Exam term must have available capacity
    /// - Student can only register for one future term per course
    /// - No time conflicts with other registered exam terms
    /// 
    /// Returns 409 Conflict if registration fails due to capacity, time conflict, or other restrictions.
    /// </remarks>
    [HttpPost("/api/exams/terms/{id}/register")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register(string id, [FromBody] RegisterBody? _ = null)
    {
        var (email, studentId) = await GetMe();
        if (string.IsNullOrWhiteSpace(email)) return Unauthorized();
        var term = await _db.ExamTerms.FirstOrDefaultAsync(t => t.Id == id);
        if (term == null) return NotFound(new { error = "Term not found" });
        var now = DateTime.UtcNow;
        if ((term.StartAt - now) < TimeSpan.FromHours(JOIN_CUTOFF_HOURS))
            return Conflict(new { error = $"Registration closes {JOIN_CUTOFF_HOURS}h before start" });
        // Ensure enrolled
        if (studentId == null)
            return BadRequest(new { error = "Student not found" });
        var enrolled = await _db.Enrollments.AsNoTracking().AnyAsync(e => e.StudentId == studentId && e.CourseCode == term.CourseCode && e.Status == "Confirmed");
        if (!enrolled) return Forbid();
        // Capacity check
        var used = await _db.ExamRegistrations.AsNoTracking().CountAsync(r => r.TermId == id);
        if (used >= term.Capacity) return Conflict(new { error = "Term is full" });
        // Already registered?
        var exists = await _db.ExamRegistrations.AsNoTracking().AnyAsync(r => r.TermId == id && r.StudentEmail.ToLower() == email.ToLower());
        if (exists) return Ok(new { ok = true });
        // Only one registration per course for future terms
        var futureTerms = await _db.ExamTerms.AsNoTracking().Where(t => t.CourseCode == term.CourseCode && t.StartAt > now).Select(t => t.Id).ToListAsync();
        var alreadyCourse = await _db.ExamRegistrations.AsNoTracking().AnyAsync(r => futureTerms.Contains(r.TermId) && r.StudentEmail.ToLower() == email.ToLower());
        if (alreadyCourse) return Conflict(new { error = "Already registered for this course" });
        // Conflict check: overlap with other registered terms
        var myRegs = await _db.ExamRegistrations.AsNoTracking()
            .Join(_db.ExamTerms.AsNoTracking(), r => r.TermId, t => t.Id, (r, t) => new { r, t })
            .Where(x => x.r.StudentEmail.ToLower() == email.ToLower() && x.t.EndAt > now)
            .ToListAsync();
        var overlap = myRegs.Any(x => x.t.StartAt < term.EndAt && term.StartAt < x.t.EndAt);
        if (overlap) return Conflict(new { error = "Time conflict with another term" });

        var reg = new ExamRegistrationEntity
        {
            TermId = id,
            StudentId = studentId,
            StudentEmail = email,
            RegisteredAt = DateTime.UtcNow,
        };
        _db.ExamRegistrations.Add(reg);
        await _db.SaveChangesAsync();

        // Notify via ExamsHub
        await _examsHub.Clients.Group($"user:{email.ToLowerInvariant()}").SendAsync("ExamRegistered", new { termId = id, studentEmail = email });
        await _examsHub.Clients.Group("students").SendAsync("ExamRegistered", new { termId = id, studentEmail = email });

        // Create activity for exam registration
        await CreateActivityForExamRegistrationAsync(term, email, studentId, default);

        return Ok(new { ok = true });
    }

    /// <summary>
    /// Unregister from an exam term (students only)
    /// </summary>
    /// <param name="id">Exam term identifier</param>
    /// <returns>Unregistration success status</returns>
    /// <remarks>
    /// Requires authentication. Unregisters the authenticated student from an exam term.
    /// 
    /// Validation:
    /// - Unregistration must be at least 24 hours before exam start
    /// - Student must be registered for the term
    /// 
    /// Returns 409 Conflict if unregistration is too close to exam start time.
    /// </remarks>
    [HttpPost("/api/exams/terms/{id}/unregister")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Unregister(string id)
    {
        var (email, _) = await GetMe();
        var term = await _db.ExamTerms.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
        if (term == null) return NotFound(new { error = "Term not found" });
        var now = DateTime.UtcNow;
        if ((term.StartAt - now) < TimeSpan.FromHours(WITHDRAW_CUTOFF_HOURS))
            return Conflict(new { error = $"Cannot unregister within {WITHDRAW_CUTOFF_HOURS}h of start" });
        var reg = await _db.ExamRegistrations.FirstOrDefaultAsync(r => r.TermId == id && r.StudentEmail.ToLower() == email.ToLower());
        if (reg == null) return NotFound(new { error = "Not registered" });

        // Create activity for exam unregistration before removing
        await CreateActivityForExamUnregistrationAsync(term, email, reg.StudentId, default);

        _db.ExamRegistrations.Remove(reg);
        await _db.SaveChangesAsync();

        // Notify via ExamsHub
        await _examsHub.Clients.Group($"user:{email.ToLowerInvariant()}").SendAsync("ExamUnregistered", new { termId = id, studentEmail = email });
        await _examsHub.Clients.Group("students").SendAsync("ExamUnregistered", new { termId = id, studentEmail = email });

        return Ok(new { ok = true });
    }

    // -------------------- TEACHER APIs --------------------
    public class TermInput
    {
        public string CourseCode { get; set; } = string.Empty;
        public string CourseName { get; set; } = string.Empty;
        public int? Credits { get; set; }
        public DateTime StartAt { get; set; }
        public DateTime EndAt { get; set; }
        public string? Building { get; set; }
        public string? Room { get; set; }
        public string? Examiner { get; set; }
        public int Capacity { get; set; } = 0;
    }

    /// <summary>
    /// Get exam terms created by the authenticated teacher (teachers only)
    /// </summary>
    /// <param name="range">Optional time range filter: "30d" for ±30 days from now</param>
    /// <param name="term">Optional term filter (not currently used)</param>
    /// <returns>List of exam terms created by the teacher</returns>
    /// <remarks>
    /// Requires teacher role. Returns all exam terms created by the authenticated teacher.
    /// Each term includes registration count.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpGet("/api/exams/terms")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListMine([FromQuery] string? range, [FromQuery] string? term)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var now = DateTime.UtcNow;
        var q = _db.ExamTerms.AsNoTracking().Where(t => t.CreatedBy.ToLower() == email.ToLower());
        if (string.Equals(range, "30d", StringComparison.OrdinalIgnoreCase))
        {
            var from = now.AddDays(-30); var to = now.AddDays(30);
            q = q.Where(t => t.StartAt >= from && t.StartAt <= to);
        }
        var terms = await q.OrderBy(t => t.StartAt).ToListAsync();
        var ids = terms.Select(t => t.Id).ToList();
        var counts = await _db.ExamRegistrations.AsNoTracking().Where(r => ids.Contains(r.TermId)).GroupBy(r => r.TermId)
            .Select(g => new { TermId = g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.TermId, x => x.Count);
        var list = terms.Select(t => new
        {
            id = t.Id,
            courseCode = t.CourseCode,
            courseName = t.CourseName,
            credits = t.Credits,
            startAt = t.StartAt,
            endAt = t.EndAt,
            building = t.Building,
            room = t.Room,
            examiner = t.Examiner,
            capacity = t.Capacity,
            registrationsCount = counts.TryGetValue(t.Id, out var c) ? c : 0,
        });
        return Ok(list);
    }

    /// <summary>
    /// Create a new exam term (teachers only)
    /// </summary>
    /// <param name="input">Exam term creation request</param>
    /// <returns>Created exam term identifier</returns>
    /// <remarks>
    /// Requires teacher role. Creates a new exam term.
    /// 
    /// Required fields: CourseCode, StartAt, EndAt
    /// EndAt must be after StartAt.
    /// Examiner defaults to the authenticated teacher's email if not provided.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpPost("/api/exams/terms")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] TermInput input)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var e = new ExamTermEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            CourseCode = input.CourseCode.Trim(),
            CourseName = string.IsNullOrWhiteSpace(input.CourseName) ? input.CourseCode.Trim() : input.CourseName.Trim(),
            Credits = input.Credits,
            StartAt = EnsureUtc(input.StartAt),
            EndAt = EnsureUtc(input.EndAt),
            Building = input.Building,
            Room = input.Room,
            Examiner = string.IsNullOrWhiteSpace(input.Examiner) ? email : input.Examiner,
            Capacity = Math.Max(0, input.Capacity),
            CreatedBy = email,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        if (e.EndAt <= e.StartAt) return BadRequest(new { error = "EndAt must be after StartAt" });
        _db.ExamTerms.Add(e);
        await _db.SaveChangesAsync();

        // Notify via ExamsHub
        await _examsHub.Clients.Group("students").SendAsync("ExamTermCreated", new { id = e.Id, courseCode = e.CourseCode });
        await _examsHub.Clients.Group("teachers").SendAsync("ExamTermCreated", new { id = e.Id, courseCode = e.CourseCode });

        // Create timetable entry for exam term (so it appears in schedule)
        await CreateOrUpdateTimetableForExamAsync(e, default);

        // Create activity for exam term creation
        await CreateActivityForExamTermCreationAsync(e, email, default);

        // Notify via SignalR
        await _dataUpdateService.NotifyExamTermUpdated(e.Id, "created", e.CourseCode);

        return Ok(new { id = e.Id });
    }

    /// <summary>
    /// Update an exam term (teachers only)
    /// </summary>
    /// <param name="id">Exam term identifier</param>
    /// <param name="input">Exam term update request</param>
    /// <returns>Update success status</returns>
    /// <remarks>
    /// Requires teacher role. Updates an existing exam term.
    /// Only the teacher who created the term can update it.
    /// EndAt must be after StartAt.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpPut("/api/exams/terms/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string id, [FromBody] TermInput input)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var t = await _db.ExamTerms.FirstOrDefaultAsync(x => x.Id == id && x.CreatedBy.ToLower() == email.ToLower());
        if (t == null) return NotFound();
        t.CourseCode = input.CourseCode.Trim();
        t.CourseName = string.IsNullOrWhiteSpace(input.CourseName) ? input.CourseCode.Trim() : input.CourseName.Trim();
        t.Credits = input.Credits;
        t.StartAt = EnsureUtc(input.StartAt);
        t.EndAt = EnsureUtc(input.EndAt);
        t.Building = input.Building;
        t.Room = input.Room;
        t.Examiner = string.IsNullOrWhiteSpace(input.Examiner) ? t.Examiner : input.Examiner;
        t.Capacity = Math.Max(0, input.Capacity);
        t.UpdatedAt = DateTime.UtcNow;
        if (t.EndAt <= t.StartAt) return BadRequest(new { error = "EndAt must be after StartAt" });
        await _db.SaveChangesAsync();

        // Update timetable entry for exam term
        await CreateOrUpdateTimetableForExamAsync(t, default);

        // Create activity for exam term update
        await CreateActivityForExamTermUpdateAsync(t, email, default);

        // Notify via ExamsHub directly to students and teachers
        await _examsHub.Clients.Group("students").SendAsync("ExamTermUpdated", new { id = t.Id, courseCode = t.CourseCode });
        await _examsHub.Clients.Group("teachers").SendAsync("ExamTermUpdated", new { id = t.Id, courseCode = t.CourseCode });

        // Notify via SignalR DataUpdateService
        await _dataUpdateService.NotifyExamTermUpdated(t.Id, "updated", t.CourseCode);

        return Ok(new { ok = true });
    }

    /// <summary>
    /// Delete an exam term (teachers only)
    /// </summary>
    /// <param name="id">Exam term identifier</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Requires teacher role. Deletes an exam term and all associated registrations.
    /// Only the teacher who created the term can delete it.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpDelete("/api/exams/terms/{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(string id)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var t = await _db.ExamTerms.FirstOrDefaultAsync(x => x.Id == id && x.CreatedBy.ToLower() == email.ToLower());
        if (t == null) return NotFound();

        // Delete timetable entry for exam term
        await DeleteTimetableForExamAsync(t.Id, default);

        // Create activity for exam term deletion before removing
        await CreateActivityForExamTermDeletionAsync(t, email, default);

        // Store course code before removal for SignalR notification
        var courseCode = t.CourseCode;

        // Remove registrations for this term as well
        var regs = _db.ExamRegistrations.Where(r => r.TermId == id).ToList();
        _db.ExamRegistrations.RemoveRange(regs);
        _db.ExamTerms.Remove(t);
        await _db.SaveChangesAsync();

        // Notify via ExamsHub directly to students and teachers
        await _examsHub.Clients.Group("students").SendAsync("ExamTermDeleted", new { id, courseCode });
        await _examsHub.Clients.Group("teachers").SendAsync("ExamTermDeleted", new { id, courseCode });

        // Notify via SignalR DataUpdateService
        await _dataUpdateService.NotifyExamTermUpdated(id, "deleted", courseCode);

        return NoContent();
    }

    /// <summary>
    /// Get registrations for an exam term (teachers only)
    /// </summary>
    /// <param name="id">Exam term identifier</param>
    /// <returns>List of student registrations for the exam term</returns>
    /// <remarks>
    /// Requires teacher role. Returns all student registrations for a specific exam term.
    /// Only the teacher who created the term can view registrations.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpGet("/api/exams/terms/{id}/registrations")]
    [ProducesResponseType(typeof(List<ExamRegistrationEntity>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Registrations(string id)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var t = await _db.ExamTerms.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.CreatedBy.ToLower() == email.ToLower());
        if (t == null) return NotFound();
        var list = await _db.ExamRegistrations.AsNoTracking().Where(r => r.TermId == id).ToListAsync();
        var students = await _db.Students.AsNoTracking().ToDictionaryAsync(s => s.Email.ToLower(), s => s);
        var res = list.Select(r => new
        {
            id = r.Id,
            studentEmail = r.StudentEmail,
            studentId = r.StudentId,
            studentName = students.TryGetValue((r.StudentEmail ?? string.Empty).ToLower(), out var s) ? s.FullName : r.StudentEmail,
            registeredAt = r.RegisteredAt,
        });
        return Ok(res);
    }

    private async Task CreateActivityForExamTermCreationAsync(ExamTermEntity term, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            // Get enrolled students
            var enrollmentStudentIds = await _db.Enrollments
                .Where(e => e.CourseCode == term.CourseCode && e.Status == "Confirmed")
                .Select(e => e.StudentId)
                .Distinct()
                .ToListAsync(ct);

            var enrolledStudents = await _db.Students
                .AsNoTracking()
                .Where(s => enrollmentStudentIds.Contains(s.Id) || (!string.IsNullOrWhiteSpace(s.PersonId) && enrollmentStudentIds.Contains(s.PersonId)))
                .Select(s => new { StudentEmail = s.Email ?? "", StudentId = s.Id })
                .ToListAsync(ct);

            var meta = new Dictionary<string, object>
            {
                ["examTermId"] = term.Id,
                ["courseCode"] = term.CourseCode,
                ["startAt"] = term.StartAt.ToString("o"),
                ["endAt"] = term.EndAt.ToString("o"),
                ["room"] = term.Room ?? ""
            };

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Created exam term: {term.CourseName}",
                Description = $"Exam scheduled: {term.StartAt:yyyy-MM-dd HH:mm} • Room: {term.Room ?? "TBA"}",
                Subject = term.CourseName,
                CourseCode = term.CourseCode,
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                Room = term.Room,
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
                    Type = "announcements",
                    Title = $"New exam term: {term.CourseName}",
                    Description = $"Exam scheduled: {term.StartAt:yyyy-MM-dd HH:mm} • Room: {term.Room ?? "TBA"}",
                    Subject = term.CourseName,
                    CourseCode = term.CourseCode,
                    TeacherEmail = teacherEmail,
                    TeacherDisplay = teacherName,
                    StudentEmail = student.StudentEmail,
                    StudentName = studentName,
                    Room = term.Room,
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

    private async Task CreateActivityForExamRegistrationAsync(ExamTermEntity term, string studentEmail, string? studentId, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var student = await _db.Students
                .AsNoTracking()
                .FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == studentEmail.ToLower() || s.Id == studentId, ct);
            var studentName = student?.FullName ?? studentEmail;

            var teacher = await _db.Faculty
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.Email.ToLower() == (term.Examiner ?? "").ToLower(), ct);
            var teacherName = teacher?.FullName ?? term.Examiner ?? "";

            var meta = new Dictionary<string, object>
            {
                ["examTermId"] = term.Id,
                ["courseCode"] = term.CourseCode
            };

            // Create activity for student
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Registered for exam: {term.CourseName}",
                Description = $"Exam: {term.StartAt:yyyy-MM-dd HH:mm} • Room: {term.Room ?? "TBA"}",
                Subject = term.CourseName,
                CourseCode = term.CourseCode,
                TeacherEmail = term.Examiner,
                TeacherDisplay = teacherName,
                StudentEmail = studentEmail,
                StudentName = studentName,
                Room = term.Room,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = studentEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activity for teacher
            if (!string.IsNullOrWhiteSpace(term.Examiner))
            {
                var teacherActivity = new ActivityEntity
                {
                    Id = $"{activityId}_teacher",
                    Type = "announcements",
                    Title = $"New exam registration: {studentName}",
                    Description = $"Student registered for {term.CourseName} exam",
                    Subject = term.CourseName,
                    CourseCode = term.CourseCode,
                    TeacherEmail = term.Examiner,
                    TeacherDisplay = teacherName,
                    StudentEmail = studentEmail,
                    StudentName = studentName,
                    Room = term.Room,
                    Timestamp = now.ToString("o"),
                    RequiresAction = false,
                    Priority = "low",
                    MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                    CreatedByEmail = studentEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(teacherActivity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForExamUnregistrationAsync(ExamTermEntity term, string studentEmail, string? studentId, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var student = await _db.Students
                .AsNoTracking()
                .FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == studentEmail.ToLower() || s.Id == studentId, ct);
            var studentName = student?.FullName ?? studentEmail;

            var meta = new Dictionary<string, object>
            {
                ["examTermId"] = term.Id,
                ["courseCode"] = term.CourseCode
            };

            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Unregistered from exam: {term.CourseName}",
                Description = $"Exam: {term.StartAt:yyyy-MM-dd HH:mm}",
                Subject = term.CourseName,
                CourseCode = term.CourseCode,
                StudentEmail = studentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = studentEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForExamTermDeletionAsync(ExamTermEntity term, string deleterEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == deleterEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? deleterEmail;

            // Get registered students
            var registrations = await _db.ExamRegistrations
                .Where(r => r.TermId == term.Id)
                .ToListAsync(ct);

            var meta = new Dictionary<string, object>
            {
                ["examTermId"] = term.Id,
                ["courseCode"] = term.CourseCode
            };

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Deleted exam term: {term.CourseName}",
                Description = $"Exam scheduled for {term.StartAt:yyyy-MM-dd HH:mm} was deleted",
                Subject = term.CourseName,
                CourseCode = term.CourseCode,
                TeacherEmail = deleterEmail,
                TeacherDisplay = teacherName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = deleterEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            // Create activities for registered students
            foreach (var reg in registrations)
            {
                if (string.IsNullOrWhiteSpace(reg.StudentEmail)) continue;

                var student = await _db.Students
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == reg.StudentEmail.ToLower() || s.Id == reg.StudentId, ct);
                var studentName = student?.FullName ?? reg.StudentEmail;

                var studentActivity = new ActivityEntity
                {
                    Id = $"{activityId}_s_{reg.StudentEmail.GetHashCode()}",
                    Type = "announcements",
                    Title = $"Exam term deleted: {term.CourseName}",
                    Description = $"Exam scheduled for {term.StartAt:yyyy-MM-dd HH:mm} was deleted",
                    Subject = term.CourseName,
                    CourseCode = term.CourseCode,
                    TeacherEmail = deleterEmail,
                    TeacherDisplay = teacherName,
                    StudentEmail = reg.StudentEmail,
                    StudentName = studentName,
                    Timestamp = now.ToString("o"),
                    RequiresAction = false,
                    Priority = "medium",
                    MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                    CreatedByEmail = deleterEmail,
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

    private async Task CreateActivityForExamTermUpdateAsync(ExamTermEntity term, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var meta = new Dictionary<string, object>
            {
                ["termId"] = term.Id,
                ["courseCode"] = term.CourseCode ?? "",
                ["startAt"] = term.StartAt.ToString("o"),
                ["endAt"] = term.EndAt.ToString("o")
            };

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Updated exam term: {term.CourseName}",
                Description = $"Exam scheduled for {term.StartAt:yyyy-MM-dd HH:mm} • Room: {term.Room ?? "TBA"}",
                Subject = term.CourseCode ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                Room = term.Room,
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

            // Create activities for registered students
            var registrations = await _db.ExamRegistrations
                .AsNoTracking()
                .Where(r => r.TermId == term.Id)
                .ToListAsync(ct);

            foreach (var reg in registrations)
            {
                if (string.IsNullOrWhiteSpace(reg.StudentEmail)) continue;

                var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == reg.StudentEmail.ToLower(), ct);
                var studentName = student?.FullName ?? reg.StudentEmail;

                var studentActivity = new ActivityEntity
                {
                    Id = $"{activityId}_student_{reg.StudentId}",
                    Type = "announcements",
                    Title = $"Exam term updated: {term.CourseName}",
                    Description = $"Exam scheduled for {term.StartAt:yyyy-MM-dd HH:mm} • Room: {term.Room ?? "TBA"}",
                    Subject = term.CourseCode ?? "",
                    TeacherEmail = teacherEmail,
                    TeacherDisplay = teacherName,
                    StudentEmail = reg.StudentEmail,
                    StudentName = studentName,
                    Room = term.Room,
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

    /// <summary>
    /// Convert ExamTerm DateTime to Day and Slot format for Timetable
    /// </summary>
    private (string Day, string Slot) ConvertExamDateTimeToSchedule(DateTime startAt, DateTime endAt)
    {
        // Get day of week
        var dayOfWeek = startAt.DayOfWeek;
        var day = dayOfWeek switch
        {
            DayOfWeek.Monday => "Monday",
            DayOfWeek.Tuesday => "Tuesday",
            DayOfWeek.Wednesday => "Wednesday",
            DayOfWeek.Thursday => "Thursday",
            DayOfWeek.Friday => "Friday",
            DayOfWeek.Saturday => "Saturday",
            DayOfWeek.Sunday => "Sunday",
            _ => "Monday"
        };

        // Format slot as "HH:mm-HH:mm"
        var slot = $"{startAt:HH:mm}-{endAt:HH:mm}";

        return (day, slot);
    }

    /// <summary>
    /// Create or update timetable entry for exam term
    /// </summary>
    private async Task CreateOrUpdateTimetableForExamAsync(ExamTermEntity exam, CancellationToken ct)
    {
        try
        {
            // Generate timetable ID based on exam term ID
            var timetableId = $"exam_{exam.Id}";

            // Check if entry already exists
            var existing = await _db.Timetable.FirstOrDefaultAsync(t => t.Id == timetableId, ct);

            var (day, slot) = ConvertExamDateTimeToSchedule(exam.StartAt, exam.EndAt);
            
            var teacherEmail = exam.Examiner ?? exam.CreatedBy;
            Console.WriteLine($"[CreateOrUpdateTimetableForExamAsync] Creating timetable entry:");
            Console.WriteLine($"  ID: {timetableId}");
            Console.WriteLine($"  Day: {day}, Slot: {slot}");
            Console.WriteLine($"  CourseCode: {exam.CourseCode}");
            Console.WriteLine($"  TeacherEmail: {teacherEmail}");
            Console.WriteLine($"  Examiner: {exam.Examiner}, CreatedBy: {exam.CreatedBy}");

            if (existing != null)
            {
                // Update existing entry
                existing.Day = day;
                existing.Slot = slot;
                existing.CourseCode = exam.CourseCode;
                existing.Room = exam.Room ?? "";
                existing.TeacherEmail = teacherEmail;
                existing.Type = "EXAM";
                existing.Note = $"Exam: {exam.CourseName} | {exam.StartAt:yyyy-MM-dd HH:mm} | Building: {exam.Building}";
                existing.Capacity = exam.Capacity;
                Console.WriteLine($"  Updated existing timetable entry");
            }
            else
            {
                // Create new entry
                var entry = new TimetableEntryEntity
                {
                    Id = timetableId,
                    Day = day,
                    Slot = slot,
                    CourseCode = exam.CourseCode,
                    Room = exam.Room ?? "",
                    TeacherEmail = teacherEmail,
                    Type = "EXAM",
                    Note = $"Exam: {exam.CourseName} | {exam.StartAt:yyyy-MM-dd HH:mm} | Building: {exam.Building}",
                    Capacity = exam.Capacity
                };
                _db.Timetable.Add(entry);
                Console.WriteLine($"  Created new timetable entry");
            }

            await _db.SaveChangesAsync(ct);
            Console.WriteLine($"  Timetable entry saved successfully");
        }
        catch (Exception ex)
        {
            // Log but don't fail the exam creation
            Console.WriteLine($"[ERROR] Failed to create/update timetable for exam {exam.Id}: {ex.Message}");
            Console.WriteLine($"  Stack trace: {ex.StackTrace}");
        }
    }

    /// <summary>
    /// Delete timetable entry for exam term
    /// </summary>
    private async Task DeleteTimetableForExamAsync(string examId, CancellationToken ct)
    {
        try
        {
            var timetableId = $"exam_{examId}";
            var entry = await _db.Timetable.FirstOrDefaultAsync(t => t.Id == timetableId, ct);
            if (entry != null)
            {
                _db.Timetable.Remove(entry);
                await _db.SaveChangesAsync(ct);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to delete timetable for exam {examId}: {ex.Message}");
        }
    }
}
