namespace Mais.Web.Entities;

public class PasswordResetEntity
{
    public string Id { get; set; } = string.Empty; // PK
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty; // JWT token for reset link
    public string Code { get; set; } = string.Empty; // 6-digit OTP code
    public DateTime ExpiresAt { get; set; }
    public bool Used { get; set; } = false;
    public int Attempts { get; set; } = 0; // Track verification attempts
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

