using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Models;
using Mais.Web.Services;

namespace Mais.Web.Controllers;

/// <summary>
/// Controller for managing surveys (course feedback, teacher evaluations, service satisfaction)
/// </summary>
[ApiController]
[Route("api/surveys")]
[Authorize]
public class SurveysController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<SurveysController> _logger;
    private readonly IDataUpdateService _dataUpdateService;

    public SurveysController(AppDbContext db, ILogger<SurveysController> logger, IDataUpdateService dataUpdateService)
    {
        _db = db;
        _logger = logger;
        _dataUpdateService = dataUpdateService;
    }

    /// <summary>
    /// Get students list for survey targeting (teachers only)
    /// Supports filtering by faculty, program, course enrollment, and teacher's groups
    /// </summary>
    [HttpGet("students")]
    [Authorize(Roles = "teacher")]
    public async Task<IActionResult> GetStudentsForTargeting(
        [FromQuery] string? faculty = null,
        [FromQuery] string? program = null,
        [FromQuery] string? courseCode = null,
        [FromQuery] string? groupId = null,
        [FromQuery] bool myGroupsOnly = false)
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        
        var query = _db.Students.AsQueryable().Where(s => !s.IsArchived);

        // Filter by faculty
        if (!string.IsNullOrWhiteSpace(faculty))
        {
            query = query.Where(s => s.Faculty == faculty);
        }

        // Filter by program
        if (!string.IsNullOrWhiteSpace(program))
        {
            query = query.Where(s => s.Program == program);
        }

        // Filter by specific group
        if (!string.IsNullOrWhiteSpace(groupId))
        {
            query = query.Where(s => s.ClassGroupId == groupId);
        }

        // Filter by teacher's groups only
        if (myGroupsOnly && !string.IsNullOrWhiteSpace(email))
        {
            var teacherGroups = await _db.ClassGroups
                .Where(g => g.TeacherEmail == email && g.IsActive)
                .Select(g => g.Id)
                .ToListAsync();

            if (teacherGroups.Any())
            {
                query = query.Where(s => s.ClassGroupId != null && teacherGroups.Contains(s.ClassGroupId));
            }
            else
            {
                // Teacher has no groups, return empty
                return Ok(new { students = new List<object>(), count = 0 });
            }
        }

        // Filter by course enrollment
        if (!string.IsNullOrWhiteSpace(courseCode))
        {
            var enrolledStudentIds = await _db.Enrollments
                .Where(e => e.CourseCode == courseCode && e.Status == "confirmed")
                .Select(e => e.StudentId)
                .Distinct()
                .ToListAsync();

            query = query.Where(s => enrolledStudentIds.Contains(s.Id));
        }

        var students = await query
            .OrderBy(s => s.FamilyName)
            .ThenBy(s => s.GivenName)
            .Select(s => new
            {
                id = s.Id,
                email = s.Email,
                fullName = s.FullName,
                givenName = s.GivenName,
                familyName = s.FamilyName,
                faculty = s.Faculty,
                program = s.Program,
                studyYear = s.StudyYear,
                classGroupId = s.ClassGroupId
            })
            .ToListAsync();

        return Ok(new { students, count = students.Count });
    }

    /// <summary>
    /// Get available filters for student targeting (teachers only)
    /// Returns faculties, programs, courses, and groups accessible to the teacher
    /// </summary>
    [HttpGet("students/filters")]
    [Authorize(Roles = "teacher")]
    public async Task<IActionResult> GetStudentFilters()
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value;

        // Get distinct faculties and programs from students
        var faculties = await _db.Students
            .Where(s => !s.IsArchived && !string.IsNullOrEmpty(s.Faculty))
            .Select(s => s.Faculty)
            .Distinct()
            .OrderBy(f => f)
            .ToListAsync();

        var programs = await _db.Students
            .Where(s => !s.IsArchived && !string.IsNullOrEmpty(s.Program))
            .Select(s => new { faculty = s.Faculty, program = s.Program })
            .Distinct()
            .OrderBy(p => p.faculty)
            .ThenBy(p => p.program)
            .ToListAsync();

        // Get teacher's courses
        var teacherCourses = await _db.Timetable
            .Where(t => t.TeacherEmail == email)
            .Select(t => t.CourseCode)
            .Distinct()
            .ToListAsync();

        // Get course names from Courses table
        var courseDetails = await _db.Courses
            .Where(c => teacherCourses.Contains(c.Code))
            .Select(c => new { code = c.Code, name = c.NameEn ?? c.NameSk ?? c.Code })
            .OrderBy(c => c.name)
            .ToListAsync();

        // Get teacher's groups
        var teacherGroups = await _db.ClassGroups
            .Where(g => g.TeacherEmail == email && g.IsActive)
            .Select(g => new
            {
                id = g.Id,
                name = g.Name,
                faculty = g.Faculty,
                program = g.Program,
                studentCount = g.StudentCount,
                capacity = g.Capacity
            })
            .OrderBy(g => g.name)
            .ToListAsync();

        return Ok(new
        {
            faculties,
            programs = programs.Select(p => new { faculty = p.faculty, program = p.program }).ToList(),
            courses = courseDetails.Select(c => new { code = c.code, name = c.name }).ToList(),
            groups = teacherGroups
        });
    }

    /// <summary>
    /// Get all surveys (filtered by user role and targets)
    /// </summary>
    /// <param name="category">Filter by category (course, teacher, service)</param>
    /// <param name="published">Filter by published status</param>
    /// <param name="includeStats">Include response statistics</param>
    /// <returns>List of surveys</returns>
    [HttpGet]
    public async Task<IActionResult> GetSurveys(
        [FromQuery] string? category = null,
        [FromQuery] bool? published = null,
        [FromQuery] bool includeStats = false)
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "student";
        var normalizedEmail = email?.ToLowerInvariant() ?? "";

        var query = _db.Surveys.AsQueryable();

        // Students only see published surveys
        if (role == "student")
        {
            query = query.Where(s => s.Published);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(s => s.Category == category);
        }

        if (published.HasValue)
        {
            query = query.Where(s => s.Published == published.Value);
        }

        // Filter by target audience (teachers always see their own surveys)
        var targetRole = role + "s";
        if (role == "teacher")
        {
            // Teachers see surveys they own OR surveys targeting teachers
            query = query.Where(s => 
                (s.OwnerEmail ?? string.Empty).ToLower() == normalizedEmail ||
                string.IsNullOrEmpty(s.TargetAudience) || 
                s.TargetAudience == "all" || 
                s.TargetAudience == targetRole);
        }
        else
        {
            query = query.Where(s => 
                string.IsNullOrEmpty(s.TargetAudience) || 
                s.TargetAudience == "all" || 
                s.TargetAudience == targetRole);
        }

        // For students, filter by specific targeting
        if (role == "student" && !string.IsNullOrEmpty(email))
        {
            // Get student's group ID if they have one
            var student = await _db.Students.AsNoTracking()
                .FirstOrDefaultAsync(st => st.Email.ToLower() == email.ToLower());
            var studentGroupId = student?.ClassGroupId;

            query = query.Where(s => 
                // No specific targeting = show to all
                (string.IsNullOrEmpty(s.TargetStudentsJson) && string.IsNullOrEmpty(s.TargetGroupId)) ||
                // Specific student targeting
                (!string.IsNullOrEmpty(s.TargetStudentsJson) && s.TargetStudentsJson.Contains(email)) ||
                // Group targeting
                (!string.IsNullOrEmpty(s.TargetGroupId) && s.TargetGroupId == studentGroupId)
            );
        }

        // TODO: Filter by faculty/program based on user profile

        var surveys = await query
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        var result = new List<SurveyModel>();

        foreach (var survey in surveys)
        {
            var model = MapToModel(survey);

            if (includeStats)
            {
                var responseCount = await _db.SurveyResponses
                    .Where(r => r.SurveyId == survey.Id)
                    .CountAsync();
                model.ResponseCount = responseCount;

                // Check if current user has responded
                if (!string.IsNullOrEmpty(email))
                {
                    var hasResponded = await _db.SurveyResponses
                        .AnyAsync(r => r.SurveyId == survey.Id && r.StudentEmail == email);
                    model.HasResponded = hasResponded;
                }
            }

            result.Add(model);
        }

        return Ok(result);
    }

    /// <summary>
    /// Get single survey by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetSurvey(string id, [FromQuery] bool includeStats = false)
    {
        var survey = await _db.Surveys.FindAsync(id);
        if (survey == null)
        {
            return NotFound(new { message = "Survey not found" });
        }

        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "student";
        
        // Students can only see published surveys
        if (role == "student" && !survey.Published)
        {
            return NotFound(new { message = "Survey not found" });
        }

        var model = MapToModel(survey);

        if (includeStats)
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            model.ResponseCount = await _db.SurveyResponses
                .Where(r => r.SurveyId == id)
                .CountAsync();

            if (!string.IsNullOrEmpty(email))
            {
                model.HasResponded = await _db.SurveyResponses
                    .AnyAsync(r => r.SurveyId == id && r.StudentEmail == email);
            }
        }

        return Ok(model);
    }

    /// <summary>
    /// Create new survey (teachers only)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "teacher")]
    public async Task<IActionResult> CreateSurvey([FromBody] SurveyCreateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required" });
        }

        var email = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";
        var id = $"survey_{Guid.NewGuid():N}";

        var entity = new SurveyEntity
        {
            Id = id,
            Title = request.Title,
            Category = request.Category ?? "general",
            IsAnonymous = request.IsAnonymous ?? true,
            OpenAt = request.OpenAt ?? DateTime.UtcNow.ToString("yyyy-MM-dd"),
            CloseAt = request.CloseAt ?? DateTime.UtcNow.AddMonths(3).ToString("yyyy-MM-dd"),
            MetaJson = request.Meta != null ? JsonSerializer.Serialize(request.Meta) : null,
            QuestionsJson = request.Questions != null ? JsonSerializer.Serialize(request.Questions) : "[]",
            Published = request.Published ?? false,
            OwnerId = email,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            TargetAudience = request.TargetAudience,
            TargetFaculty = request.TargetFaculty,
            TargetProgram = request.TargetProgram,
            TargetStudentsJson = request.TargetStudents != null && request.TargetStudents.Count > 0 
                ? JsonSerializer.Serialize(request.TargetStudents) 
                : null,
            TargetGroupId = request.TargetGroupId
        };

        _db.Surveys.Add(entity);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Survey {Id} created by {Email}", id, email);

        // Notify via SignalR
        await _dataUpdateService.NotifySurveyUpdated(id, "created");

        return Created($"/api/surveys/{id}", MapToModel(entity));
    }

    /// <summary>
    /// Update existing survey (owner or teacher only)
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "teacher")]
    public async Task<IActionResult> UpdateSurvey(string id, [FromBody] SurveyCreateRequest request)
    {
        var survey = await _db.Surveys.FindAsync(id);
        if (survey == null)
        {
            return NotFound(new { message = "Survey not found" });
        }

        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        
        // Only owner can update
        if (survey.OwnerId != email && email != "system")
        {
            return Forbid();
        }

        if (!string.IsNullOrWhiteSpace(request.Title))
            survey.Title = request.Title;
        
        if (request.Category != null)
            survey.Category = request.Category;
        
        if (request.IsAnonymous.HasValue)
            survey.IsAnonymous = request.IsAnonymous.Value;
        
        if (request.OpenAt != null)
            survey.OpenAt = request.OpenAt;
        
        if (request.CloseAt != null)
            survey.CloseAt = request.CloseAt;
        
        if (request.Meta != null)
            survey.MetaJson = JsonSerializer.Serialize(request.Meta);
        
        if (request.Questions != null)
            survey.QuestionsJson = JsonSerializer.Serialize(request.Questions);
        
        if (request.Published.HasValue)
            survey.Published = request.Published.Value;
        
        if (request.TargetAudience != null)
            survey.TargetAudience = request.TargetAudience;
        
        if (request.TargetFaculty != null)
            survey.TargetFaculty = request.TargetFaculty;
        
        if (request.TargetProgram != null)
            survey.TargetProgram = request.TargetProgram;
        
        if (request.TargetStudents != null)
            survey.TargetStudentsJson = request.TargetStudents.Count > 0 
                ? JsonSerializer.Serialize(request.TargetStudents) 
                : null;
        
        if (request.TargetGroupId != null)
            survey.TargetGroupId = request.TargetGroupId;

        survey.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Survey {Id} updated by {Email}", id, email);

        // Notify via SignalR
        await _dataUpdateService.NotifySurveyUpdated(id, "updated");

        return Ok(MapToModel(survey));
    }

    /// <summary>
    /// Delete survey (owner only)
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "teacher")]
    public async Task<IActionResult> DeleteSurvey(string id)
    {
        var survey = await _db.Surveys.FindAsync(id);
        if (survey == null)
        {
            return NotFound(new { message = "Survey not found" });
        }

        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        
        if (survey.OwnerId != email && email != "system")
        {
            return Forbid();
        }

        // Delete all responses first
        var responses = await _db.SurveyResponses.Where(r => r.SurveyId == id).ToListAsync();
        _db.SurveyResponses.RemoveRange(responses);

        _db.Surveys.Remove(survey);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Survey {Id} deleted by {Email}", id, email);

        // Notify via SignalR
        await _dataUpdateService.NotifySurveyUpdated(id, "deleted");

        return Ok(new { message = "Survey deleted successfully" });
    }

    /// <summary>
    /// Submit survey response
    /// </summary>
    [HttpPost("{id}/respond")]
    public async Task<IActionResult> SubmitResponse(string id, [FromBody] SurveyResponseRequest request)
    {
        var survey = await _db.Surveys.FindAsync(id);
        if (survey == null)
        {
            return NotFound(new { message = "Survey not found" });
        }

        if (!survey.Published)
        {
            return BadRequest(new { message = "Survey is not published" });
        }

        // Check if survey is open
        var now = DateTime.UtcNow;
        if (DateTime.TryParse(survey.OpenAt, out var openDate) && now < openDate)
        {
            return BadRequest(new { message = "Survey has not opened yet" });
        }
        if (DateTime.TryParse(survey.CloseAt, out var closeDate) && now > closeDate.AddDays(1))
        {
            return BadRequest(new { message = "Survey has closed" });
        }

        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        var studentId = User.FindFirst("student_id")?.Value;

        // Validate required questions are answered
        var questions = JsonSerializer.Deserialize<List<SurveyQuestion>>(survey.QuestionsJson) ?? new();
        var requiredQuestions = questions.Where(q => q.Required != false).ToList();
        
        if (requiredQuestions.Any())
        {
            var missingAnswers = requiredQuestions
                .Where(q => !request.Answers.ContainsKey(q.Id) || 
                           request.Answers[q.Id] == null ||
                           (request.Answers[q.Id] is string str && string.IsNullOrWhiteSpace(str)))
                .ToList();
            
            if (missingAnswers.Any())
            {
                return BadRequest(new { 
                    message = $"Please answer all required questions. Missing {missingAnswers.Count} required answer(s).",
                    missingQuestions = missingAnswers.Select(q => q.Id).ToList()
                });
            }
        }

        // Check if user already responded (prevent duplicate responses)
        if (!survey.IsAnonymous && !string.IsNullOrEmpty(email))
        {
            var existing = await _db.SurveyResponses
                .FirstOrDefaultAsync(r => r.SurveyId == id && r.StudentEmail == email);
            
            if (existing != null)
            {
                return BadRequest(new { message = "You have already responded to this survey" });
            }
        }

        var responseId = $"response_{Guid.NewGuid():N}";

        var response = new SurveyResponseEntity
        {
            Id = responseId,
            SurveyId = id,
            StudentEmail = survey.IsAnonymous ? null : email,
            StudentId = survey.IsAnonymous ? null : studentId,
            AnswersJson = JsonSerializer.Serialize(request.Answers),
            SubmittedAt = DateTime.UtcNow,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString()
        };

        _db.SurveyResponses.Add(response);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Survey {SurveyId} response {ResponseId} submitted", id, responseId);

        return Ok(new { message = "Response submitted successfully", responseId });
    }

    /// <summary>
    /// Get survey responses (teachers/owners only)
    /// </summary>
    [HttpGet("{id}/responses")]
    [Authorize(Roles = "teacher")]
    public async Task<IActionResult> GetResponses(string id)
    {
        var survey = await _db.Surveys.FindAsync(id);
        if (survey == null)
        {
            return NotFound(new { message = "Survey not found" });
        }

        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        
        // Only owner can view responses
        if (survey.OwnerId != email && email != "system")
        {
            return Forbid();
        }

        var responses = await _db.SurveyResponses
            .Where(r => r.SurveyId == id)
            .OrderByDescending(r => r.SubmittedAt)
            .ToListAsync();

        var result = responses.Select(r => new
        {
            id = r.Id,
            surveyId = r.SurveyId,
            studentEmail = survey.IsAnonymous ? null : r.StudentEmail,
            answers = JsonSerializer.Deserialize<Dictionary<string, object>>(r.AnswersJson),
            submittedAt = r.SubmittedAt
        });

        return Ok(result);
    }

    /// <summary>
    /// Get survey analytics (teachers/owners only)
    /// </summary>
    [HttpGet("{id}/analytics")]
    [Authorize(Roles = "teacher")]
    public async Task<IActionResult> GetAnalytics(string id)
    {
        var survey = await _db.Surveys.FindAsync(id);
        if (survey == null)
        {
            return NotFound(new { message = "Survey not found" });
        }

        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        
        if (survey.OwnerId != email && email != "system")
        {
            return Forbid();
        }

        var responses = await _db.SurveyResponses
            .Where(r => r.SurveyId == id)
            .ToListAsync();

        var questions = JsonSerializer.Deserialize<List<SurveyQuestion>>(survey.QuestionsJson) ?? new();

        var questionStats = new Dictionary<string, QuestionStats>();

        foreach (var question in questions)
        {
            var stats = new QuestionStats
            {
                QuestionId = question.Id,
                QuestionText = question.Text,
                QuestionType = question.Type,
                ResponseCount = 0
            };

            var answers = new List<object>();

            foreach (var response in responses)
            {
                var answersDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(response.AnswersJson);
                if (answersDict != null && answersDict.TryGetValue(question.Id, out var answer))
                {
                    stats.ResponseCount++;
                    
                    // Parse answer based on type
                    if (question.Type == "likert5" || question.Type == "stars5")
                    {
                        if (answer.ValueKind == JsonValueKind.Number && answer.TryGetInt32(out var numValue))
                        {
                            answers.Add(numValue);
                        }
                    }
                    else if (question.Type == "yesno")
                    {
                        if (answer.ValueKind == JsonValueKind.True || answer.ValueKind == JsonValueKind.False)
                        {
                            answers.Add(answer.GetBoolean());
                        }
                    }
                    else if (question.Type == "text")
                    {
                        if (answer.ValueKind == JsonValueKind.String)
                        {
                            answers.Add(answer.GetString() ?? "");
                        }
                    }
                    else if (question.Type == "multichoice")
                    {
                        if (answer.ValueKind == JsonValueKind.Array)
                        {
                            var choices = answer.EnumerateArray()
                                .Where(e => e.ValueKind == JsonValueKind.String)
                                .Select(e => e.GetString() ?? "")
                                .ToList();
                            foreach (var choice in choices)
                            {
                                answers.Add(choice);
                            }
                        }
                    }
                }
            }

            // Calculate statistics based on question type
            if (question.Type == "likert5" || question.Type == "stars5")
            {
                var numericAnswers = answers.OfType<int>().ToList();
                if (numericAnswers.Any())
                {
                    stats.Average = Math.Round(numericAnswers.Average(), 2);
                    stats.Distribution = numericAnswers
                        .GroupBy(a => a.ToString())
                        .ToDictionary(g => g.Key, g => g.Count());
                }
            }
            else if (question.Type == "yesno")
            {
                var boolAnswers = answers.OfType<bool>().ToList();
                stats.YesCount = boolAnswers.Count(a => a);
                stats.NoCount = boolAnswers.Count(a => !a);
            }
            else if (question.Type == "multichoice")
            {
                var stringAnswers = answers.OfType<string>().ToList();
                stats.ChoiceCounts = stringAnswers
                    .GroupBy(a => a)
                    .ToDictionary(g => g.Key, g => g.Count());
            }
            else if (question.Type == "text")
            {
                stats.TextResponses = answers.OfType<string>().Where(s => !string.IsNullOrWhiteSpace(s)).ToList();
            }

            questionStats[question.Id] = stats;
        }

        var analytics = new SurveyAnalytics
        {
            SurveyId = id,
            Title = survey.Title,
            TotalResponses = responses.Count,
            QuestionStats = questionStats
        };

        return Ok(analytics);
    }

    private SurveyModel MapToModel(SurveyEntity entity)
    {
        Dictionary<string, object>? meta = null;
        if (!string.IsNullOrWhiteSpace(entity.MetaJson))
        {
            try
            {
                meta = JsonSerializer.Deserialize<Dictionary<string, object>>(entity.MetaJson);
            }
            catch { }
        }

        List<SurveyQuestion>? questions = null;
        if (!string.IsNullOrWhiteSpace(entity.QuestionsJson))
        {
            try
            {
                questions = JsonSerializer.Deserialize<List<SurveyQuestion>>(entity.QuestionsJson);
            }
            catch { }
        }

        List<string>? targetStudents = null;
        if (!string.IsNullOrWhiteSpace(entity.TargetStudentsJson))
        {
            try
            {
                targetStudents = JsonSerializer.Deserialize<List<string>>(entity.TargetStudentsJson);
            }
            catch { }
        }

        return new SurveyModel
        {
            Id = entity.Id,
            Title = entity.Title,
            Category = entity.Category,
            IsAnonymous = entity.IsAnonymous,
            OpenAt = entity.OpenAt,
            CloseAt = entity.CloseAt,
            Meta = meta,
            Questions = questions,
            Published = entity.Published,
            OwnerId = entity.OwnerId,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            TargetAudience = entity.TargetAudience,
            TargetFaculty = entity.TargetFaculty,
            TargetProgram = entity.TargetProgram,
            TargetStudents = targetStudents,
            TargetGroupId = entity.TargetGroupId
        };
    }
}
