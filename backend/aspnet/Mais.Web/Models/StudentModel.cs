namespace Mais.Web.Models;

public class StudentModel
{
    public string Id { get; set; } = string.Empty;
    public string PersonId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Degree { get; set; }
    public string? GivenName { get; set; }
    public string? FamilyName { get; set; }
    public List<string> TitlesPrefix { get; set; } = new();
    public List<string> TitlesSuffix { get; set; } = new();
    public string Email { get; set; } = string.Empty;
    public string Faculty { get; set; } = "";
    public string Program { get; set; } = "";
    public int StudyYear { get; set; }
    public bool IsArchived { get; set; }
    
    // Contact information
    public string? Phone { get; set; }
    public string? Phone2 { get; set; }
    public string? AltEmail { get; set; }
    public string? Address { get; set; }
    
    // Student identifiers
    public string? ClassName { get; set; }
    public string? StudentNumber { get; set; }
    public string? StudyNumber { get; set; }
    public string? IsicCardNumber { get; set; }
    public string? PassportId { get; set; }
    
    // Personal details
    public string? BirthDate { get; set; }
    public string? BirthPlace { get; set; }
    public string? Nationality { get; set; }
    public string? FamilyStatus { get; set; }
    public string? HealthStatus { get; set; }
    public string? ParentName { get; set; }
    public string? About { get; set; }
    
    // Academic information
    public string? EnrollmentDate { get; set; }
    public string? ProgramLevel { get; set; }
    public string? AwardedDegree { get; set; }
    
    // Consents
    public bool ConsentPersonalData { get; set; }
    public bool ConsentCompanyOffers { get; set; }
}
