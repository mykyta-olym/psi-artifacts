namespace Mais.Web.Models;

public class CourseModel
{
    public string Id { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? NameSk { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string? CompletionSk { get; set; }
    public int Credits { get; set; }
    public string? TypeSk { get; set; }
    public string? Profile { get; set; }
    public string? HoursSk { get; set; }
    public string? PeriodSk { get; set; }
    public string? Faculty { get; set; }
    public string? Program { get; set; }
    public int? RequiredYear { get; set; } // Minimum study year required (1-5)
}
