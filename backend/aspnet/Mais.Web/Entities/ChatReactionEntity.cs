using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mais.Web.Entities;

public class ChatReactionEntity
{
    [Key]
    [MaxLength(70)]
    public string Id { get; set; } = default!;

    [Required]
    [MaxLength(60)]
    public string MessageId { get; set; } = default!;

    [Required]
    [MaxLength(32)]
    public string Emoji { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string UserEmail { get; set; } = default!;

    public DateTime CreatedAt { get; set; }

    [ForeignKey(nameof(MessageId))]
    public ChatMessageEntity? Message { get; set; }
}

