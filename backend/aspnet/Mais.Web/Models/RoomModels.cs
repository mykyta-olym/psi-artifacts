namespace Mais.Web.Models;

public class RoomModel
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
    
    // Reservation fields
    public DateTime? NextBookingStart { get; set; }
    public DateTime? NextBookingEnd { get; set; }
    public string? ReservedBy { get; set; }
    public bool IsAvailable { get; set; } = true;
}

public class CreateRoomRequest
{
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
}

public class UpdateRoomRequest
{
    public string? Name { get; set; }
    public string? Type { get; set; }
    public int? Capacity { get; set; }
    public string? Link { get; set; }
    public string? Email { get; set; }
    public string? Location { get; set; }
    public string? Building { get; set; }
    public string? Floor { get; set; }
    public string? Description { get; set; }
    public bool? Active { get; set; }
}

public class RoomsResponse
{
    public List<RoomModel> Rooms { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PerPage { get; set; }
    public int TotalPages { get; set; }
}
