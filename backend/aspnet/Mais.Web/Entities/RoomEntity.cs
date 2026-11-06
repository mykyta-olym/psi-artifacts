namespace Mais.Web.Entities;

public class RoomEntity
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Type { get; set; }
    public int? Capacity { get; set; }
    public string? Link { get; set; }
    public string? Email { get; set; }
    public string? Location { get; set; }
    public string? Building { get; set; }
    public string? Floor { get; set; }
    public string? Description { get; set; }
    public bool Active { get; set; } = true;
    public string? Faculty { get; set; } // FEI, FBERG, etc. - which faculty manages this room
    
    // Reservation fields
    public DateTime? NextBookingStart { get; set; }
    public DateTime? NextBookingEnd { get; set; }
    public string? ReservedBy { get; set; }
}
