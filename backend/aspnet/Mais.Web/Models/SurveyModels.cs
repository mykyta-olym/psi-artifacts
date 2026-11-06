using System.Collections.Generic;

namespace Mais.Web.Models;

/// <summary>
/// Survey data model for API responses
/// </summary>
public class SurveyModel
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = "general";
    public bool IsAnonymous { get; set; } = true;
    public string OpenAt { get; set; } = string.Empty;
    public string CloseAt { get; set; } = string.Empty;
    public Dictionary<string, object>? Meta { get; set; }
    public List<SurveyQuestion>? Questions { get; set; }
    public bool Published { get; set; } = false;
    public string OwnerId { get; set; } = "system";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string? TargetAudience { get; set; }
    public string? TargetFaculty { get; set; }
    public string? TargetProgram { get; set; }
    public List<string>? TargetStudents { get; set; } // specific student emails
    public string? TargetGroupId { get; set; } // specific class group ID
    
    // Statistics (populated when fetching with analytics)
    public int? ResponseCount { get; set; }
    public bool? HasResponded { get; set; } // for current user
}

/// <summary>
/// Survey question structure
/// </summary>
public class SurveyQuestion
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = "text"; // likert5, stars5, yesno, text, multichoice
    public string Text { get; set; } = string.Empty;
    public bool Required { get; set; } = true;
    public List<string>? Options { get; set; } // for multichoice
}

/// <summary>
/// Request to create or update survey
/// </summary>
public class SurveyCreateRequest
{
    public string? Title { get; set; }
    public string? Category { get; set; }
    public bool? IsAnonymous { get; set; }
    public string? OpenAt { get; set; }
    public string? CloseAt { get; set; }
    public Dictionary<string, object>? Meta { get; set; }
    public List<SurveyQuestion>? Questions { get; set; }
    public bool? Published { get; set; }
    public string? TargetAudience { get; set; }
    public string? TargetFaculty { get; set; }
    public string? TargetProgram { get; set; }
    public List<string>? TargetStudents { get; set; } // specific student emails
    public string? TargetGroupId { get; set; } // specific class group ID
}

/// <summary>
/// Survey response submission
/// </summary>
public class SurveyResponseRequest
{
    public Dictionary<string, object> Answers { get; set; } = new();
}

/// <summary>
/// Survey analytics result
/// </summary>
public class SurveyAnalytics
{
    public string SurveyId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int TotalResponses { get; set; }
    public Dictionary<string, QuestionStats>? QuestionStats { get; set; }
}

/// <summary>
/// Statistics for a single question
/// </summary>
public class QuestionStats
{
    public string QuestionId { get; set; } = string.Empty;
    public string QuestionText { get; set; } = string.Empty;
    public string QuestionType { get; set; } = "text";
    public int ResponseCount { get; set; }
    
    // For numerical questions (likert5, stars5)
    public double? Average { get; set; }
    public Dictionary<string, int>? Distribution { get; set; } // "1": 5, "2": 10, etc.
    
    // For yes/no
    public int? YesCount { get; set; }
    public int? NoCount { get; set; }
    
    // For multichoice
    public Dictionary<string, int>? ChoiceCounts { get; set; }
    
    // For text responses
    public List<string>? TextResponses { get; set; }
}
