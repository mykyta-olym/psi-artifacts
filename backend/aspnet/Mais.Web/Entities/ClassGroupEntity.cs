namespace Mais.Web.Entities;

/// <summary>
/// Represents a class group with faculty, program, and student capacity management
/// </summary>
public class ClassGroupEntity
{
    /// <summary>
    /// Unique identifier (e.g., "01-sk-FEI-INF")
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Display name (e.g., "01. sk")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Faculty code (e.g., "FEI", "FEF", "SjF")
    /// </summary>
    public string Faculty { get; set; } = string.Empty;

    /// <summary>
    /// Program name (e.g., "Informatics", "Cybersecurity")
    /// </summary>
    public string Program { get; set; } = string.Empty;

    /// <summary>
    /// FK to Programs.Id (e.g., "prog-cyb-ing")
    /// </summary>
    public string? ProgramId { get; set; }

    /// <summary>
    /// What study year students in this group are (1-5)
    /// </summary>
    public int? StudyYear { get; set; }

    /// <summary>
    /// Maximum number of students (default 30)
    /// </summary>
    public int Capacity { get; set; } = 30;

    /// <summary>
    /// Current number of enrolled students
    /// </summary>
    public int StudentCount { get; set; } = 0;

    /// <summary>
    /// Teacher email who created or manages this group
    /// </summary>
    public string? TeacherEmail { get; set; }

    /// <summary>
    /// Additional notes or description
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Creation timestamp
    /// </summary>
    public string? CreatedAt { get; set; }

    /// <summary>
    /// Last update timestamp
    /// </summary>
    public string? UpdatedAt { get; set; }

    /// <summary>
    /// Whether this group is active
    /// </summary>
    public bool IsActive { get; set; } = true;
}
