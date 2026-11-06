using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Services;
using Mais.Web.Hubs;
using System.Text.Json;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/enrollments")]
[Authorize]
public class EnrollmentController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDataUpdateService _dataUpdates;
    private readonly IHubContext<EnrollmentHub> _enrollmentHub;

    public EnrollmentController(AppDbContext db, IDataUpdateService dataUpdates, IHubContext<EnrollmentHub> enrollmentHub)
    {
        _db = db;
        _dataUpdates = dataUpdates;
        _enrollmentHub = enrollmentHub;
    }

    public class ConfirmPayload
    {
        public string? AcademicYear { get; set; }
        public string? Semester { get; set; } // WS/SS
        public List<CourseSelection> Courses { get; set; } = new();
    }
    public class CourseSelection
    {
        public string CourseCode { get; set; } = string.Empty;
        public string? ScheduleEventId { get; set; }
    }

    /// <summary>
    /// Confirm course enrollments for the authenticated student
    /// </summary>
    /// <param name="body">Enrollment confirmation payload with academic year, semester, and course selections</param>
    /// <returns>Enrollment confirmation result with count of enrolled courses</returns>
    /// <remarks>
    /// Requires authentication. Confirms course enrollments for the authenticated student.
    /// 
    /// Important:
    /// - Uses PersonId as primary identifier for enrollments (falls back to Id if PersonId is not set)
    /// - Enforces one-time confirmation per term (AcademicYear + Semester combination)
    /// - Automatically assigns className from CL (Class) schedule events if available
    /// - Extracts class group from schedule event's ClassGroupKeysJson for CL events
    /// 
    /// Each course selection can optionally include a ScheduleEventId to link to a specific schedule event.
    /// Returns 409 Conflict if enrollment already confirmed for the term.
    /// </remarks>
    [Authorize]
    [HttpPost("confirm")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Confirm([FromBody] ConfirmPayload body)
    {
        var email = User?.Claims?.FirstOrDefault(c => c.Type.Contains("email", StringComparison.OrdinalIgnoreCase))?.Value;
        if (string.IsNullOrWhiteSpace(email)) return Unauthorized();

        var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Email.ToLower() == email.ToLower());
        if (student == null) return BadRequest(new { error = "Student record not found" });
        if (body == null || body.Courses == null || body.Courses.Count == 0) return BadRequest(new { error = "No courses provided" });

        // Use PersonId for enrollments (primary identifier), fallback to Id if PersonId is not set
        var studentIdForEnrollment = !string.IsNullOrWhiteSpace(student.PersonId) ? student.PersonId : student.Id;

        // Optionally enforce one-time confirmation per term
        var termKey = (body.AcademicYear ?? "").Trim() + "|" + (body.Semester ?? "").Trim();
        var already = await _db.Enrollments.AsNoTracking().AnyAsync(e =>
            (e.StudentId == studentIdForEnrollment || e.StudentId == student.Id || (!string.IsNullOrWhiteSpace(student.PersonId) && e.StudentId == student.PersonId))
            && e.AcademicYear == (body.AcademicYear ?? null)
            && e.Semester == (body.Semester ?? null));
        if (already)
        {
            // Lock after first confirmation for the term
            return Conflict(new { error = "Enrollment already confirmed for this term" });
        }

        var toAdd = new List<StudentEnrollmentEntity>();
        var studentToUpdate = await _db.Students.FirstOrDefaultAsync(s => s.Id == student.Id);
        if (studentToUpdate == null) return BadRequest(new { error = "Student record not found for update" });

        string? assignedClassName = null;
        foreach (var c in body.Courses)
        {
            if (string.IsNullOrWhiteSpace(c?.CourseCode)) continue;

            // Get schedule event to extract class group
            TimetableEntryEntity? scheduleEvent = null;
            if (!string.IsNullOrWhiteSpace(c.ScheduleEventId))
            {
                scheduleEvent = await _db.Timetable.FirstOrDefaultAsync(t => t.Id == c.ScheduleEventId);
                if (scheduleEvent == null) return BadRequest(new { error = $"Schedule not found: {c.ScheduleEventId}" });

                // Extract class group from schedule event if available
                // className is determined ONLY from CL (Class) events, not from P or S
                var eventType = (scheduleEvent.Type ?? "").Trim().ToUpperInvariant();
                var isCL = eventType == "CL";

                if (isCL && !string.IsNullOrWhiteSpace(scheduleEvent.ClassGroupKeysJson))
                {
                    try
                    {
                        var classGroups = System.Text.Json.JsonSerializer.Deserialize<List<string>>(scheduleEvent.ClassGroupKeysJson) ?? new List<string>();
                        if (classGroups.Count > 0)
                        {
                            // Use first class group from CL event as the student's className
                            var firstGroupKey = classGroups[0];

                            // Check if this is a real ClassGroup with capacity limit
                            var classGroup = await _db.ClassGroups.FirstOrDefaultAsync(g => g.Id == firstGroupKey && g.IsActive);
                            if (classGroup != null)
                            {
                                // Validate capacity (max 30 students per group)
                                if (classGroup.StudentCount >= classGroup.Capacity)
                                {
                                    return Conflict(new
                                    {
                                        error = $"Class group '{classGroup.Name}' is full ({classGroup.Capacity} students maximum). Please select a different class time.",
                                        groupId = classGroup.Id,
                                        groupName = classGroup.Name,
                                        capacity = classGroup.Capacity,
                                        currentCount = classGroup.StudentCount
                                    });
                                }

                                // Increment student count for this group
                                classGroup.StudentCount++;
                                classGroup.UpdatedAt = DateTime.UtcNow.ToString("o");
                            }

                            // CL events create groups, and students are automatically assigned to these groups on enrollment
                            assignedClassName = firstGroupKey;
                        }
                    }
                    catch { /* ignore parse errors */ }
                }
            }

            toAdd.Add(new StudentEnrollmentEntity
            {
                StudentId = studentIdForEnrollment, // Use PersonId if available, otherwise Id
                CourseCode = c.CourseCode.Trim(),
                ScheduleEventId = string.IsNullOrWhiteSpace(c.ScheduleEventId) ? null : c.ScheduleEventId,
                Status = "Confirmed",
                AcademicYear = string.IsNullOrWhiteSpace(body.AcademicYear) ? null : body.AcademicYear,
                Semester = string.IsNullOrWhiteSpace(body.Semester) ? null : body.Semester,
                ConfirmedAt = DateTime.UtcNow
            });
        }
        if (toAdd.Count == 0) return BadRequest(new { error = "No valid courses provided" });

        // Update student's className if we found one from schedule events
        // Always update if we have a class from enrollment, even if student already has a different class
        if (!string.IsNullOrWhiteSpace(assignedClassName))
        {
            studentToUpdate.ClassName = assignedClassName;
            // Log for debugging
            Console.WriteLine($"[Enrollment] Setting className '{assignedClassName}' for student {studentIdForEnrollment} (PersonId: {student.PersonId}, Id: {student.Id})");
        }
        else
        {
            // Log if no className was assigned (no CL event found)
            Console.WriteLine($"[Enrollment] No className assigned for student {studentIdForEnrollment} (PersonId: {student.PersonId}, Id: {student.Id}) - no CL event with classGroupKeys found");
        }

        _db.Enrollments.AddRange(toAdd);
        await _db.SaveChangesAsync();

        // Notify via EnrollmentHub
        await _enrollmentHub.Clients.Group($"user:{email.ToLowerInvariant()}").SendAsync("EnrollmentConfirmed", new { studentEmail = email, count = toAdd.Count });
        await _enrollmentHub.Clients.Group("students").SendAsync("EnrollmentCreated", new { studentEmail = email, courses = toAdd.Select(e => e.CourseCode).ToList() });

        // Create activities for enrollment confirmation
        await CreateActivityForEnrollmentConfirmationAsync(toAdd, student, email, default);

        // Notify about enrollment updates
        // Use PersonId for notifications if available, otherwise Id
        var studentIdForNotification = !string.IsNullOrWhiteSpace(student.PersonId) ? student.PersonId : student.Id;
        var courseCodes = toAdd.Select(e => e.CourseCode).Distinct().ToList();
        foreach (var courseCode in courseCodes)
        {
            await _dataUpdates.NotifyEnrollmentUpdated(studentIdForNotification, courseCode, null);
        }
        await _dataUpdates.NotifyStudentUpdated(studentIdForNotification, student.Email);

        return Ok(new { count = toAdd.Count });
    }

    /// <summary>
    /// Get all enrollments for a student
    /// </summary>
    /// <param name="id">Student identifier (Id or PersonId)</param>
    /// <returns>List of student enrollments</returns>
    /// <remarks>
    /// Returns all enrollments for a student. Searches by:
    /// - Student Id
    /// - Student PersonId (primary identifier)
    /// - Case-insensitive matching
    /// 
    /// If student record is found, uses PersonId as primary identifier (falls back to Id).
    /// Returns empty list if student not found but still searches enrollments by provided ID.
    /// </remarks>
    [HttpGet("/api/students/{id}/enrollments")]
    [ProducesResponseType(typeof(List<StudentEnrollmentEntity>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ListForStudent(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { error = "Student ID required" });

        // Try to find student by Id or PersonId to get all possible IDs
        var student = await _db.Students.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id || (!string.IsNullOrWhiteSpace(s.PersonId) && s.PersonId == id));

        List<StudentEnrollmentEntity> items;

        if (student == null)
        {
            // If student not found, still try to get enrollments by the provided ID
            items = await _db.Enrollments.AsNoTracking().Where(e => e.StudentId == id).ToListAsync();
        }
        else
        {
            // Get enrollments by PersonId (primary), Id (fallback), or the provided id
            // Priority: PersonId > Id > provided id
            var studentIdForEnrollment = !string.IsNullOrWhiteSpace(student.PersonId) ? student.PersonId : student.Id;
            items = await _db.Enrollments.AsNoTracking()
                .Where(e => e.StudentId == studentIdForEnrollment ||
                           e.StudentId == student.Id ||
                           (!string.IsNullOrWhiteSpace(student.PersonId) && e.StudentId == student.PersonId) ||
                           e.StudentId == id)
                .ToListAsync();
        }

        return Ok(items);
    }

    /// <summary>
    /// Create enrollments for a student (teachers only)
    /// </summary>
    /// <param name="body">Enrollment creation payload with student ID, academic year, semester, and course selections</param>
    /// <returns>Enrollment creation result with count and assigned className</returns>
    /// <remarks>
    /// Requires authentication. Allows teachers to create enrollments for students.
    /// 
    /// Important:
    /// - Uses PersonId as primary identifier for enrollments (falls back to Id if PersonId is not set)
    /// - Automatically assigns className from CL (Class) schedule events if available
    /// - Extracts class group from schedule event's ClassGroupKeysJson for CL events
    /// - Updates student's className if a class group is found
    /// 
    /// Each course selection can optionally include a ScheduleEventId to link to a specific schedule event.
    /// </remarks>
    [Authorize]
    [HttpPost("create-for-student")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateForStudent([FromBody] CreateForStudentPayload body)
    {
        if (body == null || string.IsNullOrWhiteSpace(body.StudentId) || body.Courses == null || body.Courses.Count == 0)
            return BadRequest(new { error = "StudentId and Courses are required" });

        var student = await _db.Students.FirstOrDefaultAsync(s => s.Id == body.StudentId || (!string.IsNullOrWhiteSpace(s.PersonId) && s.PersonId == body.StudentId));
        if (student == null) return NotFound(new { error = "Student not found" });

        // Use PersonId for enrollments (primary identifier), fallback to Id if PersonId is not set
        var studentIdForEnrollment = !string.IsNullOrWhiteSpace(student.PersonId) ? student.PersonId : student.Id;

        var toAdd = new List<StudentEnrollmentEntity>();
        string? assignedClassName = null;

        foreach (var c in body.Courses)
        {
            if (string.IsNullOrWhiteSpace(c?.CourseCode)) continue;

            // Get schedule event to extract class group
            TimetableEntryEntity? scheduleEvent = null;
            if (!string.IsNullOrWhiteSpace(c.ScheduleEventId))
            {
                scheduleEvent = await _db.Timetable.FirstOrDefaultAsync(t => t.Id == c.ScheduleEventId);
                if (scheduleEvent == null) return BadRequest(new { error = $"Schedule not found: {c.ScheduleEventId}" });

                // Extract class group from schedule event if available
                var eventType = (scheduleEvent.Type ?? "").Trim().ToUpperInvariant();
                var isCL = eventType == "CL";

                if (isCL && !string.IsNullOrWhiteSpace(scheduleEvent.ClassGroupKeysJson))
                {
                    try
                    {
                        var classGroups = System.Text.Json.JsonSerializer.Deserialize<List<string>>(scheduleEvent.ClassGroupKeysJson) ?? new List<string>();
                        if (classGroups.Count > 0)
                        {
                            var firstGroupKey = classGroups[0];

                            // Check capacity for ClassGroup
                            var classGroup = await _db.ClassGroups.FirstOrDefaultAsync(g => g.Id == firstGroupKey && g.IsActive);
                            if (classGroup != null)
                            {
                                // Validate capacity
                                if (classGroup.StudentCount >= classGroup.Capacity)
                                {
                                    return Conflict(new
                                    {
                                        error = $"Class group '{classGroup.Name}' is full ({classGroup.Capacity} students maximum). Please select a different class time.",
                                        groupId = classGroup.Id,
                                        groupName = classGroup.Name,
                                        capacity = classGroup.Capacity,
                                        currentCount = classGroup.StudentCount
                                    });
                                }

                                // Increment student count
                                classGroup.StudentCount++;
                                classGroup.UpdatedAt = DateTime.UtcNow.ToString("o");
                            }

                            assignedClassName = firstGroupKey;
                        }
                    }
                    catch { /* ignore parse errors */ }
                }
            }

            toAdd.Add(new StudentEnrollmentEntity
            {
                StudentId = studentIdForEnrollment, // Use PersonId if available, otherwise Id
                CourseCode = c.CourseCode.Trim(),
                ScheduleEventId = string.IsNullOrWhiteSpace(c.ScheduleEventId) ? null : c.ScheduleEventId,
                Status = "Confirmed",
                AcademicYear = string.IsNullOrWhiteSpace(body.AcademicYear) ? null : body.AcademicYear,
                Semester = string.IsNullOrWhiteSpace(body.Semester) ? null : body.Semester,
                ConfirmedAt = DateTime.UtcNow
            });
        }

        if (toAdd.Count == 0) return BadRequest(new { error = "No valid courses provided" });

        // Update student's className if we found one
        if (!string.IsNullOrWhiteSpace(assignedClassName))
        {
            student.ClassName = assignedClassName;
        }

        _db.Enrollments.AddRange(toAdd);
        await _db.SaveChangesAsync();

        // Notify via EnrollmentHub
        await _enrollmentHub.Clients.Group($"user:{student.Email.ToLowerInvariant()}").SendAsync("EnrollmentCreated", new { studentEmail = student.Email, count = toAdd.Count });

        // Create activities for enrollment creation (by teacher)
        var teacherEmail = User?.Claims?.FirstOrDefault(c => c.Type.Contains("email", StringComparison.OrdinalIgnoreCase))?.Value ?? "";
        await CreateActivityForEnrollmentCreationByTeacherAsync(toAdd, student, teacherEmail, default);

        // Notify about enrollment updates
        // Use PersonId for notifications if available, otherwise Id
        var studentIdForNotification = !string.IsNullOrWhiteSpace(student.PersonId) ? student.PersonId : student.Id;
        var courseCodes = toAdd.Select(e => e.CourseCode).Distinct().ToList();
        foreach (var courseCode in courseCodes)
        {
            await _dataUpdates.NotifyEnrollmentUpdated(studentIdForNotification, courseCode, null);
        }
        await _dataUpdates.NotifyStudentUpdated(studentIdForNotification, student.Email);

        return Ok(new { count = toAdd.Count, className = assignedClassName });
    }

    public class CreateForStudentPayload
    {
        public string StudentId { get; set; } = string.Empty;
        public string? AcademicYear { get; set; }
        public string? Semester { get; set; }
        public List<CourseSelection> Courses { get; set; } = new();
    }

    private async Task CreateActivityForEnrollmentConfirmationAsync(
        List<StudentEnrollmentEntity> enrollments,
        StudentEntity student,
        string studentEmail,
        CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var studentName = student?.FullName ?? studentEmail;

            // Get course names
            var courseCodes = enrollments.Select(e => e.CourseCode).Distinct().ToList();
            var courses = await _db.Courses
                .AsNoTracking()
                .Where(c => courseCodes.Contains(c.Code))
                .ToDictionaryAsync(c => c.Code, c => c.NameEn ?? c.NameSk ?? c.Code, ct);

            // Get teachers for each course from schedule events
            var scheduleEventIds = enrollments.Where(e => !string.IsNullOrWhiteSpace(e.ScheduleEventId)).Select(e => e.ScheduleEventId).ToList();
            var scheduleEvents = await _db.Timetable
                .AsNoTracking()
                .Where(t => scheduleEventIds.Contains(t.Id))
                .ToDictionaryAsync(t => t.Id, t => t, ct);

            var teachersByCourse = new Dictionary<string, string>();
            foreach (var enrollment in enrollments)
            {
                if (string.IsNullOrWhiteSpace(enrollment.ScheduleEventId)) continue;
                if (scheduleEvents.TryGetValue(enrollment.ScheduleEventId, out var ev))
                {
                    if (!string.IsNullOrWhiteSpace(ev.TeacherEmail))
                    {
                        teachersByCourse[enrollment.CourseCode] = ev.TeacherEmail;
                    }
                }
            }

            // Create activity for student
            var courseNames = enrollments.Select(e => courses.GetValueOrDefault(e.CourseCode, e.CourseCode)).ToList();
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Enrolled in {enrollments.Count} course(s)",
                Description = string.Join(", ", courseNames),
                Subject = courseNames.Count == 1 ? courseNames[0] : $"{courseNames.Count} courses",
                CourseCode = courseCodes.Count == 1 ? courseCodes[0] : null,
                StudentEmail = studentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(new Dictionary<string, object>
                {
                    ["courseCodes"] = courseCodes,
                    ["enrollmentCount"] = enrollments.Count
                }, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = studentEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activities for teachers
            foreach (var courseCode in courseCodes)
            {
                if (!teachersByCourse.TryGetValue(courseCode, out var teacherEmail)) continue;

                var teacher = await _db.Faculty
                    .AsNoTracking()
                    .FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
                var teacherName = teacher?.FullName ?? teacherEmail;
                var courseName = courses.GetValueOrDefault(courseCode, courseCode);

                var teacherActivity = new ActivityEntity
                {
                    Id = $"{activityId}_t_{courseCode.GetHashCode()}",
                    Type = "announcements",
                    Title = $"New enrollment: {studentName}",
                    Description = $"Student enrolled in {courseName}",
                    Subject = courseName,
                    CourseCode = courseCode,
                    TeacherEmail = teacherEmail,
                    TeacherDisplay = teacherName,
                    StudentEmail = studentEmail,
                    StudentName = studentName,
                    Timestamp = now.ToString("o"),
                    RequiresAction = false,
                    Priority = "low",
                    MetaJson = JsonSerializer.Serialize(new Dictionary<string, object>
                    {
                        ["courseCode"] = courseCode,
                        ["studentId"] = student?.Id ?? "",
                        ["personId"] = student?.PersonId ?? ""
                    }, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
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
        catch (Exception)
        {
            // Log but don't fail the request
        }
    }

    private async Task CreateActivityForEnrollmentCreationByTeacherAsync(
        List<StudentEnrollmentEntity> enrollments,
        StudentEntity student,
        string teacherEmail,
        CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var studentEmail = student?.Email ?? "";
            var studentName = student?.FullName ?? studentEmail;

            // Get teacher name
            var teacher = await _db.Faculty
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            // Get course names
            var courseCodes = enrollments.Select(e => e.CourseCode).Distinct().ToList();
            var courses = await _db.Courses
                .AsNoTracking()
                .Where(c => courseCodes.Contains(c.Code))
                .ToDictionaryAsync(c => c.Code, c => c.NameEn ?? c.NameSk ?? c.Code, ct);

            // Create activity for student
            var courseNames = enrollments.Select(e => courses.GetValueOrDefault(e.CourseCode, e.CourseCode)).ToList();
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Enrolled in {enrollments.Count} course(s) by {teacherName}",
                Description = string.Join(", ", courseNames),
                Subject = courseNames.Count == 1 ? courseNames[0] : $"{courseNames.Count} courses",
                CourseCode = courseCodes.Count == 1 ? courseCodes[0] : null,
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = studentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = true,
                Priority = "medium",
                MetaJson = JsonSerializer.Serialize(new Dictionary<string, object>
                {
                    ["courseCodes"] = courseCodes,
                    ["enrollmentCount"] = enrollments.Count,
                    ["enrolledBy"] = teacherEmail
                }, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
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
                Type = "announcements",
                Title = $"Enrolled {studentName} in {enrollments.Count} course(s)",
                Description = string.Join(", ", courseNames),
                Subject = courseNames.Count == 1 ? courseNames[0] : $"{courseNames.Count} courses",
                CourseCode = courseCodes.Count == 1 ? courseCodes[0] : null,
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = studentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(new Dictionary<string, object>
                {
                    ["courseCodes"] = courseCodes,
                    ["enrollmentCount"] = enrollments.Count,
                    ["studentId"] = student?.Id ?? "",
                    ["personId"] = student?.PersonId ?? ""
                }, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
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
}
