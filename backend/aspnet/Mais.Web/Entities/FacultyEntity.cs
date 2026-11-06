namespace Mais.Web.Entities;

public class FacultyEntity
{
    public string Id { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? GivenName { get; set; }
    public string? FamilyName { get; set; }
    public string? TitlesPrefixJson { get; set; }
    public string? TitlesSuffixJson { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Faculty { get; set; } = string.Empty; // Faculty code (e.g., "FEI")
    public string? Program { get; set; } // e.g., "Cybersecurity", "Computer Science", etc.
    public string? Department { get; set; } // e.g., "Dekanát", "Katedra počítačov a informatiky"
    public string? DepartmentCode { get; set; } // e.g., "FEI-KPI"
    public string? DepartmentId { get; set; } // FK to Departments.Id (e.g., "dept-fei-kpi")
    public string? Phone { get; set; }
    public string? Office { get; set; } // Office room ID (e.g., "N9-015(ZP4)")
    public string? DepartmentsJson { get; set; }
    public string? SubjectsJson { get; set; } // JSON array of course codes this teacher teaches
    public string? CertificationsJson { get; set; }
    public string? OfficeHoursJson { get; set; }
    public string? WorkingHoursJson { get; set; }
    public string? Status { get; set; }
    public string? EmploymentType { get; set; }
    public int? ClassesCount { get; set; }
    public int? YearsExperience { get; set; }
    public string? HireDate { get; set; }
    public string? LastActivity { get; set; }
    public string? About { get; set; }
    public string? Bio { get; set; }
    public string? ExpertiseJson { get; set; } // JSON array of expertise areas
    public string? PublicationsJson { get; set; } // JSON array of publications
    public string? ResearchInterestsJson { get; set; } // JSON array of research interests
    public string? AcademicDegree { get; set; } // e.g., "PhD", "MSc", "BSc"
    public string? LanguagesJson { get; set; } // JSON array of language proficiency objects
    public string? SocialLinksJson { get; set; } // JSON object with social media links
    public string? AvatarUrl { get; set; }
    
    // Account activation
    public bool IsActivated { get; set; } = false;
    public string? ActivationToken { get; set; }
    public DateTime? ActivationTokenExpiry { get; set; }
    
    // Password management
    public string? PasswordHash { get; set; }
    public DateTime? LastPasswordChange { get; set; }
    public bool FirstLoginCompleted { get; set; } = false;
}
