using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace Mais.Web.Entities;

public class ChangelogEntryEntity
{
    [Key]
    [MaxLength(128)]
    public string Id { get; set; } = string.Empty;

    [Required]
    [MaxLength(32)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "timestamp without time zone")]
    public DateTime Date { get; set; }

    [Required]
    [MaxLength(512)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "jsonb")]
    public string PointsJson { get; set; } = "[]";
    
    [NotMapped]
    public List<string> Points
    {
        get => string.IsNullOrWhiteSpace(PointsJson) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(PointsJson) ?? new List<string>();
        set => PointsJson = JsonSerializer.Serialize(value);
    }

    [Required]
    [Column(TypeName = "timestamp without time zone")]
    public DateTime CreatedAt { get; set; } = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);

    [Column(TypeName = "timestamp without time zone")]
    public DateTime? UpdatedAt { get; set; }

    [MaxLength(256)]
    public string CreatedBy { get; set; } = string.Empty;
}
