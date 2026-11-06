namespace Mais.Web.Entities;

public class UserCredentialEntity
{
    public string Email { get; set; } = string.Empty; // PK
    public string Role { get; set; } = "student"; // "student" | "teacher"
    public string PasswordHash { get; set; } = string.Empty;
    public string? TemporaryPassword { get; set; } // Plain temporary password for retrieval (cleared after first login)
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
}
