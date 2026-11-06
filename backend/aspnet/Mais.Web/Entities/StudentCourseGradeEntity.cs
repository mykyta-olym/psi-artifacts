namespace Mais.Web.Entities;

public class StudentCourseGradeEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string StudentId { get; set; } = string.Empty; // FK to Students.Id
    public string CourseCode { get; set; } = string.Empty; // FK to Courses.Code
    public string TeacherEmail { get; set; } = string.Empty; // FK to Faculty.Email - who graded
    // Assessment type: KZ (single graded credit) or ZS (credit + exam)
    public string AssessmentType { get; set; } = "KZ"; // KZ | ZS
    public int? ContinuousPercent { get; set; } // for ZS: credit/practices part, 0..100
    public int? FinalPercent { get; set; } // for ZS: exam part, 0..100
    public int TotalPercent { get; set; } // computed 0..100
    public string LetterGrade { get; set; } = string.Empty; // A..F
    public DateTime AwardedAt { get; set; } = DateTime.UtcNow; // UTC
}
