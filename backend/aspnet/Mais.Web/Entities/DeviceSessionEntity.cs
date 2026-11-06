namespace Mais.Web.Entities;

public class DeviceSessionEntity
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty; // Email or StudentId
    public string DeviceName { get; set; } = string.Empty;
    public string DeviceType { get; set; } = string.Empty; // "Desktop", "Mobile", "Tablet"
    public string Browser { get; set; } = string.Empty;
    public string Os { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string LastActivity { get; set; } = string.Empty; // ISO datetime
    public string CreatedAt { get; set; } = string.Empty; // ISO datetime
    public bool IsCurrent { get; set; } = false;
}
