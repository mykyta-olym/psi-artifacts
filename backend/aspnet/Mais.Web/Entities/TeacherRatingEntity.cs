namespace Mais.Web.Entities;

public class TeacherRatingEntity
{
    public int Id { get; set; }
    public string TeacherId { get; set; } = string.Empty; // Faculty ID
    public string StudentId { get; set; } = string.Empty; // Student ID who rated
    public double Rating { get; set; } // 1.0 to 5.0
    public string? Comment { get; set; }
    public string? CourseCode { get; set; } // Optional: which course was rated
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Rating categories (optional detailed ratings)
    public double? TeachingQuality { get; set; } // 1-5
    public double? Communication { get; set; } // 1-5
    public double? Responsiveness { get; set; } // 1-5
    public double? CourseContent { get; set; } // 1-5
    public double? Fairness { get; set; } // 1-5
}
