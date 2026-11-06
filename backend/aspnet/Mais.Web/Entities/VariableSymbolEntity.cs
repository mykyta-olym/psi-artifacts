namespace Mais.Web.Entities;

public class VariableSymbolEntity
{
    public string Id { get; set; } = string.Empty;
    public string StudentId { get; set; } = string.Empty; // FK to Students.Id
    public string Symbol { get; set; } = string.Empty;
    public string Purpose { get; set; } = string.Empty; // e.g., "Tuition", "Accommodation", "Other"
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public string? CreatedAt { get; set; }
}
