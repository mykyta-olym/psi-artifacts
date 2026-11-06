using System.Collections.Generic;

namespace Mais.Web.Models;

public class FacultyCreateRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? GivenName { get; set; }
    public string? FamilyName { get; set; }
    public string? FullName { get; set; }
    public List<string>? TitlesPrefix { get; set; }
    public List<string>? TitlesSuffix { get; set; }
    public string? Email { get; set; }
    public string? Faculty { get; set; }
    public string? Program { get; set; }
    public List<string>? Departments { get; set; }
    public string? Department { get; set; }
    public string? PrimaryDepartment { get; set; }
    public List<string>? Subjects { get; set; }
    public string? Phone { get; set; }
    public string? Office { get; set; }
    public Dictionary<string, object>? OfficeHours { get; set; }
    public Dictionary<string, object>? WorkingHours { get; set; }
    public string? Status { get; set; }
    public string? EmploymentType { get; set; }
    public int? ClassesCount { get; set; }
    public int? YearsExperience { get; set; }
    public string? HireDate { get; set; }
    public string? LastActivity { get; set; }
    public string? About { get; set; }
    public string? AvatarUrl { get; set; }
}


