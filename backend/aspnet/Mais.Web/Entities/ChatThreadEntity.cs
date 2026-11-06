using System.ComponentModel.DataAnnotations;

namespace Mais.Web.Entities;

public class ChatThreadEntity
{
    [Key]
    [MaxLength(40)]
    public string Id { get; set; } = default!;

    [Required]
    [MaxLength(200)]
    public string OwnerEmail { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? LastMessageAt { get; set; }

    [MaxLength(400)]
    public string? LastMessagePreview { get; set; }

    public bool AiEnabled { get; set; }

    public string? AiConfigJson { get; set; }

    public ICollection<ChatParticipantEntity> Participants { get; set; } = new List<ChatParticipantEntity>();

    public ICollection<ChatMessageEntity> Messages { get; set; } = new List<ChatMessageEntity>();

    public ICollection<ChatUserStateEntity> UserStates { get; set; } = new List<ChatUserStateEntity>();
}

