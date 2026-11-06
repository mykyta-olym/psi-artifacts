namespace Mais.Web.Models.Documents;

public class TeacherProfileDocumentModel
{
    public string TeacherId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Faculty { get; set; } = string.Empty;
    public string[] Departments { get; set; } = Array.Empty<string>();
    public string[] Subjects { get; set; } = Array.Empty<string>();
    public string? Office { get; set; }
    public string? Phone { get; set; }
    public string? EmploymentType { get; set; }
    public string? Status { get; set; }
    public int? ClassesCount { get; set; }
    public int? YearsExperience { get; set; }
    public string? HireDate { get; set; }
    public string? About { get; set; }
    public IReadOnlyCollection<TeacherProfileClassSummary> Classes { get; set; } = Array.Empty<TeacherProfileClassSummary>();
    public IReadOnlyCollection<TeacherProfileStudentSummary> Students { get; set; } = Array.Empty<TeacherProfileStudentSummary>();
    public string GeneratedAt { get; set; } = DateTime.UtcNow.ToString("o");
}

public class TeacherProfileClassSummary
{
    public string Name { get; set; } = string.Empty;
    public string Program { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int? Year { get; set; }
    public int StudentCount { get; set; }
}

public class TeacherProfileStudentSummary
{
    public string FullName { get; set; } = string.Empty;
    public string Program { get; set; } = string.Empty;
    public int? Year { get; set; }
    public string Email { get; set; } = string.Empty;
}
