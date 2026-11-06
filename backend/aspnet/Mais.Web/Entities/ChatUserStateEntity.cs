using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mais.Web.Entities;

public class ChatUserStateEntity
{
    [Key]
    [MaxLength(60)]
    public string Id { get; set; } = default!;

    [Required]
    [MaxLength(40)]
    public string ThreadId { get; set; } = default!;

    [Required]
    [MaxLength(200)]
    public string UserEmail { get; set; } = default!;

    public DateTime? LastReadAt { get; set; }

    public DateTime? PinnedAt { get; set; }

    [ForeignKey(nameof(ThreadId))]
    public ChatThreadEntity? Thread { get; set; }
}

