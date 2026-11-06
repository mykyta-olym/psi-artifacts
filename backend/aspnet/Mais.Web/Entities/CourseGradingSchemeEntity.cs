namespace Mais.Web.Entities;

public class CourseGradingSchemeEntity
{
    public string CourseCode { get; set; } = string.Empty; // PK -> Courses.Code
    public int MaxContinuousPoints { get; set; } = 40; // default 40
    public int MaxFinalPoints { get; set; } = 60; // default 60
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
