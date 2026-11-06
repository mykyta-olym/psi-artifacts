namespace Mais.Web.Entities;

/// <summary>
/// Tracks reservations for rooms and equipment
/// Links to timetable events to prevent conflicts
/// </summary>
public class ResourceReservationEntity
{
    public string Id { get; set; } = string.Empty;
    
    // Resource info
    public string ResourceType { get; set; } = string.Empty; // "room" or "equipment"
    public string ResourceId { get; set; } = string.Empty;
    public string ResourceName { get; set; } = string.Empty;
    
    // Reservation details
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string ReservedBy { get; set; } = string.Empty; // Teacher email
    public string ReservedByName { get; set; } = string.Empty;
    
    // Link to timetable
    public string? TimetableEventId { get; set; }
    public string? CourseCode { get; set; }
    public string? CourseName { get; set; }
    
    // Metadata
    public string Status { get; set; } = "active"; // active, cancelled, completed
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
