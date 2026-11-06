namespace Mais.Web.Models;

/// <summary>
/// Activity model for API responses
/// </summary>
public class ActivityModel
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Subject { get; set; }
    public string? ClassId { get; set; }
    public string? CourseCode { get; set; }
    public string? TeacherEmail { get; set; }
    public string? TeacherDisplay { get; set; }
    public string? StudentEmail { get; set; }
    public string? StudentName { get; set; }
    public string? Room { get; set; }
    public string? Location { get; set; }
    public string? AssignmentId { get; set; }
    public string Timestamp { get; set; } = string.Empty;
    public bool RequiresAction { get; set; }
    public string? Priority { get; set; }
    public Dictionary<string, object>? Meta { get; set; }
    public string? CreatedByEmail { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
    public bool IsResolved { get; set; }
    public bool IsArchived { get; set; }
}

/// <summary>
/// Request model for creating/updating an activity
/// </summary>
public class CreateActivityRequest
{
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Subject { get; set; }
    public string? ClassId { get; set; }
    public string? CourseCode { get; set; }
    public string? TeacherEmail { get; set; }
    public string? TeacherDisplay { get; set; }
    public string? StudentEmail { get; set; }
    public string? StudentName { get; set; }
    public string? Room { get; set; }
    public string? Location { get; set; }
    public string? AssignmentId { get; set; }
    public string? Timestamp { get; set; }
    public bool RequiresAction { get; set; }
    public string? Priority { get; set; }
    public Dictionary<string, object>? Meta { get; set; }
}

/// <summary>
/// Request model for updating activity properties
/// </summary>
public class UpdateActivityRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public bool? RequiresAction { get; set; }
    public string? Priority { get; set; }
    public Dictionary<string, object>? Meta { get; set; }
    public bool? IsResolved { get; set; }
}

/// <summary>
/// Response model for paginated activities
/// </summary>
public class ActivitiesResponse
{
    public List<ActivityModel> Activities { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PerPage { get; set; }
    public int TotalPages { get; set; }
}

