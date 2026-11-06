using System.ComponentModel.DataAnnotations;

namespace Mais.Web.Entities;

public class ThesisSupervisionEntity
{
    [Key]
    [MaxLength(100)]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [MaxLength(100)]
    public string? TopicId { get; set; }

    [MaxLength(32)]
    public string Type { get; set; } = "Bachelor thesis";

    [MaxLength(400)]
    public string Title { get; set; } = string.Empty;

    // Student
    [MaxLength(100)]
    public string? StudentId { get; set; }
    [MaxLength(200)]
    public string StudentEmail { get; set; } = string.Empty;
    [MaxLength(200)]
    public string? StudentName { get; set; }

    // Supervisor
    [MaxLength(200)]
    public string SupervisorEmail { get; set; } = string.Empty;
    [MaxLength(200)]
    public string? SupervisorName { get; set; }

    [MaxLength(120)]
    public string? Program { get; set; }
    [MaxLength(8)]
    public string? Degree { get; set; } // BSc/MSc label used in UI
    [MaxLength(20)]
    public string AcademicYear { get; set; } = string.Empty;

    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DueAt { get; set; }

    [MaxLength(16)]
    public string Status { get; set; } = "assigned"; // assigned|submitted|defense|graded

    public string? AttachmentsJson { get; set; }
    public string? KeywordsJson { get; set; }

    public string? Abstract { get; set; }
    public string? Annotation { get; set; }

    // Originality
    public DateTime? OriginalityCheckedAt { get; set; }
    public double? OriginalityPercentage { get; set; }
    public string? OriginalityProtocolUrl { get; set; }

    // Defense
    public string? DefenseDate { get; set; } // store as string to allow date or datetime
    public string? DefenseRoom { get; set; }

    public string? GradesJson { get; set; }
}
