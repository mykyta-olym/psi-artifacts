namespace Mais.Web.Entities;

public class TimetableEntryEntity
{
    public string Id { get; set; } = string.Empty; // e.g., "tt-26001198-mon-p"
    public string Day { get; set; } = string.Empty; // Monday, Tuesday, etc.
    public string Slot { get; set; } = string.Empty; // e.g., "09:10-10:50"
    public string CourseCode { get; set; } = string.Empty; // FK to Courses.Code
    public string Room { get; set; } = string.Empty; // FK to Rooms.Id
    public string TeacherEmail { get; set; } = string.Empty; // FK to Faculty.Email
    public string? Type { get; set; } // P (Lecture), S (Seminar), CL (Lab/Class), etc.
    public string? Note { get; set; }
    public int? Capacity { get; set; }
    public string? ClassGroupKeysJson { get; set; } // JSON array of ClassGroups.Id
    public string? Faculty { get; set; } // Faculty code (e.g., "FEI")
    public string? Program { get; set; } // Program name (e.g., "Cybersecurity")
    public int? RequiredYear { get; set; } // Minimum study year required (1-5), null means available for all years
}
