namespace Mais.Web.Entities;

public class StudentEnrollmentEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string StudentId { get; set; } = string.Empty; // FK to Students.Id
    public string CourseCode { get; set; } = string.Empty; // FK to Courses.Code
    public string? ScheduleEventId { get; set; } // FK to TimetableEntries.Id
    public string Status { get; set; } = "Confirmed"; // Confirmed, Pending, Cancelled
    public string? AcademicYear { get; set; } // e.g. 2025/2026
    public string? Semester { get; set; } // WS/SS
    public DateTime ConfirmedAt { get; set; } = DateTime.UtcNow;
}
