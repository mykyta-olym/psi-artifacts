namespace Mais.Web.Models;

public class TimetableEntryModel
{
    public string Day { get; set; } = string.Empty;
    public string Slot { get; set; } = string.Empty; // "09:10-09:55"
    public string CourseCode { get; set; } = string.Empty;
    public string Room { get; set; } = string.Empty;
    public string TeacherEmail { get; set; } = string.Empty;
    public string? Note { get; set; }
}
