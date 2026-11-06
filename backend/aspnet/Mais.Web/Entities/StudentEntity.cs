namespace Mais.Web.Entities;

public class StudentEntity
{
    public string Id { get; set; } = string.Empty;
    public string PersonId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Degree { get; set; }
    public string? GivenName { get; set; }
    public string? FamilyName { get; set; }
    public string? TitlesPrefixJson { get; set; }
    public string? TitlesSuffixJson { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Faculty { get; set; } = ""; // FK: Faculty code (e.g., "FEI")
    public string Program { get; set; } = ""; // Program name (e.g., "Cybersecurity")
    public string? ProgramId { get; set; } // FK to Programs.Id (e.g., "prog-cyb-ing")
    public int StudyYear { get; set; }
    public string? ClassGroupId { get; set; } // FK to ClassGroups.Id (e.g., "01-sk-FEI-CYB")

    // Extended profile fields (optional) — captured from Add Student modal and Profile page
    public string? Phone { get; set; }
    public string? Phone2 { get; set; }
    public string? AltEmail { get; set; }
    public string? Address { get; set; }
    public string? AvatarUrl { get; set; }

    // Student identifiers and personal data
    public string? ClassName { get; set; }
    public string? IsicCardNumber { get; set; }
    public string? StudentNumber { get; set; }
    public string? StudyNumber { get; set; }
    public string? PassportId { get; set; }
    public string? BirthDate { get; set; } // ISO yyyy-MM-dd
    public string? BirthPlace { get; set; }
    public string? Nationality { get; set; }
    public string? FamilyStatus { get; set; }
    public string? HealthStatus { get; set; }
    public string? ParentName { get; set; }
    public string? About { get; set; }
    public bool? ConsentPersonalData { get; set; }
    public bool? ConsentCompanyOffers { get; set; }
    public string? Status { get; set; }
    public string? LastActivity { get; set; }
    public bool IsArchived { get; set; }
    public string? EnrollmentSemester { get; set; } // e.g., "WT 2025/2026" or "ST 2025/2026" - the semester the student was enrolled for
    public string? EnrollmentDate { get; set; } // ISO date when student started this program (used for graduation eligibility calculation)
    public string? ProgramLevel { get; set; } // "Bachelor", "Master", "Doctoral" - cached from Programs table for performance
    
    // Graduation tracking
    public bool? ThesisApproved { get; set; }
    public string? ThesisApprovedDate { get; set; } // ISO date
    public bool? AllCreditsEarned { get; set; }
    public bool? AllGradesSubmitted { get; set; }
    public bool? GraduationEligible { get; set; }
    public string? GraduationDate { get; set; } // ISO date when degree was awarded
    public string? AwardedDegree { get; set; } // "Bc.", "Ing.", "Mgr.", etc.
    
    // Account activation
    public bool IsActivated { get; set; } = false;
    public string? ActivationToken { get; set; }
    public DateTime? ActivationTokenExpiry { get; set; }
    
    // Password management
    public string? PasswordHash { get; set; }
    public DateTime? LastPasswordChange { get; set; }
    public bool FirstLoginCompleted { get; set; } = false;
}
