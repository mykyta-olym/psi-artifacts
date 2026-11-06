namespace Mais.Web.Entities;

public class CourseEntity
{
    public string Code { get; set; } = string.Empty; // Primary key (e.g., "26001198")
    public string? NameSk { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string? CompletionSk { get; set; }
    public int Credits { get; set; }
    public string? TypeSk { get; set; }
    public string? Profile { get; set; }
    public string? HoursSk { get; set; }
    public string? PeriodSk { get; set; }
    public string? Faculty { get; set; } // Faculty code (e.g., "FEI")
    public string? Program { get; set; } // Program name (e.g., "Cybersecurity")
    public string? Department { get; set; } // Department code FK (e.g., "FEI-KPI") -> Departments.Code
    public int? RequiredYear { get; set; } // Minimum study year required to access this course (1-5)
}
