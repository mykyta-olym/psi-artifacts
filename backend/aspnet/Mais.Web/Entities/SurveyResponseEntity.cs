namespace Mais.Web.Entities;

/// <summary>
/// Represents a student's response to a survey
/// </summary>
public class SurveyResponseEntity
{
    /// <summary>
    /// Unique response identifier
    /// </summary>
    public string Id { get; set; } = string.Empty;
    
    /// <summary>
    /// Survey ID this response belongs to
    /// </summary>
    public string SurveyId { get; set; } = string.Empty;
    
    /// <summary>
    /// Student email (null if survey is anonymous)
    /// </summary>
    public string? StudentEmail { get; set; }
    
    /// <summary>
    /// Student ID (null if survey is anonymous)
    /// </summary>
    public string? StudentId { get; set; }
    
    /// <summary>
    /// Answers as JSON { questionId: answerValue }
    /// Example: { "q1": 4, "q2": "Very good course", "q3": true }
    /// </summary>
    public string AnswersJson { get; set; } = "{}";
    
    /// <summary>
    /// Submission timestamp
    /// </summary>
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// IP address (for duplicate prevention, not shown in analytics)
    /// </summary>
    public string? IpAddress { get; set; }
    
    /// <summary>
    /// User agent (for detecting bot submissions)
    /// </summary>
    public string? UserAgent { get; set; }
}
