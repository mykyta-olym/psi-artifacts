namespace Mais.Web.Models;

public class ScheduleEventModel
{
    public string Id { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string CourseCode { get; set; } = string.Empty;
    public string Teacher { get; set; } = string.Empty;
    public string? TeacherEmail { get; set; }
    public string Room { get; set; } = string.Empty;
    public string Day { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public int? StudentCount { get; set; }
    public bool? HasConflict { get; set; }
    public string? Notes { get; set; }
    public List<string> ClassGroupKeys { get; set; } = new();
}
