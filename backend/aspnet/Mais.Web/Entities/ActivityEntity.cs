namespace Mais.Web.Entities;

/// <summary>
/// Represents an activity/event in the system (submissions, communications, attendance, grades, announcements, schedule changes).
/// </summary>
public class ActivityEntity
{
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Type of activity: submissions, communications, attendance, grades, announcements, schedule
    /// </summary>
    public string Type { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Subject { get; set; }
    public string? ClassId { get; set; }
    public string? CourseCode { get; set; } // FK to Courses.Code

    /// <summary>
    /// Email of the teacher/instructor associated with this activity
    /// </summary>
    public string? TeacherEmail { get; set; } // FK to Faculty.Email

    /// <summary>
    /// Display name of the teacher
    /// </summary>
    public string? TeacherDisplay { get; set; }

    /// <summary>
    /// ID of the student associated with this activity
    /// </summary>
    public string? StudentId { get; set; } // FK to Students.Id

    /// <summary>
    /// Email of the student associated with this activity
    /// </summary>
    public string? StudentEmail { get; set; }

    /// <summary>
    /// Display name of the student
    /// </summary>
    public string? StudentName { get; set; }

    public string? Room { get; set; } // FK to Rooms.Id
    public string? Location { get; set; }
    public string? AssignmentId { get; set; }

    /// <summary>
    /// ISO 8601 timestamp
    /// </summary>
    public string Timestamp { get; set; } = string.Empty;

    /// <summary>
    /// Whether this activity requires action from the user
    /// </summary>
    public bool RequiresAction { get; set; }

    /// <summary>
    /// Priority level: high, medium, low, or null
    /// </summary>
    public string? Priority { get; set; }

    /// <summary>
    /// JSON metadata for additional activity-specific data (threadId, startTs, endTs, count, authors, etc.)
    /// </summary>
    public string? MetaJson { get; set; }

    /// <summary>
    /// Email of the user who created this activity (for tracking)
    /// </summary>
    public string? CreatedByEmail { get; set; }

    /// <summary>
    /// ISO 8601 timestamp when this activity was created
    /// </summary>
    public string CreatedAt { get; set; } = string.Empty;

    /// <summary>
    /// ISO 8601 timestamp when this activity was last updated
    /// </summary>
    public string UpdatedAt { get; set; } = string.Empty;

    /// <summary>
    /// Whether this activity is resolved (no longer requires action)
    /// </summary>
    public bool IsResolved { get; set; }

    /// <summary>
    /// Whether this activity is archived (soft delete)
    /// </summary>
    public bool IsArchived { get; set; }
}

