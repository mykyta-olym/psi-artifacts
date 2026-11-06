using System.ComponentModel.DataAnnotations;

namespace Mais.Web.Entities;

public class ThesisTopicEntity
{
    [Key]
    [MaxLength(100)]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [MaxLength(32)]
    public string Type { get; set; } = "Bachelor thesis"; // or Master thesis

    [MaxLength(400)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(40)]
    public string? Program { get; set; } // code e.g., INF_Bc_SK

    [MaxLength(120)]
    public string? ProgramLabel { get; set; }

    [MaxLength(40)]
    public string? Faculty { get; set; }

    [MaxLength(60)]
    public string? Department { get; set; }

    public string? KeywordsJson { get; set; }
    public string? Description { get; set; }

    [MaxLength(200)]
    public string SupervisorEmail { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? SupervisorName { get; set; }

    public int? Capacity { get; set; } = 1;

    [MaxLength(20)]
    public string State { get; set; } = "open"; // open|closed|archived

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
