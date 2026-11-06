using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class TeacherRatingController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<TeacherRatingController> _log;

    public TeacherRatingController(AppDbContext db, ILogger<TeacherRatingController> log)
    {
        _db = db;
        _log = log;
    }

    /// <summary>
    /// Get teacher rating statistics
    /// </summary>
    [HttpGet("faculty/{teacherId}/rating")]
    public async Task<IActionResult> GetTeacherRating(string teacherId)
    {
        var ratings = await _db.TeacherRatings
            .Where(r => r.TeacherId == teacherId)
            .ToListAsync();

        if (ratings.Count == 0)
        {
            return Ok(new
            {
                teacherId,
                averageRating = 0.0,
                totalRatings = 0,
                ratingDistribution = new Dictionary<int, int>(),
                averageByCategory = new
                {
                    teachingQuality = 0.0,
                    communication = 0.0,
                    responsiveness = 0.0,
                    courseContent = 0.0,
                    fairness = 0.0
                }
            });
        }

        var avgRating = ratings.Average(r => r.Rating);
        var distribution = ratings
            .GroupBy(r => (int)Math.Round(r.Rating))
            .ToDictionary(g => g.Key, g => g.Count());

        var result = new
        {
            teacherId,
            averageRating = Math.Round(avgRating, 2),
            totalRatings = ratings.Count,
            ratingDistribution = distribution,
            averageByCategory = new
            {
                teachingQuality = ratings.Any(r => r.TeachingQuality.HasValue) 
                    ? Math.Round(ratings.Where(r => r.TeachingQuality.HasValue).Average(r => r.TeachingQuality!.Value), 2) 
                    : 0.0,
                communication = ratings.Any(r => r.Communication.HasValue) 
                    ? Math.Round(ratings.Where(r => r.Communication.HasValue).Average(r => r.Communication!.Value), 2) 
                    : 0.0,
                responsiveness = ratings.Any(r => r.Responsiveness.HasValue) 
                    ? Math.Round(ratings.Where(r => r.Responsiveness.HasValue).Average(r => r.Responsiveness!.Value), 2) 
                    : 0.0,
                courseContent = ratings.Any(r => r.CourseContent.HasValue) 
                    ? Math.Round(ratings.Where(r => r.CourseContent.HasValue).Average(r => r.CourseContent!.Value), 2) 
                    : 0.0,
                fairness = ratings.Any(r => r.Fairness.HasValue) 
                    ? Math.Round(ratings.Where(r => r.Fairness.HasValue).Average(r => r.Fairness!.Value), 2) 
                    : 0.0
            }
        };

        return Ok(result);
    }

    /// <summary>
    /// Submit or update teacher rating by student
    /// </summary>
    [HttpPost("faculty/{teacherId}/rating")]
    [Authorize(Policy = "RequireStudent")]
    public async Task<IActionResult> RateTeacher(string teacherId, [FromBody] RateTeacherRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.StudentId))
        {
            return BadRequest(new { message = "StudentId is required" });
        }

        if (req.Rating < 1.0 || req.Rating > 5.0)
        {
            return BadRequest(new { message = "Rating must be between 1.0 and 5.0" });
        }

        // Check if teacher exists
        var teacherExists = await _db.Faculty.AnyAsync(f => f.Id == teacherId);
        if (!teacherExists)
        {
            return NotFound(new { message = "Teacher not found" });
        }

        // Check if student exists
        var studentExists = await _db.Students.AnyAsync(s => s.Id == req.StudentId);
        if (!studentExists)
        {
            return NotFound(new { message = "Student not found" });
        }

        // Check if student already rated this teacher for this course
        var existing = await _db.TeacherRatings
            .FirstOrDefaultAsync(r => 
                r.TeacherId == teacherId && 
                r.StudentId == req.StudentId && 
                r.CourseCode == req.CourseCode);

        if (existing != null)
        {
            // Update existing rating
            existing.Rating = req.Rating;
            existing.Comment = req.Comment;
            existing.TeachingQuality = req.TeachingQuality;
            existing.Communication = req.Communication;
            existing.Responsiveness = req.Responsiveness;
            existing.CourseContent = req.CourseContent;
            existing.Fairness = req.Fairness;
            existing.UpdatedAt = DateTime.UtcNow;
            
            await _db.SaveChangesAsync();
            
            return Ok(new { message = "Rating updated successfully", ratingId = existing.Id });
        }
        else
        {
            // Create new rating
            var rating = new TeacherRatingEntity
            {
                TeacherId = teacherId,
                StudentId = req.StudentId,
                Rating = req.Rating,
                Comment = req.Comment,
                CourseCode = req.CourseCode,
                TeachingQuality = req.TeachingQuality,
                Communication = req.Communication,
                Responsiveness = req.Responsiveness,
                CourseContent = req.CourseContent,
                Fairness = req.Fairness,
                CreatedAt = DateTime.UtcNow
            };

            _db.TeacherRatings.Add(rating);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Rating submitted successfully", ratingId = rating.Id });
        }
    }

    /// <summary>
    /// Get student's rating for a specific teacher
    /// </summary>
    [HttpGet("faculty/{teacherId}/rating/student/{studentId}")]
    public async Task<IActionResult> GetStudentRating(string teacherId, string studentId, [FromQuery] string? courseCode = null)
    {
        var query = _db.TeacherRatings
            .Where(r => r.TeacherId == teacherId && r.StudentId == studentId);

        if (!string.IsNullOrWhiteSpace(courseCode))
        {
            query = query.Where(r => r.CourseCode == courseCode);
        }

        var rating = await query.FirstOrDefaultAsync();

        if (rating == null)
        {
            return Ok(new { hasRated = false });
        }

        return Ok(new
        {
            hasRated = true,
            ratingId = rating.Id,
            rating = rating.Rating,
            comment = rating.Comment,
            courseCode = rating.CourseCode,
            teachingQuality = rating.TeachingQuality,
            communication = rating.Communication,
            responsiveness = rating.Responsiveness,
            courseContent = rating.CourseContent,
            fairness = rating.Fairness,
            createdAt = rating.CreatedAt.ToString("o"),
            updatedAt = rating.UpdatedAt?.ToString("o")
        });
    }

    /// <summary>
    /// Get all ratings for a teacher (with pagination)
    /// </summary>
    [HttpGet("faculty/{teacherId}/ratings")]
    public async Task<IActionResult> GetTeacherRatings(
        string teacherId, 
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 20,
        [FromQuery] string? courseCode = null)
    {
        var query = _db.TeacherRatings.Where(r => r.TeacherId == teacherId);

        if (!string.IsNullOrWhiteSpace(courseCode))
        {
            query = query.Where(r => r.CourseCode == courseCode);
        }

        var total = await query.CountAsync();
        var ratings = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                id = r.Id,
                studentId = r.StudentId,
                rating = r.Rating,
                comment = r.Comment,
                courseCode = r.CourseCode,
                teachingQuality = r.TeachingQuality,
                communication = r.Communication,
                responsiveness = r.Responsiveness,
                courseContent = r.CourseContent,
                fairness = r.Fairness,
                createdAt = r.CreatedAt.ToString("o"),
                updatedAt = r.UpdatedAt != null ? r.UpdatedAt.Value.ToString("o") : null
            })
            .ToListAsync();

        Response.Headers.Append("X-Total-Count", total.ToString());
        return Ok(ratings);
    }

    /// <summary>
    /// Delete a rating (student can delete their own rating)
    /// </summary>
    [HttpDelete("faculty/{teacherId}/rating/{ratingId}")]
    public async Task<IActionResult> DeleteRating(string teacherId, int ratingId, [FromQuery] string studentId)
    {
        var rating = await _db.TeacherRatings
            .FirstOrDefaultAsync(r => r.Id == ratingId && r.TeacherId == teacherId && r.StudentId == studentId);

        if (rating == null)
        {
            return NotFound(new { message = "Rating not found or you don't have permission to delete it" });
        }

        _db.TeacherRatings.Remove(rating);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Rating deleted successfully" });
    }
}

public class RateTeacherRequest
{
    public string StudentId { get; set; } = string.Empty;
    public double Rating { get; set; }
    public string? Comment { get; set; }
    public string? CourseCode { get; set; }
    public double? TeachingQuality { get; set; }
    public double? Communication { get; set; }
    public double? Responsiveness { get; set; }
    public double? CourseContent { get; set; }
    public double? Fairness { get; set; }
}
