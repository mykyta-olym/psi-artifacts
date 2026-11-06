using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace Mais.Web.Entities;

[Table("KnowledgeBaseArticles")]
public class KnowledgeBaseArticleEntity
{
    [Key]
    [Column("Id")]
    [MaxLength(100)]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [Column("Title")]
    [MaxLength(500)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [Column("Content")]
    public string Content { get; set; } = string.Empty;

    [Required]
    [Column("Category")]
    [MaxLength(100)]
    public string Category { get; set; } = "General";

    [Required]
    [Column("Slug")]
    [MaxLength(600)]
    public string Slug { get; set; } = string.Empty;

    [Column("TagsJson")]
    public string? TagsJson { get; set; }
    
    [NotMapped]
    public List<string> Tags
    {
        get => string.IsNullOrWhiteSpace(TagsJson) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(TagsJson) ?? new List<string>();
        set => TagsJson = JsonSerializer.Serialize(value);
    }

    [Column("AuthorEmail")]
    [MaxLength(200)]
    public string? AuthorEmail { get; set; }

    [Column("MetaDescription")]
    [MaxLength(500)]
    public string? MetaDescription { get; set; }

    [Required]
    [Column("CreatedAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Required]
    [Column("UpdatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Required]
    [Column("IsPublished")]
    public bool IsPublished { get; set; } = true;

    [Required]
    [Column("ViewCount")]
    public int ViewCount { get; set; } = 0;

    [Required]
    [Column("LikeCount")]
    public int LikeCount { get; set; } = 0;

    [Column("Difficulty")]
    [MaxLength(50)]
    public string? Difficulty { get; set; } = "Beginner";

    [Column("RelatedArticlesJson")]
    public string? RelatedArticlesJson { get; set; }
    
    [NotMapped]
    public List<string> RelatedArticles
    {
        get => string.IsNullOrWhiteSpace(RelatedArticlesJson) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(RelatedArticlesJson) ?? new List<string>();
        set => RelatedArticlesJson = JsonSerializer.Serialize(value);
    }
}
