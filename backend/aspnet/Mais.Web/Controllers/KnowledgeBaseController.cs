using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Models;
using Mais.Web.Services;
using System.Security.Claims;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/knowledge-base")]
public class KnowledgeBaseController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<KnowledgeBaseController> _logger;
    private readonly IDataUpdateService _dataUpdates;

    public KnowledgeBaseController(AppDbContext db, ILogger<KnowledgeBaseController> logger, IDataUpdateService dataUpdates)
    {
        _db = db;
        _logger = logger;
        _dataUpdates = dataUpdates;
    }

    private string GetUserEmail() => User.FindFirst(ClaimTypes.Email)?.Value ?? "anonymous@mais.sk";

    [HttpGet("articles")]
    [AllowAnonymous]
    public async Task<ActionResult<List<KnowledgeBaseArticleModel>>> GetArticles(
        [FromQuery] string? category = null,
        [FromQuery] string? difficulty = null,
        [FromQuery] string? search = null,
        [FromQuery] bool? publishedOnly = true)
    {
        try
        {
            var query = _db.Set<KnowledgeBaseArticleEntity>().AsQueryable();

            if (publishedOnly == true)
            {
                query = query.Where(a => a.IsPublished);
            }

            if (!string.IsNullOrWhiteSpace(category) && category != "All")
            {
                query = query.Where(a => a.Category == category);
            }

            if (!string.IsNullOrWhiteSpace(difficulty))
            {
                query = query.Where(a => a.Difficulty == difficulty);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(a =>
                    a.Title.ToLower().Contains(searchLower) ||
                    a.Content.ToLower().Contains(searchLower) ||
                    a.Tags.Any(t => t.ToLower().Contains(searchLower)));
            }

            var articles = await query
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();

            var models = articles.Select(a => MapToModel(a)).ToList();
            return Ok(models);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch knowledge base articles");
            return StatusCode(500, new { error = "Failed to fetch articles" });
        }
    }

    [HttpGet("articles/{id}")]
    [AllowAnonymous]
    public async Task<ActionResult<KnowledgeBaseArticleModel>> GetArticle(string id)
    {
        try
        {
            var article = await _db.Set<KnowledgeBaseArticleEntity>()
                .FirstOrDefaultAsync(a => a.Id == id);

            if (article == null)
            {
                return NotFound(new { error = "Article not found" });
            }

            // Increment view count
            article.ViewCount++;
            await _db.SaveChangesAsync();

            return Ok(MapToModel(article));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch article {Id}", id);
            return StatusCode(500, new { error = "Failed to fetch article" });
        }
    }

    [HttpGet("categories")]
    [AllowAnonymous]
    public async Task<ActionResult<List<string>>> GetCategories()
    {
        try
        {
            var categories = await _db.Set<KnowledgeBaseArticleEntity>()
                .Where(a => a.IsPublished)
                .Select(a => a.Category)
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();

            return Ok(categories);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch categories");
            return StatusCode(500, new { error = "Failed to fetch categories" });
        }
    }

    [HttpGet("tags")]
    [AllowAnonymous]
    public async Task<ActionResult<List<string>>> GetTags()
    {
        try
        {
            var articles = await _db.Set<KnowledgeBaseArticleEntity>()
                .Where(a => a.IsPublished)
                .ToListAsync();

            var tags = articles
                .SelectMany(a => a.Tags)
                .Distinct()
                .OrderBy(t => t)
                .ToList();

            return Ok(tags);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch tags");
            return StatusCode(500, new { error = "Failed to fetch tags" });
        }
    }

    [HttpPost("articles")]
    [Authorize(Policy = "RequireTeacher")]
    public async Task<ActionResult<KnowledgeBaseArticleModel>> CreateArticle(
        [FromBody] CreateKnowledgeBaseArticleRequest request)
    {
        try
        {
            var userEmail = GetUserEmail();

            var slug = await GenerateUniqueSlug(request.Title);
            var estimatedReadTime = CalculateReadTime(request.Content);

            var article = new KnowledgeBaseArticleEntity
            {
                Id = Guid.NewGuid().ToString(),
                Title = request.Title,
                Content = request.Content,
                Category = request.Category,
                Slug = slug,
                Tags = request.Tags?.ToList() ?? new List<string>(),
                AuthorEmail = userEmail,
                Difficulty = request.Difficulty,
                IsPublished = request.IsPublished,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                ViewCount = 0,
                LikeCount = 0,
                RelatedArticles = new List<string>()
            };

            _db.Set<KnowledgeBaseArticleEntity>().Add(article);
            await _db.SaveChangesAsync();

            // Notify all clients about new article
            await _dataUpdates.NotifyKnowledgeBaseUpdated(article.Id, "created");

            return CreatedAtAction(
                nameof(GetArticle),
                new { id = article.Id },
                MapToModel(article, estimatedReadTime));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create article");
            return StatusCode(500, new { error = "Failed to create article" });
        }
    }

    [HttpPut("articles/{id}")]
    [Authorize(Policy = "RequireTeacher")]
    public async Task<ActionResult<KnowledgeBaseArticleModel>> UpdateArticle(
        string id,
        [FromBody] UpdateKnowledgeBaseArticleRequest request)
    {
        try
        {
            var article = await _db.Set<KnowledgeBaseArticleEntity>()
                .FirstOrDefaultAsync(a => a.Id == id);

            if (article == null)
            {
                return NotFound(new { error = "Article not found" });
            }

            var userEmail = GetUserEmail();
            
            // Only author can edit (or allow teachers to edit any)
            // For now, allow teachers to edit everything
            // You can add: if (article.AuthorEmail != userEmail) return Forbid();

            if (request.Title != null)
            {
                article.Title = request.Title;
                article.Slug = await GenerateUniqueSlug(request.Title, article.Id);
            }

            if (request.Content != null)
            {
                article.Content = request.Content;
            }

            if (request.Category != null)
            {
                article.Category = request.Category;
            }

            if (request.Tags != null)
            {
                article.Tags = request.Tags.ToList();
            }

            if (request.Difficulty != null)
            {
                article.Difficulty = request.Difficulty;
            }

            if (request.IsPublished.HasValue)
            {
                article.IsPublished = request.IsPublished.Value;
            }

            article.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            // Notify all clients about article update
            await _dataUpdates.NotifyKnowledgeBaseUpdated(id, "updated");

            return Ok(MapToModel(article, CalculateReadTime(article.Content)));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update article {Id}", id);
            return StatusCode(500, new { error = "Failed to update article" });
        }
    }

    [HttpDelete("articles/{id}")]
    [Authorize(Policy = "RequireTeacher")]
    public async Task<ActionResult> DeleteArticle(string id)
    {
        try
        {
            var article = await _db.Set<KnowledgeBaseArticleEntity>()
                .FirstOrDefaultAsync(a => a.Id == id);

            if (article == null)
            {
                return NotFound(new { error = "Article not found" });
            }

            _db.Set<KnowledgeBaseArticleEntity>().Remove(article);
            await _db.SaveChangesAsync();

            // Notify all clients about article deletion
            await _dataUpdates.NotifyKnowledgeBaseUpdated(id, "deleted");

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete article {Id}", id);
            return StatusCode(500, new { error = "Failed to delete article" });
        }
    }

    [HttpPost("articles/{id}/feedback")]
    [AllowAnonymous]
    public async Task<ActionResult> SubmitFeedback(
        string id,
        [FromBody] ArticleFeedbackRequest request)
    {
        try
        {
            var article = await _db.Set<KnowledgeBaseArticleEntity>()
                .FirstOrDefaultAsync(a => a.Id == id);

            if (article == null)
            {
                return NotFound(new { error = "Article not found" });
            }

            if (request.IsHelpful)
            {
                article.LikeCount++;
            }
            // Note: NotHelpfulCount removed - simplified to like-only model

            await _db.SaveChangesAsync();

            return Ok(new
            {
                likeCount = article.LikeCount
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to submit feedback for article {Id}", id);
            return StatusCode(500, new { error = "Failed to submit feedback" });
        }
    }

    [HttpGet("stats")]
    [AllowAnonymous]
    public async Task<ActionResult> GetStats()
    {
        try
        {
            var total = await _db.Set<KnowledgeBaseArticleEntity>()
                .Where(a => a.IsPublished)
                .CountAsync();

            var totalViews = await _db.Set<KnowledgeBaseArticleEntity>()
                .Where(a => a.IsPublished)
                .SumAsync(a => a.ViewCount);

            var byCategory = await _db.Set<KnowledgeBaseArticleEntity>()
                .Where(a => a.IsPublished)
                .GroupBy(a => a.Category)
                .Select(g => new { category = g.Key, count = g.Count() })
                .ToListAsync();

            var byDifficulty = await _db.Set<KnowledgeBaseArticleEntity>()
                .Where(a => a.IsPublished)
                .GroupBy(a => a.Difficulty)
                .Select(g => new { difficulty = g.Key, count = g.Count() })
                .ToListAsync();

            return Ok(new
            {
                totalArticles = total,
                totalViews,
                byCategory,
                byDifficulty
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch stats");
            return StatusCode(500, new { error = "Failed to fetch stats" });
        }
    }

    private static KnowledgeBaseArticleModel MapToModel(KnowledgeBaseArticleEntity entity, int? estimatedReadTime = null)
    {
        var readTime = estimatedReadTime ?? CalculateReadTime(entity.Content ?? "");
        return new KnowledgeBaseArticleModel
        {
            Id = entity.Id,
            Title = entity.Title,
            Content = entity.Content ?? string.Empty,
            Category = entity.Category,
            Slug = entity.Slug,
            Tags = entity.Tags?.ToArray() ?? Array.Empty<string>(),
            AuthorEmail = entity.AuthorEmail ?? string.Empty,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            IsPublished = entity.IsPublished,
            ViewCount = entity.ViewCount,
            HelpfulCount = entity.LikeCount,
            NotHelpfulCount = 0,
            Difficulty = entity.Difficulty ?? "Beginner",
            EstimatedReadTime = readTime,
            RelatedArticleIds = entity.RelatedArticles?.ToArray() ?? Array.Empty<string>()
        };
    }

    private static string GenerateSlug(string title)
    {
        var slug = title.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("?", "")
            .Replace("!", "")
            .Replace(".", "")
            .Replace(",", "")
            .Replace(":", "")
            .Replace(";", "");

        return slug;
    }

    private async Task<string> GenerateUniqueSlug(string title, string? existingArticleId = null)
    {
        var baseSlug = GenerateSlug(title);
        var slug = baseSlug;
        var counter = 1;

        while (true)
        {
            var exists = await _db.Set<KnowledgeBaseArticleEntity>()
                .AnyAsync(a => a.Slug == slug && (existingArticleId == null || a.Id != existingArticleId));
            
            if (!exists)
            {
                return slug;
            }

            slug = $"{baseSlug}-{counter}";
            counter++;
        }
    }

    private static int CalculateReadTime(string content)
    {
        // Average reading speed: 200 words per minute
        var wordCount = content.Split(new[] { ' ', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries).Length;
        var minutes = Math.Max(1, (int)Math.Ceiling(wordCount / 200.0));
        return minutes;
    }
}
