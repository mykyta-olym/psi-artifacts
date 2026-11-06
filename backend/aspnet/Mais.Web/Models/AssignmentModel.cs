namespace Mais.Web.Models;

public class AssignmentModel
{
    public string Id { get; set; } = string.Empty;
    public string ClassId { get; set; } = string.Empty;
    public string CourseCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty; // quiz, homework, test, project
    public int TotalPoints { get; set; }
    public string DueDate { get; set; } = string.Empty; // YYYY-MM-DD
    public string Description { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}
