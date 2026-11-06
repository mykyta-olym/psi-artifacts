namespace Mais.Web.Entities;

public class ExamTermEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string CourseCode { get; set; } = string.Empty;
    public string CourseName { get; set; } = string.Empty;
    public int? Credits { get; set; }
    public DateTime StartAt { get; set; } // UTC
    public DateTime EndAt { get; set; } // UTC
    public string? Building { get; set; }
    public string? Room { get; set; }
    public string? Examiner { get; set; }
    public int Capacity { get; set; } = 0;
    public string CreatedBy { get; set; } = string.Empty; // teacher email
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
