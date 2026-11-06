namespace Mais.Web.Models;

public class RosterItemModel
{
    public string StudentId { get; set; } = string.Empty;
    public string PersonId { get; set; } = string.Empty; // PersonId to handle students with multiple records (e.g., kb079if-bc and kb079if-ing)
    public string StudentEmail { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public string CourseCode { get; set; } = string.Empty;
    public string? ScheduleEventId { get; set; }
    public string? GroupKey { get; set; }
}
