using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Services;
using System.Text.Json;
using System.Security.Claims;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NewsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<NewsController> _logger;
    private readonly IDataUpdateService _dataUpdateService;

    public NewsController(AppDbContext context, IWebHostEnvironment env, ILogger<NewsController> logger, IDataUpdateService dataUpdateService)
    {
        _context = context;
        _env = env;
        _logger = logger;
        _dataUpdateService = dataUpdateService;
    }

    private string? GetUserEmail()
    {
        return User.FindFirst(ClaimTypes.Email)?.Value;
    }

    // GET: api/news
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetNews(
        [FromQuery] bool? published = null,
        [FromQuery] string? category = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            var query = _context.News.AsQueryable();

            // Filter by published status
            if (published.HasValue)
            {
                query = query.Where(n => n.IsPublished == published.Value);
            }

            // Filter by category
            if (!string.IsNullOrEmpty(category))
            {
                query = query.Where(n => n.Category == category);
            }

            // Filter out expired news
            query = query.Where(n => n.ExpiresAt == null || n.ExpiresAt > DateTime.UtcNow);

            // Order by priority and date
            query = query.OrderByDescending(n => n.Priority)
                         .ThenByDescending(n => n.PublishedAt);

            var total = await query.CountAsync();
            var news = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new { items = news, total, page, pageSize });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching news");
            return StatusCode(500, new { error = "Failed to fetch news" });
        }
    }

    // GET: api/news/{id}
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetNewsById(int id)
    {
        try
        {
            var news = await _context.News.FindAsync(id);
            if (news == null)
            {
                return NotFound(new { error = "News not found" });
            }

            return Ok(news);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching news {Id}", id);
            return StatusCode(500, new { error = "Failed to fetch news" });
        }
    }
    // POST: api/news
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateNews([FromBody] NewsEntity news)
    {
        try
        {
            var userEmail = GetUserEmail();
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { error = "User not authenticated" });
            }

            // Check if user is teacher
            var user = await _context.UserCredentials.FirstOrDefaultAsync(u => u.Email == userEmail);
            if (user?.Role != "teacher" && user?.Role != "admin")
            {
                return Forbid("Only teachers can create news");
            }

            news.AuthorEmail = userEmail;
            news.CreatedAt = DateTime.UtcNow;
            news.UpdatedAt = DateTime.UtcNow;

            if (news.PublishedAt == default)
            {
                news.PublishedAt = DateTime.UtcNow;
            }

            _context.News.Add(news);
            await _context.SaveChangesAsync();

            // Notify all clients about new news
            await _dataUpdateService.NotifyNewsUpdated(news.Id, "created");

            return CreatedAtAction(nameof(GetNewsById), new { id = news.Id }, news);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating news");
            return StatusCode(500, new { error = "Failed to create news" });
        }
    }

    // PUT: api/news/{id}
    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateNews(int id, [FromBody] NewsEntity updatedNews)
    {
        try
        {
            var userEmail = GetUserEmail();
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { error = "User not authenticated" });
            }

            var news = await _context.News.FindAsync(id);
            if (news == null)
            {
                return NotFound(new { error = "News not found" });
            }

            // Check if user is authorized (author or admin)
            var user = await _context.UserCredentials.FirstOrDefaultAsync(u => u.Email == userEmail);
            if (news.AuthorEmail != userEmail && user?.Role != "admin")
            {
                return Forbid("You can only edit your own news");
            }

            news.Title = updatedNews.Title;
            news.Content = updatedNews.Content;
            news.ContentHtml = updatedNews.ContentHtml;
            news.Category = updatedNews.Category;
            news.Tags = updatedNews.Tags;
            news.CoverImageUrl = updatedNews.CoverImageUrl;
            news.Priority = updatedNews.Priority;
            news.IsPublished = updatedNews.IsPublished;
            news.ExpiresAt = updatedNews.ExpiresAt;
            news.Attachments = updatedNews.Attachments;
            news.UpdatedAt = DateTime.UtcNow;

            if (updatedNews.PublishedAt != default)
            {
                news.PublishedAt = updatedNews.PublishedAt;
            }

            await _context.SaveChangesAsync();

            // Notify all clients about updated news
            await _dataUpdateService.NotifyNewsUpdated(news.Id, "updated");

            return Ok(news);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating news {Id}", id);
            return StatusCode(500, new { error = "Failed to update news" });
        }
    }

    // DELETE: api/news/{id}
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteNews(int id)
    {
        try
        {
            var userEmail = GetUserEmail();
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { error = "User not authenticated" });
            }

            var news = await _context.News.FindAsync(id);
            if (news == null)
            {
                return NotFound(new { error = "News not found" });
            }

            // Check if user is authorized (author or admin)
            var user = await _context.UserCredentials.FirstOrDefaultAsync(u => u.Email == userEmail);
            if (news.AuthorEmail != userEmail && user?.Role != "admin")
            {
                return Forbid("You can only delete your own news");
            }

            _context.News.Remove(news);
            await _context.SaveChangesAsync();

            // Notify all clients about deleted news
            await _dataUpdateService.NotifyNewsUpdated(id, "deleted");

            return Ok(new { message = "News deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting news {Id}", id);
            return StatusCode(500, new { error = "Failed to delete news" });
        }
    }

    // POST: api/news/upload
    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [Authorize]
    public async Task<IActionResult> UploadFile(IFormFile file)
    {
        try
        {
            var userEmail = GetUserEmail();
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { error = "User not authenticated" });
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "No file uploaded" });
            }

            // Validate file size (max 10MB)
            if (file.Length > 10 * 1024 * 1024)
            {
                return BadRequest(new { error = "File size exceeds 10MB limit" });
            }

            // Validate file type
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".pdf", ".doc", ".docx", ".xls", ".xlsx" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { error = "File type not allowed" });
            }

            // Generate unique filename
            var fileName = $"{Guid.NewGuid()}{extension}";
            var uploadsDir = Path.Combine(_env.WebRootPath, "uploads", "news");
            Directory.CreateDirectory(uploadsDir);
            var filePath = Path.Combine(uploadsDir, fileName);

            // Save file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var fileUrl = $"/uploads/news/{fileName}";
            var fileInfo = new
            {
                fileName = file.FileName,
                url = fileUrl,
                size = file.Length,
                type = file.ContentType,
                extension
            };

            return Ok(fileInfo);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file");
            return StatusCode(500, new { error = "Failed to upload file" });
        }
    }

    // DELETE: api/news/upload
    [HttpDelete("upload")]
    [Authorize]
    public IActionResult DeleteFile([FromQuery] string url)
    {
        try
        {
            var userEmail = GetUserEmail();
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { error = "User not authenticated" });
            }

            if (string.IsNullOrEmpty(url))
            {
                return BadRequest(new { error = "URL is required" });
            }

            // Extract filename from URL
            var fileName = Path.GetFileName(url);
            var filePath = Path.Combine(_env.WebRootPath, "uploads", "news", fileName);

            if (System.IO.File.Exists(filePath))
            {
                System.IO.File.Delete(filePath);
                return Ok(new { message = "File deleted successfully" });
            }

            return NotFound(new { error = "File not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting file");
            return StatusCode(500, new { error = "Failed to delete file" });
        }
    }
}
