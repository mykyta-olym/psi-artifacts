using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mais.Web.Entities;

/// <summary>
/// Represents an attendance record for a student in a class session.
/// </summary>
[Table("Attendance")]
public class AttendanceEntity
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// Course code (FK to Courses.Code)
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string CourseCode { get; set; } = string.Empty;

    /// <summary>
    /// Student ID (FK to Students.Id)
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string StudentId { get; set; } = string.Empty;

    /// <summary>
    /// Student email (denormalized for convenience)
    /// </summary>
    [MaxLength(255)]
    public string? StudentEmail { get; set; }

    /// <summary>
    /// Teacher email who recorded the attendance (FK to Faculty.Email)
    /// </summary>
    [Required]
    [MaxLength(255)]
    public string TeacherEmail { get; set; } = string.Empty;

    /// <summary>
    /// Date of the session (YYYY-MM-DD)
    /// </summary>
    [Required]
    public DateOnly SessionDate { get; set; }

    /// <summary>
    /// Time slot of the session (e.g., "09:10-10:50")
    /// </summary>
    [MaxLength(20)]
    public string? TimeSlot { get; set; }

    /// <summary>
    /// Room where the session took place (FK to Rooms.Id)
    /// </summary>
    [MaxLength(100)]
    public string? Room { get; set; }

    /// <summary>
    /// Attendance status: present, absent, late, excused
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "present";

    /// <summary>
    /// Optional notes about the attendance
    /// </summary>
    [MaxLength(500)]
    public string? Notes { get; set; }

    /// <summary>
    /// Class group key (FK to ClassGroups.Id)
    /// </summary>
    [MaxLength(50)]
    public string? ClassGroupKey { get; set; }

    /// <summary>
    /// When the record was created
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When the record was last updated
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
