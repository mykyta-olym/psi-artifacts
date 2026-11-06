using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mais.Web.Entities;

public class ChatParticipantEntity
{
    [Key]
    [MaxLength(50)]
    public string Id { get; set; } = default!;

    [Required]
    [MaxLength(40)]
    public string ThreadId { get; set; } = default!;

    [MaxLength(16)]
    public string Kind { get; set; } = "student";

    [MaxLength(200)]
    public string? Email { get; set; }

    [MaxLength(200)]
    public string DisplayName { get; set; } = string.Empty;

    public DateTime JoinedAt { get; set; }

    public bool IsActive { get; set; } = true;

    [ForeignKey(nameof(ThreadId))]
    public ChatThreadEntity? Thread { get; set; }
}

