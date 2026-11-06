namespace Mais.Web.Models.Documents;

public class DocumentRenderModel
{
    public string TemplateKey { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string DateOfBirth { get; set; } = string.Empty;
    public string PlaceOfBirth { get; set; } = string.Empty;
    public string NationalId { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Program { get; set; } = string.Empty;
    public string Faculty { get; set; } = string.Empty;
    public string StudyForm { get; set; } = string.Empty;
    public string StudyLevel { get; set; } = string.Empty;
    public string Year { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string StudentId { get; set; } = string.Empty;
    public string IssuedAt { get; set; } = string.Empty;
    public string ValidUntil { get; set; } = string.Empty;
    public string AccommodationAddress { get; set; } = string.Empty;
    public string AccommodationFrom { get; set; } = string.Empty;
    public string AccommodationTo { get; set; } = string.Empty;
    public string UpsvarPurpose { get; set; } = string.Empty;
    public string Language { get; set; } = "en";
    public bool IncludeQr { get; set; } = true;
    public bool IncludeWatermark { get; set; } = true;
}
