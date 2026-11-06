using System.Text.Json;
using Mais.Web.Data;
using Mais.Web.Entities;

namespace Mais.Web.Services;

/// <summary>
/// Service for creating and managing activities automatically from system events
/// </summary>
public interface IActivityService
{
    Task<string> CreateActivityAsync(
        string type,
        string title,
        string? description = null,
        string? subject = null,
        string? classId = null,
        string? courseCode = null,
        string? teacherEmail = null,
        string? teacherDisplay = null,
        string? studentEmail = null,
        string? studentName = null,
        string? room = null,
        string? location = null,
        string? assignmentId = null,
        bool requiresAction = false,
        string? priority = null,
        Dictionary<string, object>? meta = null,
        string? createdByEmail = null,
        CancellationToken cancellationToken = default);

    Task CreateSubmissionActivityAsync(
        string studentEmail,
        string studentName,
        string assignmentId,
        string assignmentName,
        string? courseCode = null,
        string? teacherEmail = null,
        CancellationToken cancellationToken = default);

    Task CreateGradeActivityAsync(
        string studentEmail,
        string studentName,
        string assignmentId,
        string assignmentName,
        string? grade = null,
        string? courseCode = null,
        string? teacherEmail = null,
        CancellationToken cancellationToken = default);

    Task CreateAttendanceActivityAsync(
        string studentEmail,
        string studentName,
        string status,
        string? courseCode = null,
        string? classId = null,
        string? teacherEmail = null,
        string? date = null,
        CancellationToken cancellationToken = default);

    Task CreateAnnouncementActivityAsync(
        string title,
        string? description = null,
        string? courseCode = null,
        string? classId = null,
        string? teacherEmail = null,
        string? teacherDisplay = null,
        List<string>? studentEmails = null,
        CancellationToken cancellationToken = default);

    Task CreateScheduleChangeActivityAsync(
        string mode,
        string subject,
        string? courseCode = null,
        string? classId = null,
        string? teacherEmail = null,
        string? teacherDisplay = null,
        string? day = null,
        string? time = null,
        string? room = null,
        List<string>? studentEmails = null,
        CancellationToken cancellationToken = default);
}

public class ActivityService : IActivityService
{
    private readonly AppDbContext _db;
    private readonly ILogger<ActivityService> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    public ActivityService(AppDbContext db, ILogger<ActivityService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<string> CreateActivityAsync(
        string type,
        string title,
        string? description = null,
        string? subject = null,
        string? classId = null,
        string? courseCode = null,
        string? teacherEmail = null,
        string? teacherDisplay = null,
        string? studentEmail = null,
        string? studentName = null,
        string? room = null,
        string? location = null,
        string? assignmentId = null,
        bool requiresAction = false,
        string? priority = null,
        Dictionary<string, object>? meta = null,
        string? createdByEmail = null,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var id = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

        var entity = new ActivityEntity
        {
            Id = id,
            Type = type,
            Title = title,
            Description = description,
            Subject = subject,
            ClassId = classId,
            CourseCode = courseCode,
            TeacherEmail = teacherEmail,
            TeacherDisplay = teacherDisplay,
            StudentEmail = studentEmail,
            StudentName = studentName,
            Room = room,
            Location = location,
            AssignmentId = assignmentId,
            Timestamp = now.ToString("o"),
            RequiresAction = requiresAction,
            Priority = priority,
            MetaJson = meta != null ? JsonSerializer.Serialize(meta, _jsonOptions) : null,
            CreatedByEmail = createdByEmail,
            CreatedAt = now.ToString("o"),
            UpdatedAt = now.ToString("o"),
            IsResolved = false,
            IsArchived = false
        };

        try
        {
            _db.Activities.Add(entity);
            await _db.SaveChangesAsync(cancellationToken);
            return id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create activity: {Title}", title);
            throw;
        }
    }

    public async Task CreateSubmissionActivityAsync(
        string studentEmail,
        string studentName,
        string assignmentId,
        string assignmentName,
        string? courseCode = null,
        string? teacherEmail = null,
        CancellationToken cancellationToken = default)
    {
        await CreateActivityAsync(
            type: "submissions",
            title: $"New submission: {assignmentName}",
            description: $"{studentName} submitted {assignmentName}",
            studentEmail: studentEmail,
            studentName: studentName,
            assignmentId: assignmentId,
            courseCode: courseCode,
            teacherEmail: teacherEmail,
            requiresAction: true,
            priority: "medium",
            meta: new Dictionary<string, object>
            {
                ["assignmentName"] = assignmentName,
                ["submittedAt"] = DateTime.UtcNow.ToString("o")
            },
            createdByEmail: studentEmail,
            cancellationToken: cancellationToken
        );
    }

    public async Task CreateGradeActivityAsync(
        string studentEmail,
        string studentName,
        string assignmentId,
        string assignmentName,
        string? grade = null,
        string? courseCode = null,
        string? teacherEmail = null,
        CancellationToken cancellationToken = default)
    {
        var title = grade != null
            ? $"Grade posted: {assignmentName} ({grade})"
            : $"Grade posted: {assignmentName}";

        await CreateActivityAsync(
            type: "grades",
            title: title,
            description: grade != null
                ? $"Your grade for {assignmentName} is {grade}"
                : $"Grade posted for {assignmentName}",
            studentEmail: studentEmail,
            studentName: studentName,
            assignmentId: assignmentId,
            courseCode: courseCode,
            teacherEmail: teacherEmail,
            requiresAction: false,
            priority: "low",
            meta: new Dictionary<string, object>
            {
                ["assignmentName"] = assignmentName,
                ["grade"] = grade ?? "",
                ["gradedAt"] = DateTime.UtcNow.ToString("o")
            },
            createdByEmail: teacherEmail,
            cancellationToken: cancellationToken
        );
    }

    public async Task CreateAttendanceActivityAsync(
        string studentEmail,
        string studentName,
        string status,
        string? courseCode = null,
        string? classId = null,
        string? teacherEmail = null,
        string? date = null,
        CancellationToken cancellationToken = default)
    {
        var statusText = status.ToLower() switch
        {
            "absent" => "Absent",
            "late" => "Late",
            "excused" => "Excused",
            _ => "Present"
        };

        var requiresAction = status.ToLower() is "absent" or "late";
        var priority = status.ToLower() == "absent" ? "high" : status.ToLower() == "late" ? "medium" : "low";

        await CreateActivityAsync(
            type: "attendance",
            title: $"Attendance marked: {statusText}",
            description: $"{studentName} marked as {statusText.ToLower()}",
            studentEmail: studentEmail,
            studentName: studentName,
            courseCode: courseCode,
            classId: classId,
            teacherEmail: teacherEmail,
            requiresAction: requiresAction,
            priority: priority,
            meta: new Dictionary<string, object>
            {
                ["status"] = status,
                ["date"] = date ?? DateTime.UtcNow.ToString("yyyy-MM-dd"),
                ["markedAt"] = DateTime.UtcNow.ToString("o")
            },
            createdByEmail: teacherEmail,
            cancellationToken: cancellationToken
        );
    }

    public async Task CreateAnnouncementActivityAsync(
        string title,
        string? description = null,
        string? courseCode = null,
        string? classId = null,
        string? teacherEmail = null,
        string? teacherDisplay = null,
        List<string>? studentEmails = null,
        CancellationToken cancellationToken = default)
    {
        if (studentEmails != null && studentEmails.Count > 0)
        {
            // Create activity for each student
            var tasks = studentEmails.Select(email =>
                CreateActivityAsync(
                    type: "announcement",
                    title: title,
                    description: description,
                    courseCode: courseCode,
                    classId: classId,
                    teacherEmail: teacherEmail,
                    teacherDisplay: teacherDisplay,
                    studentEmail: email,
                    requiresAction: true,
                    priority: "medium",
                    createdByEmail: teacherEmail,
                    cancellationToken: cancellationToken
                )
            );

            await Task.WhenAll(tasks);
        }
        else
        {
            // Create general announcement (visible to all students in course/class)
            await CreateActivityAsync(
                type: "announcement",
                title: title,
                description: description,
                courseCode: courseCode,
                classId: classId,
                teacherEmail: teacherEmail,
                teacherDisplay: teacherDisplay,
                requiresAction: true,
                priority: "medium",
                createdByEmail: teacherEmail,
                cancellationToken: cancellationToken
            );
        }
    }

    public async Task CreateScheduleChangeActivityAsync(
        string mode,
        string subject,
        string? courseCode = null,
        string? classId = null,
        string? teacherEmail = null,
        string? teacherDisplay = null,
        string? day = null,
        string? time = null,
        string? room = null,
        List<string>? studentEmails = null,
        CancellationToken cancellationToken = default)
    {
        var modeText = mode.ToLower() switch
        {
            "create" => "created",
            "update" => "updated",
            "move" => "moved",
            "delete" => "deleted",
            _ => "updated"
        };

        var title = $"Schedule {modeText}: {subject}";
        var description = new List<string>();
        if (day != null) description.Add($"Day: {day}");
        if (time != null) description.Add($"Time: {time}");
        if (room != null) description.Add($"Room: {room}");

        if (studentEmails != null && studentEmails.Count > 0)
        {
            // Create activity for each student
            var tasks = studentEmails.Select(email =>
                CreateActivityAsync(
                    type: "schedule",
                    title: title,
                    description: string.Join(" • ", description),
                    subject: subject,
                    courseCode: courseCode,
                    classId: classId,
                    teacherEmail: teacherEmail,
                    teacherDisplay: teacherDisplay,
                    studentEmail: email,
                    room: room,
                    requiresAction: true,
                    priority: "medium",
                    meta: new Dictionary<string, object>
                    {
                        ["mode"] = mode,
                        ["day"] = day ?? "",
                        ["time"] = time ?? "",
                    },
                    createdByEmail: teacherEmail,
                    cancellationToken: cancellationToken
                )
            );

            await Task.WhenAll(tasks);
        }
        else
        {
            // Create general schedule change
            await CreateActivityAsync(
                type: "schedule",
                title: title,
                description: string.Join(" • ", description),
                subject: subject,
                courseCode: courseCode,
                classId: classId,
                teacherEmail: teacherEmail,
                teacherDisplay: teacherDisplay,
                room: room,
                requiresAction: true,
                priority: "medium",
                meta: new Dictionary<string, object>
                {
                    ["mode"] = mode,
                    ["day"] = day ?? "",
                    ["time"] = time ?? "",
                },
                createdByEmail: teacherEmail,
                cancellationToken: cancellationToken
            );
        }
    }
}

