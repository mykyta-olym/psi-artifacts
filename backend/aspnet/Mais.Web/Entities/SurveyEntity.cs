namespace Mais.Web.Entities;

/// <summary>
/// Represents a survey (course feedback, teacher evaluation, service satisfaction, etc.)
/// </summary>
public class SurveyEntity
{
    /// <summary>
    /// Unique survey identifier
    /// </summary>
    public string Id { get; set; } = string.Empty;
    
    /// <summary>
    /// Survey title (e.g., "Course feedback — Software Engineering")
    /// </summary>
    public string Title { get; set; } = string.Empty;
    
    /// <summary>
    /// Survey category: "course", "teacher", "service", "general"
    /// </summary>
    public string Category { get; set; } = "general";
    
    /// <summary>
    /// Whether responses are anonymous (student identity not stored with response)
    /// </summary>
    public bool IsAnonymous { get; set; } = true;
    
    /// <summary>
    /// Survey opens at this date (ISO format)
    /// </summary>
    public string OpenAt { get; set; } = string.Empty;
    
    /// <summary>
    /// Survey closes at this date (ISO format)
    /// </summary>
    public string CloseAt { get; set; } = string.Empty;
    
    /// <summary>
    /// Additional metadata as JSON (courseCode, courseName, teacher, etc.)
    /// </summary>
    public string? MetaJson { get; set; }
    
    /// <summary>
    /// Questions array as JSON [{ id, type, text, required, options }]
    /// Types: "likert5", "stars5", "yesno", "text", "multichoice"
    /// </summary>
    public string QuestionsJson { get; set; } = "[]";
    
    /// <summary>
    /// Whether survey is published and visible to students
    /// </summary>
    public bool Published { get; set; } = false;
    
    /// <summary>
    /// Owner/creator ID (FK to Faculty.Id)
    /// </summary>
    public string OwnerId { get; set; } = "system";
    
    /// <summary>
    /// Owner/creator email (FK to Faculty.Email, denormalized for convenience)
    /// </summary>
    public string? OwnerEmail { get; set; }
    
    /// <summary>
    /// Course code this survey is about (FK to Courses.Code)
    /// </summary>
    public string? CourseCode { get; set; }
    
    /// <summary>
    /// Created timestamp
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Last updated timestamp
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Target audience: "all", "students", "teachers"
    /// </summary>
    public string? TargetAudience { get; set; } = "students";
    
    /// <summary>
    /// Restrict survey to specific faculty (null = all)
    /// </summary>
    public string? TargetFaculty { get; set; }
    
    /// <summary>
    /// Restrict survey to specific program (null = all)
    /// </summary>
    public string? TargetProgram { get; set; }
    
    /// <summary>
    /// Specific student emails (JSON array) - if set, only these students see the survey
    /// </summary>
    public string? TargetStudentsJson { get; set; }
    
    /// <summary>
    /// Target specific class group ID (FK to ClassGroups.Id)
    /// </summary>
    public string? TargetGroupId { get; set; }
}
