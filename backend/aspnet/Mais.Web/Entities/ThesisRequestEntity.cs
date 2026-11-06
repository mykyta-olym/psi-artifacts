using System.ComponentModel.DataAnnotations;

namespace Mais.Web.Entities;

public class ThesisRequestEntity
{
    [Key]
    [MaxLength(100)]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [MaxLength(20)]
    public string AcademicYear { get; set; } = string.Empty; // e.g., 2025/2026

    [MaxLength(8)]
    public string Degree { get; set; } = "bsc"; // bsc|msc

    [MaxLength(20)]
    public string StudyForm { get; set; } = "full-time";

    [MaxLength(120)]
    public string Program { get; set; } = string.Empty; // label or code shown to user

    [MaxLength(40)]
    public string? ProgramCode { get; set; }

    [MaxLength(8)]
    public string Language { get; set; } = "EN";

    [MaxLength(200)]
    public string? SupervisorEmail { get; set; }

    [MaxLength(400)]
    public string? Topic { get; set; }

    [MaxLength(400)]
    public string? Keywords { get; set; }

    public string? Note { get; set; }

    [MaxLength(16)]
    public string Status { get; set; } = "draft"; // draft|submitted|returned|approved|rejected|canceled

    public DateTime? SubmittedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Student identity
    [MaxLength(100)]
    public string? StudentId { get; set; }

    [MaxLength(200)]
    public string StudentEmail { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? StudentName { get; set; }
}
