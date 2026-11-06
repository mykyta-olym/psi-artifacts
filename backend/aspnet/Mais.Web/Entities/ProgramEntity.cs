namespace Mais.Web.Entities;

public class ProgramEntity
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Faculty { get; set; } = string.Empty; // FEI, FBERG, etc.
    public string? DepartmentId { get; set; } // Optional: which department owns this program
    public string Level { get; set; } = string.Empty; // Bachelor, Master, PhD
    public int DurationYears { get; set; } = 3; // How many years this program level takes (Bachelor=3, Master=2, etc.)
    public string? AwardedDegree { get; set; } // e.g., "Bc.", "Ing.", "PhD."
    public string? Description { get; set; }
    public bool Active { get; set; } = true;
}
