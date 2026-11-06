namespace Mais.Web.Entities;

public class EquipmentEntity
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = "available";
    public string? RoomId { get; set; } // FK to Rooms.Id - where the equipment is located
    public string? Location { get; set; } // Display name of location (denormalized for convenience)
    public string? AssignedTo { get; set; }
    
    // Reservation fields
    public DateTime? NextBookingStart { get; set; }
    public DateTime? NextBookingEnd { get; set; }
    public string? ReservedBy { get; set; }
}
