using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Hubs;

namespace Mais.Web.Services;

public interface IDataUpdateService
{
    Task NotifyStudentUpdated(string studentId, string? email = null);
    Task NotifyFacultyUpdated(string? email = null);
    Task NotifyEnrollmentUpdated(string? studentId = null, string? courseCode = null, string? teacherEmail = null);
    Task NotifyGradeUpdated(string? studentId = null, string? courseCode = null, string? teacherEmail = null);
    Task NotifyScheduleUpdated(string? teacherEmail = null, string? courseCode = null);
    Task NotifyAssignmentUpdated(string? courseCode = null, string? teacherEmail = null);
    Task NotifyActivityCreatedAsync(string userEmail, string activityId, CancellationToken ct = default);
    Task NotifyKnowledgeBaseUpdated(string articleId, string action);
    Task NotifyChangelogUpdated(string entryId, string action);
    Task NotifyRoomUpdated(int? roomId = null, string? action = null);
    Task NotifyEquipmentUpdated(int? equipmentId = null, string? action = null);
    Task NotifySurveyUpdated(string? surveyId = null, string? action = null);
    Task NotifyExamTermUpdated(string? termId = null, string? action = null, string? courseCode = null);
    Task NotifyThesisUpdated(string? thesisId = null, string? action = null, string? studentEmail = null, string? supervisorEmail = null);
    Task NotifyDocumentUpdated(string? documentId = null, string? action = null, string? ownerEmail = null);
    Task NotifyClassGroupUpdated(string groupId, string action, string? teacherEmail = null);
    Task NotifyNewsUpdated(int? newsId = null, string? action = null);
}

public class DataUpdateService : IDataUpdateService
{
    private readonly IHubContext<DataHub> _hub;
    private readonly IHubContext<GradesHub> _gradesHub;
    private readonly IHubContext<ActivitiesHub> _activitiesHub;
    private readonly IHubContext<ExamsHub> _examsHub;
    private readonly IHubContext<ScheduleHub> _scheduleHub;
    private readonly IHubContext<SurveysHub> _surveysHub;
    private readonly IHubContext<ResourcesHub> _resourcesHub;
    private readonly IHubContext<StudentsHub> _studentsHub;
    private readonly IHubContext<EnrollmentHub> _enrollmentHub;
    private readonly IHubContext<ThesisHub> _thesisHub;
    private readonly AppDbContext _db;

    public DataUpdateService(
        IHubContext<DataHub> hub, 
        IHubContext<GradesHub> gradesHub,
        IHubContext<ActivitiesHub> activitiesHub,
        IHubContext<ExamsHub> examsHub,
        IHubContext<ScheduleHub> scheduleHub,
        IHubContext<SurveysHub> surveysHub,
        IHubContext<ResourcesHub> resourcesHub,
        IHubContext<StudentsHub> studentsHub,
        IHubContext<EnrollmentHub> enrollmentHub,
        IHubContext<ThesisHub> thesisHub,
        AppDbContext db)
    {
        _hub = hub;
        _gradesHub = gradesHub;
        _activitiesHub = activitiesHub;
        _examsHub = examsHub;
        _scheduleHub = scheduleHub;
        _surveysHub = surveysHub;
        _resourcesHub = resourcesHub;
        _studentsHub = studentsHub;
        _enrollmentHub = enrollmentHub;
        _thesisHub = thesisHub;
        _db = db;
    }

    public async Task NotifyStudentUpdated(string studentId, string? email = null)
    {
        var payload = new { type = "student.updated", studentId, email };

        // Notify specific user if email provided
        if (!string.IsNullOrWhiteSpace(email))
        {
            var normalizedEmail = email.Trim().ToLowerInvariant();
            await _hub.Clients.Group($"user:{normalizedEmail}").SendAsync("DataUpdated", payload);
            await _studentsHub.Clients.Group($"user:{normalizedEmail}").SendAsync("StudentUpdated", new { studentId, email });
        }

        // Also notify all users in the students group
        await _hub.Clients.Group("students").SendAsync("DataUpdated", payload);
        await _studentsHub.Clients.Group("students").SendAsync("StudentUpdated", new { studentId, email });
        
        // Also notify all teachers (they may be viewing student management)
        await _hub.Clients.Group("teachers").SendAsync("DataUpdated", payload);
        await _studentsHub.Clients.Group("teachers").SendAsync("StudentUpdated", new { studentId, email });
    }

    public async Task NotifyFacultyUpdated(string? email = null)
    {
        var payload = new { type = "faculty.updated", email };

        // Notify specific user if email provided
        if (!string.IsNullOrWhiteSpace(email))
        {
            var normalizedEmail = email.Trim().ToLowerInvariant();
            await _hub.Clients.Group($"user:{normalizedEmail}").SendAsync("DataUpdated", payload);
        }

        // Notify all teachers
        await _hub.Clients.Group("teachers").SendAsync("DataUpdated", payload);
    }

    public async Task NotifyEnrollmentUpdated(string? studentId = null, string? courseCode = null, string? teacherEmail = null)
    {
        var payload = new { type = "enrollment.updated", studentId, courseCode, teacherEmail };

        // Notify specific user if studentId/email provided
        if (!string.IsNullOrWhiteSpace(studentId))
        {
            await _hub.Clients.Group($"student:{studentId}").SendAsync("DataUpdated", payload);
            await _enrollmentHub.Clients.Group($"student:{studentId}").SendAsync("EnrollmentUpdated", new { studentId, courseCode, teacherEmail });
        }

        // Notify teacher if provided
        if (!string.IsNullOrWhiteSpace(teacherEmail))
        {
            var normalizedEmail = teacherEmail.Trim().ToLowerInvariant();
            await _hub.Clients.Group($"user:{normalizedEmail}").SendAsync("DataUpdated", payload);
            await _enrollmentHub.Clients.Group($"user:{normalizedEmail}").SendAsync("EnrollmentUpdated", new { studentId, courseCode, teacherEmail });
        }

        // Notify course group if provided
        if (!string.IsNullOrWhiteSpace(courseCode))
        {
            await _hub.Clients.Group($"course:{courseCode}").SendAsync("DataUpdated", payload);
            await _enrollmentHub.Clients.Group($"course:{courseCode}").SendAsync("EnrollmentUpdated", new { studentId, courseCode, teacherEmail });
        }

        // Notify all users
        await _hub.Clients.All.SendAsync("DataUpdated", payload);
        await _enrollmentHub.Clients.All.SendAsync("EnrollmentUpdated", new { studentId, courseCode, teacherEmail });
    }

    public async Task NotifyGradeUpdated(string? studentId = null, string? courseCode = null, string? teacherEmail = null)
    {
        var payload = new { type = "grade.updated", studentId, courseCode, teacherEmail };

        // Notify specific user if studentId provided
        if (!string.IsNullOrWhiteSpace(studentId))
        {
            await _hub.Clients.Group($"student:{studentId}").SendAsync("DataUpdated", payload);
            await _gradesHub.Clients.Group($"student:{studentId}").SendAsync("GradeUpdated", new { studentId, courseCode, teacherEmail });
        }

        // Notify teacher if provided
        if (!string.IsNullOrWhiteSpace(teacherEmail))
        {
            var normalizedEmail = teacherEmail.Trim().ToLowerInvariant();
            await _hub.Clients.Group($"user:{normalizedEmail}").SendAsync("DataUpdated", payload);
            await _gradesHub.Clients.Group($"user:{normalizedEmail}").SendAsync("GradeUpdated", new { studentId, courseCode, teacherEmail });
        }

        // Notify course group if provided
        if (!string.IsNullOrWhiteSpace(courseCode))
        {
            await _hub.Clients.Group($"course:{courseCode}").SendAsync("DataUpdated", payload);
            await _gradesHub.Clients.Group($"course:{courseCode}").SendAsync("GradeUpdated", new { studentId, courseCode, teacherEmail });
        }

        // Also notify all teachers for grade updates
        await _hub.Clients.Group("teachers").SendAsync("DataUpdated", payload);
        await _gradesHub.Clients.Group("teachers").SendAsync("GradeUpdated", new { studentId, courseCode, teacherEmail });
    }

    public async Task NotifyScheduleUpdated(string? teacherEmail = null, string? courseCode = null)
    {
        var payload = new { type = "schedule.updated", teacherEmail, courseCode };

        // Notify teacher if provided
        if (!string.IsNullOrWhiteSpace(teacherEmail))
        {
            var normalizedEmail = teacherEmail.Trim().ToLowerInvariant();
            await _hub.Clients.Group($"user:{normalizedEmail}").SendAsync("DataUpdated", payload);
            await _scheduleHub.Clients.Group($"user:{normalizedEmail}").SendAsync("ScheduleUpdated", new { teacherEmail, courseCode });
        }

        // Notify course group if provided
        if (!string.IsNullOrWhiteSpace(courseCode))
        {
            await _hub.Clients.Group($"course:{courseCode}").SendAsync("DataUpdated", payload);
            await _scheduleHub.Clients.Group($"course:{courseCode}").SendAsync("ScheduleUpdated", new { teacherEmail, courseCode });
        }

        // Notify all teachers
        await _hub.Clients.Group("teachers").SendAsync("DataUpdated", payload);
        await _scheduleHub.Clients.Group("teachers").SendAsync("ScheduleUpdated", new { teacherEmail, courseCode });

        // Also notify all students (they may need to see schedule updates)
        await _hub.Clients.Group("students").SendAsync("DataUpdated", payload);
        await _scheduleHub.Clients.Group("students").SendAsync("ScheduleUpdated", new { teacherEmail, courseCode });
    }

    public async Task NotifyAssignmentUpdated(string? courseCode = null, string? teacherEmail = null)
    {
        var payload = new { type = "assignment.updated", courseCode, teacherEmail };

        // Notify teacher if provided
        if (!string.IsNullOrWhiteSpace(teacherEmail))
        {
            var normalizedEmail = teacherEmail.Trim().ToLowerInvariant();
            await _hub.Clients.Group($"user:{normalizedEmail}").SendAsync("DataUpdated", payload);
        }

        // Notify course group if provided
        if (!string.IsNullOrWhiteSpace(courseCode))
        {
            await _hub.Clients.Group($"course:{courseCode}").SendAsync("DataUpdated", payload);
        }

        // Also notify all teachers for assignment updates
        await _hub.Clients.Group("teachers").SendAsync("DataUpdated", payload);

        // Also notify all students (they may need to see assignment updates for enrollment readiness)
        await _hub.Clients.Group("students").SendAsync("DataUpdated", payload);
    }

    public async Task NotifyActivityCreatedAsync(string userEmail, string activityId, CancellationToken ct = default)
    {
        // Read the activity from database to send full details
        var activity = await GetActivityByIdAsync(activityId, ct);
        if (activity == null) return;

        var activityPayload = new
        {
            activity.Id,
            activity.Type,
            activity.Title,
            activity.Description,
            activity.Subject,
            activity.ClassId,
            activity.CourseCode,
            activity.TeacherEmail,
            activity.TeacherDisplay,
            activity.StudentEmail,
            activity.StudentName,
            activity.Room,
            activity.Location,
            activity.AssignmentId,
            activity.Timestamp,
            activity.RequiresAction,
            activity.Priority,
            Meta = ParseMetaJson(activity.MetaJson),
            activity.CreatedByEmail,
            activity.CreatedAt,
            activity.UpdatedAt,
            activity.IsResolved,
            activity.IsArchived
        };

        var payload = new
        {
            type = "activity_created",
            activityId,
            activity = activityPayload
        };

        // Notify specific user
        if (!string.IsNullOrWhiteSpace(userEmail))
        {
            var normalizedEmail = userEmail.Trim().ToLowerInvariant();
            await _hub.Clients.Group($"user:{normalizedEmail}").SendAsync("DataUpdated", payload);
            await _activitiesHub.Clients.Group($"user:{normalizedEmail}").SendAsync("ActivityCreated", activityPayload);
        }
    }

    private async Task<ActivityEntity?> GetActivityByIdAsync(string activityId, CancellationToken ct)
    {
        return await _db.Activities
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == activityId, ct);
    }

    private object? ParseMetaJson(string? metaJson)
    {
        if (string.IsNullOrWhiteSpace(metaJson)) return null;
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<object>(metaJson);
        }
        catch
        {
            return null;
        }
    }

    public async Task NotifyKnowledgeBaseUpdated(string articleId, string action)
    {
        var payload = new { type = "knowledgebase.updated", articleId, action };

        // Notify all users (Knowledge Base is public)
        await _hub.Clients.All.SendAsync("DataUpdated", payload);
    }

    public async Task NotifyChangelogUpdated(string entryId, string action)
    {
        var payload = new { type = "changelog.updated", entryId, action };

        // Notify all users (Changelog is public)
        await _hub.Clients.All.SendAsync("DataUpdated", payload);
    }

    public async Task NotifyRoomUpdated(int? roomId = null, string? action = null)
    {
        var payload = new { type = "room.updated", roomId, action };

        // Notify all teachers (they manage rooms)
        await _hub.Clients.Group("teachers").SendAsync("DataUpdated", payload);
        await _resourcesHub.Clients.Group("teachers").SendAsync("ResourceUpdated", new { resourceType = "room", roomId, action });
    }

    public async Task NotifyEquipmentUpdated(int? equipmentId = null, string? action = null)
    {
        var payload = new { type = "equipment.updated", equipmentId, action };

        // Notify all teachers (they manage equipment)
        await _hub.Clients.Group("teachers").SendAsync("DataUpdated", payload);
        await _resourcesHub.Clients.Group("teachers").SendAsync("ResourceUpdated", new { resourceType = "equipment", equipmentId, action });
    }

    public async Task NotifySurveyUpdated(string? surveyId = null, string? action = null)
    {
        var payload = new { type = "survey.updated", surveyId, action };

        // Notify all users (surveys are visible to both students and teachers)
        await _hub.Clients.All.SendAsync("DataUpdated", payload);
        await _surveysHub.Clients.All.SendAsync("SurveyUpdated", new { surveyId, action });
    }

    public async Task NotifyExamTermUpdated(string? termId = null, string? action = null, string? courseCode = null)
    {
        var payload = new { type = "exam.updated", termId, action, courseCode };

        // Notify all students (they can view and register for exam terms)
        await _hub.Clients.Group("students").SendAsync("DataUpdated", payload);
        await _examsHub.Clients.Group("students").SendAsync("ExamTermUpdated", new { termId, action, courseCode });

        // Notify all teachers (they manage exam terms)
        await _hub.Clients.Group("teachers").SendAsync("DataUpdated", payload);
        await _examsHub.Clients.Group("teachers").SendAsync("ExamTermUpdated", new { termId, action, courseCode });
    }

    public async Task NotifyThesisUpdated(string? thesisId = null, string? action = null, string? studentEmail = null, string? supervisorEmail = null)
    {
        var payload = new { type = "thesis.updated", thesisId, action, studentEmail, supervisorEmail };

        // Notify student if provided
        if (!string.IsNullOrWhiteSpace(studentEmail))
        {
            var normalizedEmail = studentEmail.Trim().ToLowerInvariant();
            await _hub.Clients.Group($"user:{normalizedEmail}").SendAsync("DataUpdated", payload);
            await _thesisHub.Clients.Group($"user:{normalizedEmail}").SendAsync("ThesisUpdated", new { thesisId, action });
        }

        // Notify supervisor if provided
        if (!string.IsNullOrWhiteSpace(supervisorEmail))
        {
            var normalizedEmail = supervisorEmail.Trim().ToLowerInvariant();
            await _hub.Clients.Group($"user:{normalizedEmail}").SendAsync("DataUpdated", payload);
            await _thesisHub.Clients.Group($"user:{normalizedEmail}").SendAsync("ThesisUpdated", new { thesisId, action });
        }

        // Also notify all teachers and students (for topic browsing)
        await _hub.Clients.Group("teachers").SendAsync("DataUpdated", payload);
        await _hub.Clients.Group("students").SendAsync("DataUpdated", payload);
        await _thesisHub.Clients.Group("teachers").SendAsync("ThesisUpdated", new { thesisId, action });
        await _thesisHub.Clients.Group("students").SendAsync("ThesisUpdated", new { thesisId, action });
    }

    public async Task NotifyDocumentUpdated(string? documentId = null, string? action = null, string? ownerEmail = null)
    {
        var payload = new { type = "document.updated", documentId, action };

        // Notify document owner if provided
        if (!string.IsNullOrWhiteSpace(ownerEmail))
        {
            var normalizedEmail = ownerEmail.Trim().ToLowerInvariant();
            await _hub.Clients.Group($"user:{normalizedEmail}").SendAsync("DataUpdated", payload);
        }
    }

    public async Task NotifyClassGroupUpdated(string groupId, string action, string? teacherEmail = null)
    {
        var payload = new { type = "classgroup.updated", groupId, action, teacherEmail };

        // Notify specific teacher if provided
        if (!string.IsNullOrWhiteSpace(teacherEmail))
        {
            var normalizedEmail = teacherEmail.Trim().ToLowerInvariant();
            await _hub.Clients.Group($"user:{normalizedEmail}").SendAsync("DataUpdated", payload);
        }

        // Notify all teachers (they can manage class groups)
        await _hub.Clients.Group("teachers").SendAsync("DataUpdated", payload);

        // Also notify students (they may view class groups)
        await _hub.Clients.Group("students").SendAsync("DataUpdated", payload);
    }

    public async Task NotifyNewsUpdated(int? newsId = null, string? action = null)
    {
        var payload = new { type = "news.updated", newsId, action };

        // News is visible to everyone, notify all connected users
        await _hub.Clients.All.SendAsync("DataUpdated", payload);
    }
}
