using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mais.Web.Entities;

public class ChatAttachmentEntity
{
    [Key]
    [MaxLength(60)]
    public string Id { get; set; } = default!;

    [Required]
    [MaxLength(60)]
    public string MessageId { get; set; } = default!;

    [MaxLength(200)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(120)]
    public string? ContentType { get; set; }

    public long Size { get; set; }

    [MaxLength(500)]
    public string? StoragePath { get; set; }

    [MaxLength(500)]
    public string? DownloadUrl { get; set; }

    [ForeignKey(nameof(MessageId))]
    public ChatMessageEntity? Message { get; set; }
}

