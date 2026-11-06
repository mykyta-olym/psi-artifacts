namespace Mais.Web.Models;

public class KnowledgeBaseArticleModel
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = "General";
    public string Slug { get; set; } = string.Empty;
    public string[] Tags { get; set; } = Array.Empty<string>();
    public string AuthorEmail { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsPublished { get; set; } = true;
    public int ViewCount { get; set; } = 0;
    public int HelpfulCount { get; set; } = 0;
    public int NotHelpfulCount { get; set; } = 0;
    public string Difficulty { get; set; } = "Beginner";
    public int EstimatedReadTime { get; set; } = 5;
    public string[] RelatedArticleIds { get; set; } = Array.Empty<string>();
}

public class CreateKnowledgeBaseArticleRequest
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = "General";
    public string[] Tags { get; set; } = Array.Empty<string>();
    public string Difficulty { get; set; } = "Beginner";
    public bool IsPublished { get; set; } = true;
}

public class UpdateKnowledgeBaseArticleRequest
{
    public string? Title { get; set; }
    public string? Content { get; set; }
    public string? Category { get; set; }
    public string[]? Tags { get; set; }
    public string? Difficulty { get; set; }
    public bool? IsPublished { get; set; }
}

public class ArticleFeedbackRequest
{
    public bool IsHelpful { get; set; }
}
