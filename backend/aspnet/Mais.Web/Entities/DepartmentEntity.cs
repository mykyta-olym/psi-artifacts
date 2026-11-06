namespace Mais.Web.Entities;

public class DepartmentEntity
{
    public string Id { get; set; } = string.Empty; // e.g., "dept-fei-kpi"
    public string Name { get; set; } = string.Empty; // e.g., "Katedra počítačov a informatiky"
    public string Code { get; set; } = string.Empty; // e.g., "FEI-KPI" - used as FK in other entities
    public string Faculty { get; set; } = string.Empty; // Faculty code: FEI, FBERG, SjF, TUKE
    public bool Active { get; set; } = true;
    public int TeachersCount { get; set; } = 0; // Computed: number of teachers in this department
}
