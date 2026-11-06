namespace Mais.Web.Entities;

public class FacultyOptionEntity
{
    public string Id { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty; // FEI, FBERG, SjF, TUKE
    public string NameEn { get; set; } = string.Empty;
    public string NameSk { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool Active { get; set; } = true;
}
