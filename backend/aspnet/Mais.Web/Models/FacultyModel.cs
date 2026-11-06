namespace Mais.Web.Models;

public class FacultyModel
{
    public string Id { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public List<string> TitlesPrefix { get; set; } = new();
    public List<string> TitlesSuffix { get; set; } = new();
    public string? GivenName { get; set; }
    public string? FamilyName { get; set; }
    public string Faculty { get; set; } = "";
    public string? Program { get; set; }
    public string? Department { get; set; }
    public string? DepartmentCode { get; set; }
    public List<string> Departments { get; set; } = new();
    public string? PrimaryDepartment { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Office { get; set; }
    public string? Status { get; set; }
    public string? EmploymentType { get; set; }
    public int? ClassesCount { get; set; }
    public int? YearsExperience { get; set; }
    public string? HireDate { get; set; }
    public string? LastActivity { get; set; }
    public double? Rating { get; set; }
    public List<string> Subjects { get; set; } = new();
    public object? Certifications { get; set; }
    public Dictionary<string, object>? OfficeHours { get; set; }
    public Dictionary<string, object>? WorkingHours { get; set; }
    public string? About { get; set; }
    public string? Bio { get; set; }
    public List<string>? Expertise { get; set; }
    public object? Publications { get; set; }
    public List<string>? ResearchInterests { get; set; }
    public string? AcademicDegree { get; set; }
    public object? Languages { get; set; }
    public object? SocialLinks { get; set; }
    public string? AvatarUrl { get; set; }
}
