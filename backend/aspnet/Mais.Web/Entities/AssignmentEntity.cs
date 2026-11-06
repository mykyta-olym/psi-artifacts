namespace Mais.Web.Entities;

public class AssignmentEntity
{
    public string Id { get; set; } = string.Empty;
    public string ClassId { get; set; } = string.Empty; // deterministic per teacher+course
    public string CourseCode { get; set; } = string.Empty;
    public string TeacherEmail { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "continuous"; // continuous | exam
    public int TotalPoints { get; set; }
    public string DueDate { get; set; } = string.Empty; // yyyy-MM-dd
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class StudentAssignmentGradeEntity
{
    public string Id { get; set; } = string.Empty;
    public string StudentId { get; set; } = string.Empty;
    public string AssignmentId { get; set; } = string.Empty;
    public int Points { get; set; }
    public DateTime LastUpdated { get; set; }
}
