using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mais.Web.Entities;

public class ChatMessageEntity
{
    [Key]
    [MaxLength(60)]
    public string Id { get; set; } = default!;

    [Required]
    [MaxLength(40)]
    public string ThreadId { get; set; } = default!;

    [MaxLength(200)]
    public string? AuthorEmail { get; set; }

    [MaxLength(16)]
    public string AuthorRole { get; set; } = string.Empty;

    [MaxLength(200)]
    public string AuthorDisplayName { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public bool Announcement { get; set; }

    [MaxLength(60)]
    public string? ReplyToId { get; set; }

    [MaxLength(60)]
    public string? ClientId { get; set; }

    public bool TargetAi { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    [ForeignKey(nameof(ThreadId))]
    public ChatThreadEntity? Thread { get; set; }

    public ICollection<ChatAttachmentEntity> Attachments { get; set; } = new List<ChatAttachmentEntity>();

    public ICollection<ChatReactionEntity> Reactions { get; set; } = new List<ChatReactionEntity>();
}

