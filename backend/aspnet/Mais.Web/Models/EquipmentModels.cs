namespace Mais.Web.Models;

public class EquipmentModel
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = "available";
    public string? Location { get; set; }
    public string? AssignedTo { get; set; }
    
    // Reservation fields
    public DateTime? NextBookingStart { get; set; }
    public DateTime? NextBookingEnd { get; set; }
    public string? ReservedBy { get; set; }
    public bool IsAvailable { get; set; } = true;
}

public class CreateEquipmentRequest
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = "available";
    public string Location { get; set; } = string.Empty;
    public string? AssignedTo { get; set; }
    public DateTime? NextBookingStart { get; set; }
    public DateTime? NextBookingEnd { get; set; }
}

public class UpdateEquipmentRequest
{
    public string? Name { get; set; }
    public string? Type { get; set; }
    public string? Status { get; set; }
    public string? Location { get; set; }
    public string? AssignedTo { get; set; }
    public DateTime? NextBookingStart { get; set; }
    public DateTime? NextBookingEnd { get; set; }
}

public class EquipmentResponse
{
    public List<EquipmentModel> Equipment { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PerPage { get; set; }
    public int TotalPages { get; set; }
}
