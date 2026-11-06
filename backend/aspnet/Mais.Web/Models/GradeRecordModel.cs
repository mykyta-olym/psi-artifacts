namespace Mais.Web.Models;

public class GradeRecordModel
{
    public string StudentId { get; set; } = string.Empty;
    public string AssignmentId { get; set; } = string.Empty;
    public int Points { get; set; }
    public int Percentage { get; set; }
    public string LetterGrade { get; set; } = ""; // A..F
    public string LastUpdated { get; set; } = string.Empty; // ISO
}
