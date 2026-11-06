namespace Mais.Web.Models;

public class StudentCreateRequest
{
    public string? Id { get; set; }
    public string? StudentId { get; set; }
    public string? PersonId { get; set; }
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? GivenName { get; set; }
    public string? FamilyName { get; set; }
    public string? FullName { get; set; }
    public List<string>? TitlesPrefix { get; set; }
    public List<string>? TitlesSuffix { get; set; }
    public string? Faculty { get; set; }
    public string? Program { get; set; }
    public int? StudyYear { get; set; }
    public string? GradeKey { get; set; }

    // Extended optional fields
    public string? Phone { get; set; }
    public string? Phone2 { get; set; }
    public string? AltEmail { get; set; }
    public string? Address { get; set; }

    public string? ClassName { get; set; }
    public string? IsicCardNumber { get; set; }
    public string? StudentNumber { get; set; }
    public string? StudyNumber { get; set; }
    public string? PassportId { get; set; }
    public string? BirthDate { get; set; }
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
    public bool? IsArchived { get; set; }
}
