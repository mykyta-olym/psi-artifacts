using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mais.Web.Entities;

[Table("news")]
public class NewsEntity
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("title")]
    [MaxLength(500)]
    public string Title { get; set; } = string.Empty;

    [Column("content")]
    public string? Content { get; set; }

    [Column("content_html")]
    public string? ContentHtml { get; set; }

    [Required]
    [Column("published_at")]
    public DateTime PublishedAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    /// <summary>
    /// FK to Faculty.Email
    /// </summary>
    [Column("author_email")]
    [MaxLength(255)]
    public string? AuthorEmail { get; set; }

    /// <summary>
    /// Author display name (denormalized for convenience)
    /// </summary>
    [Column("author_name")]
    [MaxLength(255)]
    public string? AuthorName { get; set; }

    [Column("is_published")]
    public bool IsPublished { get; set; }

    [Column("attachments")]
    public string? Attachments { get; set; } // JSON array of attachment objects

    [Column("category")]
    [MaxLength(100)]
    public string? Category { get; set; }

    [Column("tags")]
    public string? Tags { get; set; } // JSON array or comma-separated

    [Column("cover_image_url")]
    [MaxLength(1000)]
    public string? CoverImageUrl { get; set; }

    [Column("priority")]
    public int Priority { get; set; } // For sorting/pinning

    [Column("expires_at")]
    public DateTime? ExpiresAt { get; set; } // Optional expiration date
}
