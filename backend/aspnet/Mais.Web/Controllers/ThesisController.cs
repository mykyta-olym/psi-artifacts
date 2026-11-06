using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Hubs;
using System.Text.Json;
using Mais.Web.Services;

namespace Mais.Web.Controllers;

[Authorize]
public class ThesisController : BaseController
{
    private readonly AppDbContext _db;
    private readonly IDataUpdateService _dataUpdateService;
    private readonly IHubContext<ThesisHub> _thesisHub;

    public ThesisController(IWebHostEnvironment env, IConfiguration config, AppDbContext db, IDataUpdateService dataUpdateService, IHubContext<ThesisHub> thesisHub) : base(env, config)
    {
        _db = db;
        _dataUpdateService = dataUpdateService;
        _thesisHub = thesisHub;
    }

    private static string[] ParseKeywords(string? json)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(json)) return Array.Empty<string>();
            return System.Text.Json.JsonSerializer.Deserialize<string[]>(json!) ?? Array.Empty<string>();
        }
        catch { return Array.Empty<string>(); }
    }
    private static string ToKeywordsJson(IEnumerable<string>? arr)
    {
        return System.Text.Json.JsonSerializer.Serialize((arr ?? Array.Empty<string>()).ToArray());
    }

    /// <summary>
    /// Get authenticated student's thesis supervision
    /// </summary>
    /// <returns>Thesis supervision details including topic, supervisor, status, grades, and defense information</returns>
    /// <remarks>
    /// Requires authentication. Returns the most recent thesis supervision assigned to the authenticated student.
    /// 
    /// Returns null if no thesis supervision is found.
    /// Includes full thesis details: title, abstract, keywords, supervisor, originality check results, defense date, and grades.
    /// </remarks>
    [HttpGet("/api/thesis/my")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyThesis()
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var sup = await _db.ThesisSupervisions.AsNoTracking().OrderByDescending(x => x.AssignedAt)
            .FirstOrDefaultAsync(x => x.StudentEmail.ToLower() == email.ToLower());
        if (sup == null) return Ok(null);
        var map = new Dictionary<string, object?>
        {
            ["id"] = sup.Id,
            ["identifier"] = sup.Id.Length >= 6 ? sup.Id[^6..] : sup.Id,
            ["type"] = sup.Type,
            ["title"] = sup.Title,
            ["program"] = sup.Program,
            ["degree"] = sup.Degree,
            ["academicYear"] = sup.AcademicYear,
            ["assignedAt"] = sup.AssignedAt,
            ["dueAt"] = sup.DueAt,
            ["student"] = new { name = sup.StudentName, email = sup.StudentEmail, id = sup.StudentId },
            ["supervisor"] = new { name = sup.SupervisorName, email = sup.SupervisorEmail },
            ["attachments"] = Array.Empty<object>(),
            ["keywords"] = ParseKeywords(sup.KeywordsJson),
            ["abstract"] = sup.Abstract ?? string.Empty,
            ["annotation"] = sup.Annotation ?? string.Empty,
            ["originality"] = new { checkedAt = sup.OriginalityCheckedAt, percentage = sup.OriginalityPercentage, protocolUrl = sup.OriginalityProtocolUrl },
            ["defense"] = new { date = sup.DefenseDate, room = sup.DefenseRoom },
            ["grades"] = ParseGrades(sup.GradesJson),
            ["status"] = sup.Status,
        };
        return Ok(map);
    }

    /// <summary>
    /// Submit thesis for review (students only)
    /// </summary>
    /// <param name="req">Optional submission note</param>
    /// <returns>Success status</returns>
    /// <remarks>
    /// Requires authentication. Submits the student's thesis for review, changing status to "submitted".
    /// 
    /// Only students can submit their own thesis. Returns 404 if no thesis supervision is found.
    /// </remarks>
    [HttpPost("/api/thesis/my/submit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SubmitMyThesis([FromBody] SubmitNote req)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var sup = await _db.ThesisSupervisions.FirstOrDefaultAsync(x => x.StudentEmail.ToLower() == email.ToLower());
        if (sup == null) return NotFound(new { message = "No thesis supervision found" });
        sup.Status = "submitted";
        await _db.SaveChangesAsync();

        // Notify via SignalR
        await _dataUpdateService.NotifyThesisUpdated(sup.Id, "submitted", sup.StudentEmail, sup.SupervisorEmail);

        return Ok(new { ok = true });
    }

    public class SubmitNote { public string? Note { get; set; } }

    /// <summary>
    /// Get authenticated student's thesis requests
    /// </summary>
    /// <returns>List of thesis requests created by the student</returns>
    /// <remarks>
    /// Requires authentication. Returns all thesis requests created by the authenticated student.
    /// 
    /// Requests are ordered by most recently updated first.
    /// Includes draft and submitted requests.
    /// </remarks>
    [HttpGet("/api/thesis/requests/my")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyRequests()
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var items = await _db.ThesisRequests.AsNoTracking()
            .Where(x => x.StudentEmail.ToLower() == email.ToLower())
            .OrderByDescending(x => x.UpdatedAt)
            .ToListAsync();
        var list = items.Select(r => new
        {
            id = r.Id,
            academicYear = r.AcademicYear,
            degree = r.Degree,
            studyForm = r.StudyForm,
            program = r.Program,
            programCode = r.ProgramCode,
            language = r.Language,
            supervisorId = r.SupervisorEmail,
            topic = r.Topic,
            keywords = r.Keywords,
            note = r.Note,
            status = r.Status,
            submittedAt = r.SubmittedAt,
            updatedAt = r.UpdatedAt,
        });
        return Ok(list);
    }

    public class RequestDraft
    {
        public string? Id { get; set; }
        public string AcademicYear { get; set; } = string.Empty;
        public string Degree { get; set; } = "bsc";
        public string StudyForm { get; set; } = "full-time";
        public string Program { get; set; } = string.Empty;
        public string? ProgramCode { get; set; }
        public string Language { get; set; } = "EN";
        public string? SupervisorId { get; set; } // maps to SupervisorEmail
        public string? Topic { get; set; }
        public string? Keywords { get; set; }
        public string? Note { get; set; }
        public string Status { get; set; } = "draft"; // draft|submitted
        public DateTime? SubmittedAt { get; set; }
    }

    /// <summary>
    /// Create a new thesis request (students only)
    /// </summary>
    /// <param name="body">Thesis request details including topic, supervisor, program, and submission status</param>
    /// <returns>Created request identifier</returns>
    /// <remarks>
    /// Requires authentication. Creates a new thesis request.
    /// 
    /// Can be created as draft or submitted (based on Status field).
    /// If Status is "submitted", SubmittedAt is set automatically.
    /// Student information is automatically filled from authenticated user.
    /// </remarks>
    [HttpPost("/api/thesis/requests")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateRequest([FromBody] RequestDraft body)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var name = User.FindFirstValue("name") ?? email;
        var entity = new ThesisRequestEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            AcademicYear = body.AcademicYear,
            Degree = body.Degree,
            StudyForm = body.StudyForm,
            Program = body.Program,
            ProgramCode = body.ProgramCode,
            Language = body.Language,
            SupervisorEmail = body.SupervisorId,
            Topic = body.Topic,
            Keywords = body.Keywords,
            Note = body.Note,
            Status = body.Status ?? "draft",
            SubmittedAt = body.Status == "submitted" ? (body.SubmittedAt ?? DateTime.UtcNow) : null,
            UpdatedAt = DateTime.UtcNow,
            StudentEmail = email,
            StudentName = name,
        };
        _db.ThesisRequests.Add(entity);
        await _db.SaveChangesAsync();

        // Create activity for thesis request creation
        await CreateActivityForThesisRequestCreationAsync(entity, email, default);

        // Notify via SignalR
        await _dataUpdateService.NotifyThesisUpdated(entity.Id, "request_created", entity.StudentEmail, entity.SupervisorEmail);

        return Ok(new { id = entity.Id });
    }

    /// <summary>
    /// Update a thesis request (students only)
    /// </summary>
    /// <param name="id">Request identifier</param>
    /// <param name="body">Updated request details</param>
    /// <returns>Success status</returns>
    /// <remarks>
    /// Requires authentication. Updates an existing thesis request.
    /// 
    /// Only the student who created the request can update it.
    /// If Status is changed to "submitted", SubmittedAt is set automatically.
    /// Returns 404 if request not found or not owned by the student.
    /// </remarks>
    [HttpPut("/api/thesis/requests/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateRequest(string id, [FromBody] RequestDraft body)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var req = await _db.ThesisRequests.FirstOrDefaultAsync(x => x.Id == id && x.StudentEmail.ToLower() == email.ToLower());
        if (req == null) return NotFound();
        req.AcademicYear = body.AcademicYear;
        req.Degree = body.Degree;
        req.StudyForm = body.StudyForm;
        req.Program = body.Program;
        req.ProgramCode = body.ProgramCode;
        req.Language = body.Language;
        req.SupervisorEmail = body.SupervisorId;
        req.Topic = body.Topic;
        req.Keywords = body.Keywords;
        req.Note = body.Note;
        req.Status = body.Status ?? req.Status;
        req.SubmittedAt = req.Status == "submitted" ? (body.SubmittedAt ?? DateTime.UtcNow) : null;
        req.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Create activity for thesis request update
        await CreateActivityForThesisRequestUpdateAsync(req, email, default);

        // Notify via SignalR
        await _dataUpdateService.NotifyThesisUpdated(req.Id, "request_updated", req.StudentEmail, req.SupervisorEmail);

        return Ok(new { ok = true });
    }

    /// <summary>
    /// Cancel a thesis request (students only)
    /// </summary>
    /// <param name="id">Request identifier</param>
    /// <returns>Success status</returns>
    /// <remarks>
    /// Requires authentication. Cancels a thesis request by setting status to "canceled".
    /// 
    /// Only the student who created the request can cancel it.
    /// Returns 404 if request not found or not owned by the student.
    /// </remarks>
    [HttpPost("/api/thesis/requests/{id}/cancel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelRequest(string id)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var req = await _db.ThesisRequests.FirstOrDefaultAsync(x => x.Id == id && x.StudentEmail.ToLower() == email.ToLower());
        if (req == null) return NotFound();
        req.Status = "canceled";
        req.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Create activity for thesis request cancellation
        await CreateActivityForThesisRequestCancellationAsync(req, email, default);

        // Notify via SignalR
        await _dataUpdateService.NotifyThesisUpdated(req.Id, "request_canceled", req.StudentEmail, req.SupervisorEmail);

        return Ok(new { ok = true });
    }

    /// <summary>
    /// Delete a thesis request (students only)
    /// </summary>
    /// <param name="id">Request identifier</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Requires authentication. Permanently deletes a thesis request.
    /// 
    /// Only the student who created the request can delete it.
    /// Returns 404 if request not found or not owned by the student.
    /// </remarks>
    [HttpDelete("/api/thesis/requests/{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteRequest(string id)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var req = await _db.ThesisRequests.FirstOrDefaultAsync(x => x.Id == id && x.StudentEmail.ToLower() == email.ToLower());
        if (req == null) return NotFound();

        // Create activity for thesis request deletion before removing
        await CreateActivityForThesisRequestDeletionAsync(req, email, default);

        _db.ThesisRequests.Remove(req);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Browse available thesis topics (public)
    /// </summary>
    /// <param name="q">Search query (searches in title, description, supervisor name)</param>
    /// <param name="year">Academic year filter (not currently used)</param>
    /// <param name="degree">Degree filter (not currently used)</param>
    /// <param name="faculty">Faculty filter</param>
    /// <param name="department">Department filter</param>
    /// <param name="program">Program filter</param>
    /// <param name="state">State filter: "unassigned" or "assigned"</param>
    /// <param name="sort">Sort order: "oldest", "title", "supervisor", or default (newest first)</param>
    /// <returns>List of available thesis topics</returns>
    /// <remarks>
    /// Public endpoint (no authentication required). Returns available thesis topics with filtering and sorting options.
    /// 
    /// Topics are filtered by state: "unassigned" shows open topics with capacity, "assigned" shows all others.
    /// Default sort is newest first.
    /// </remarks>
    [AllowAnonymous]
    [HttpGet("/api/thesis/topics")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListTopics([FromQuery] string? q, [FromQuery] string? year, [FromQuery] string? degree,
        [FromQuery] string? faculty, [FromQuery] string? department, [FromQuery] string? program, [FromQuery] string? state, [FromQuery] string? sort)
    {
        var query = _db.ThesisTopics.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var t = q.Trim().ToLower();
            query = query.Where(x => (x.Title ?? "").ToLower().Contains(t) || (x.Description ?? "").ToLower().Contains(t) || (x.SupervisorName ?? "").ToLower().Contains(t));
        }
        if (!string.IsNullOrWhiteSpace(faculty) && faculty != "all") query = query.Where(x => x.Faculty == faculty);
        if (!string.IsNullOrWhiteSpace(department) && department != "all") query = query.Where(x => x.Department == department);
        if (!string.IsNullOrWhiteSpace(program) && program != "all") query = query.Where(x => x.Program == program || x.ProgramLabel == program);
        if (!string.IsNullOrWhiteSpace(state) && state != "all")
        {
            if (state == "unassigned") query = query.Where(x => x.State == "open" && (x.Capacity == null || x.Capacity > 0));
            if (state == "assigned") query = query.Where(x => x.State != "open" || (x.Capacity != null && x.Capacity <= 0));
        }
        var list = await query.ToListAsync();
        var res = list.Select(t => new
        {
            id = t.Id,
            academicYear = year ?? DateTime.UtcNow.Year + "/" + (DateTime.UtcNow.Year + 1),
            type = t.Type,
            program = t.Program,
            programLabel = t.ProgramLabel,
            faculty = t.Faculty,
            department = t.Department,
            title = t.Title,
            description = t.Description,
            keywords = ParseKeywords(t.KeywordsJson),
            supervisor = new { id = t.SupervisorEmail, name = t.SupervisorName ?? t.SupervisorEmail, email = t.SupervisorEmail, department = t.Department },
            assignedTo = (string?)null,
            state = (t.State == "open" && (t.Capacity == null || t.Capacity > 0)) ? "unassigned" : "assigned",
            createdAt = t.CreatedAt,
        });
        // Sorting
        res = sort switch
        {
            "oldest" => res.OrderBy(x => x.createdAt),
            "title" => res.OrderBy(x => x.title),
            "supervisor" => res.OrderBy(x => x.supervisor.name),
            _ => res.OrderByDescending(x => x.createdAt)
        };
        return Ok(res);
    }

    /// <summary>
    /// Get thesis topics created by a teacher (teachers only)
    /// </summary>
    /// <param name="supervisor">Optional supervisor email (defaults to authenticated teacher)</param>
    /// <returns>List of thesis topics created by the supervisor</returns>
    /// <remarks>
    /// Requires teacher role. Returns all thesis topics created by the specified supervisor.
    /// 
    /// If supervisor parameter is not provided, uses the authenticated teacher's email.
    /// Topics are ordered by most recently updated first.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpGet("/api/thesis/topics/my")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> MyTopics([FromQuery] string? supervisor)
    {
        var email = supervisor ?? (User.FindFirstValue(ClaimTypes.Email) ?? string.Empty);
        var list = await _db.ThesisTopics.AsNoTracking()
            .Where(x => x.SupervisorEmail.ToLower() == email.ToLower())
            .OrderByDescending(x => x.UpdatedAt)
            .ToListAsync();
        var mapped = list.Select(t => new
        {
            id = t.Id,
            type = t.Type,
            title = t.Title,
            program = t.Program,
            programLabel = t.ProgramLabel,
            faculty = t.Faculty,
            department = t.Department,
            keywords = ParseKeywords(t.KeywordsJson),
            description = t.Description,
            supervisor = new { id = t.SupervisorEmail, name = t.SupervisorName ?? t.SupervisorEmail, email = t.SupervisorEmail, department = t.Department },
            capacity = t.Capacity,
            state = t.State,
            createdAt = t.CreatedAt,
            updatedAt = t.UpdatedAt,
        });
        return Ok(mapped);
    }

    public class TopicInput
    {
        public string? Id { get; set; }
        public string Type { get; set; } = "Bachelor thesis";
        public string Title { get; set; } = string.Empty;
        public string? Program { get; set; }
        public string? ProgramLabel { get; set; }
        public string? Faculty { get; set; }
        public string? Department { get; set; }
        public IEnumerable<string>? Keywords { get; set; }
        public string? Description { get; set; }
        public int? Capacity { get; set; }
        public string State { get; set; } = "open";
        public object? Supervisor { get; set; }
    }

    /// <summary>
    /// Create a new thesis topic (teachers only)
    /// </summary>
    /// <param name="input">Thesis topic details including title, description, program, keywords, and capacity</param>
    /// <returns>Created topic identifier</returns>
    /// <remarks>
    /// Requires teacher role. Creates a new thesis topic.
    /// 
    /// Supervisor information is automatically filled from authenticated teacher.
    /// Topic can be created with capacity limit (number of students that can be assigned).
    /// Default state is "open".
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpPost("/api/thesis/topics")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateTopic([FromBody] TopicInput input)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var name = User.FindFirstValue("name") ?? email;
        // If faculty/department/program not provided, inherit from teacher profile
        string? facName = input.Faculty; 
        string? deptName = input.Department;
        string? progName = input.Program;
        string? progLabel = input.ProgramLabel;
        
        if (string.IsNullOrWhiteSpace(facName) || string.IsNullOrWhiteSpace(deptName) || string.IsNullOrWhiteSpace(progName))
        {
            try
            {
                var fac = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == email.ToLower());
                if (fac != null)
                {
                    if (string.IsNullOrWhiteSpace(facName)) facName = fac.Faculty;
                    if (string.IsNullOrWhiteSpace(progName)) progName = fac.Program;
                    if (string.IsNullOrWhiteSpace(progLabel)) progLabel = fac.Program; // Use same as program if not set
                    if (string.IsNullOrWhiteSpace(deptName))
                    {
                        try
                        {
                            var deps = System.Text.Json.JsonSerializer.Deserialize<List<string>>(fac.DepartmentsJson ?? "[]");
                            deptName = deps?.FirstOrDefault() ?? deptName;
                        }
                        catch { /* ignore */ }
                    }
                }
            }
            catch { /* ignore */ }
        }
        var e = new ThesisTopicEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = input.Type,
            Title = input.Title,
            Program = progName,
            ProgramLabel = progLabel,
            Faculty = facName,
            Department = deptName,
            KeywordsJson = ToKeywordsJson(input.Keywords),
            Description = input.Description,
            SupervisorEmail = email,
            SupervisorName = name,
            Capacity = input.Capacity ?? 1,
            State = input.State,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _db.ThesisTopics.Add(e);
        await _db.SaveChangesAsync();

        // Create activity for thesis topic creation
        await CreateActivityForThesisTopicCreationAsync(e, email, default);

        // Notify via SignalR
        await _dataUpdateService.NotifyThesisUpdated(e.Id, "topic_created", null, email);

        return Ok(new { id = e.Id });
    }

    /// <summary>
    /// Update a thesis topic (teachers only)
    /// </summary>
    /// <param name="id">Topic identifier</param>
    /// <param name="input">Updated topic details</param>
    /// <returns>Success status</returns>
    /// <remarks>
    /// Requires teacher role. Updates an existing thesis topic.
    /// 
    /// Only the teacher who created the topic can update it.
    /// Returns 404 if topic not found or not owned by the teacher.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpPut("/api/thesis/topics/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateTopic(string id, [FromBody] TopicInput input)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var t = await _db.ThesisTopics.FirstOrDefaultAsync(x => x.Id == id && x.SupervisorEmail.ToLower() == email.ToLower());
        if (t == null) return NotFound();
        t.Type = input.Type;
        t.Title = input.Title;
        t.Program = input.Program;
        t.ProgramLabel = input.ProgramLabel;
        t.Faculty = input.Faculty;
        t.Department = input.Department;
        t.KeywordsJson = ToKeywordsJson(input.Keywords);
        t.Description = input.Description;
        t.Capacity = input.Capacity ?? t.Capacity;
        t.State = input.State;
        t.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Create activity for thesis topic update
        await CreateActivityForThesisTopicUpdateAsync(t, email, default);

        // Notify via SignalR
        await _dataUpdateService.NotifyThesisUpdated(t.Id, "topic_updated", null, email);

        return Ok(new { ok = true });
    }

    /// <summary>
    /// Delete a thesis topic (teachers only)
    /// </summary>
    /// <param name="id">Topic identifier</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Requires teacher role. Permanently deletes a thesis topic.
    /// 
    /// Only the teacher who created the topic can delete it.
    /// Returns 404 if topic not found or not owned by the teacher.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpDelete("/api/thesis/topics/{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTopic(string id)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var t = await _db.ThesisTopics.FirstOrDefaultAsync(x => x.Id == id && x.SupervisorEmail.ToLower() == email.ToLower());
        if (t == null) return NotFound();

        // Create activity for thesis topic deletion before removing
        await CreateActivityForThesisTopicDeletionAsync(t, email, default);

        _db.ThesisTopics.Remove(t);
        await _db.SaveChangesAsync();

        // Notify via SignalR
        await _dataUpdateService.NotifyThesisUpdated(t.Id, "topic_deleted", null, email);

        return NoContent();
    }

    /// <summary>
    /// Get incoming thesis requests for a teacher (teachers only)
    /// </summary>
    /// <param name="supervisor">Optional supervisor email (defaults to authenticated teacher)</param>
    /// <returns>List of thesis requests assigned to the supervisor</returns>
    /// <remarks>
    /// Requires teacher role. Returns all thesis requests assigned to the specified supervisor.
    /// 
    /// If supervisor parameter is not provided, uses the authenticated teacher's email.
    /// Requests are ordered by most recently updated first.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpGet("/api/thesis/requests/incoming")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Incoming([FromQuery] string? supervisor)
    {
        var email = supervisor ?? (User.FindFirstValue(ClaimTypes.Email) ?? string.Empty);
        var items = await _db.ThesisRequests.AsNoTracking()
            .Where(x => x.SupervisorEmail != null && x.SupervisorEmail.ToLower() == email.ToLower())
            .OrderByDescending(x => x.UpdatedAt).ToListAsync();
        var list = items.Select(r => new
        {
            id = r.Id,
            academicYear = r.AcademicYear,
            degree = r.Degree,
            studyForm = r.StudyForm,
            program = r.Program,
            programCode = r.ProgramCode,
            language = r.Language,
            supervisorId = r.SupervisorEmail,
            topic = r.Topic,
            keywords = r.Keywords,
            note = r.Note,
            status = r.Status,
            submittedAt = r.SubmittedAt,
            updatedAt = r.UpdatedAt,
            student = new { id = r.StudentId, name = r.StudentName, email = r.StudentEmail },
        });
        return Ok(list);
    }

    public class ApproveBody { public string? TopicId { get; set; } public string? Message { get; set; } }
    public class MessageBody { public string? Message { get; set; } }

    /// <summary>
    /// Approve a thesis request and create supervision (teachers only)
    /// </summary>
    /// <param name="id">Request identifier</param>
    /// <param name="body">Approval details with optional topic ID and message</param>
    /// <returns>Created supervision identifier</returns>
    /// <remarks>
    /// Requires teacher role. Approves a thesis request and creates a thesis supervision.
    /// 
    /// Process:
    /// - If TopicId is provided, links to existing topic (decrements capacity if applicable)
    /// - If no TopicId but request has topic, creates a new closed topic from the request
    /// - Creates a new thesis supervision record
    /// - Sets request status to "approved"
    /// - Default due date is set to June 20 of next year
    /// 
    /// Only the assigned supervisor can approve the request.
    /// Returns 404 if request not found or not assigned to the teacher.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpPost("/api/thesis/requests/{id}/approve")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Approve(string id, [FromBody] ApproveBody body)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var req = await _db.ThesisRequests.FirstOrDefaultAsync(x => x.Id == id && x.SupervisorEmail != null && x.SupervisorEmail.ToLower() == email.ToLower());
        if (req == null) return NotFound();
        // Optionally attach to topic or create a new closed topic
        ThesisTopicEntity? topic = null;
        if (!string.IsNullOrWhiteSpace(body.TopicId))
        {
            topic = await _db.ThesisTopics.FirstOrDefaultAsync(x => x.Id == body.TopicId);
        }
        if (topic == null && !string.IsNullOrWhiteSpace(req.Topic))
        {
            // Inherit org info from supervisor's faculty record when creating a topic from a request
            string? supFaculty = null; string? supDepartment = null; string supName = User.FindFirstValue("name") ?? email;
            try
            {
                var fac = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == email.ToLower());
                if (fac != null)
                {
                    supFaculty = fac.Faculty;
                    try
                    {
                        var deps = System.Text.Json.JsonSerializer.Deserialize<List<string>>(fac.DepartmentsJson ?? "[]");
                        supDepartment = deps?.FirstOrDefault();
                    }
                    catch { /* ignore */ }
                }
            }
            catch { /* ignore */ }
            topic = new ThesisTopicEntity
            {
                Id = Guid.NewGuid().ToString("N"),
                Type = req.Degree == "bsc" ? "Bachelor thesis" : "Master thesis",
                Title = req.Topic!,
                Program = req.ProgramCode,
                ProgramLabel = req.Program,
                Faculty = supFaculty,
                Department = supDepartment,
                KeywordsJson = ToKeywordsJson((req.Keywords ?? "").Split(',').Select(x => x.Trim()).Where(x => x.Length > 0)),
                Description = req.Note ?? "Topic created from student request.",
                SupervisorEmail = email,
                SupervisorName = supName,
                Capacity = 1,
                State = "closed",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            _db.ThesisTopics.Add(topic);
        }
        // Create supervision
        var sup = new ThesisSupervisionEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            TopicId = topic?.Id,
            Type = topic?.Type ?? (req.Degree == "bsc" ? "Bachelor thesis" : "Master thesis"),
            Title = topic?.Title ?? req.Topic ?? "Thesis",
            StudentId = req.StudentId,
            StudentEmail = req.StudentEmail,
            StudentName = req.StudentName,
            SupervisorEmail = email,
            SupervisorName = User.FindFirstValue("name") ?? email,
            Program = topic?.ProgramLabel ?? req.Program,
            Degree = req.Degree.ToUpperInvariant(),
            AcademicYear = req.AcademicYear,
            AssignedAt = DateTime.UtcNow,
            DueAt = new DateTime(DateTime.UtcNow.Year + 1, 6, 20, 0, 0, 0, DateTimeKind.Utc),
            Status = "assigned",
            KeywordsJson = topic != null ? topic.KeywordsJson : ToKeywordsJson((req.Keywords ?? "").Split(',').Select(x => x.Trim()).Where(x => x.Length > 0)),
        };
        _db.ThesisSupervisions.Add(sup);
        req.Status = "approved";
        req.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Create activity for thesis request approval
        await CreateActivityForThesisRequestApprovalAsync(req, sup, email, default);

        // Notify via SignalR
        await _dataUpdateService.NotifyThesisUpdated(sup.Id, "request_approved", sup.StudentEmail, sup.SupervisorEmail);

        return Ok(new { id = sup.Id });
    }

    /// <summary>
    /// Return a thesis request for revision (teachers only)
    /// </summary>
    /// <param name="id">Request identifier</param>
    /// <param name="body">Optional return message</param>
    /// <returns>Success status</returns>
    /// <remarks>
    /// Requires teacher role. Returns a thesis request for revision by setting status to "returned".
    /// 
    /// The student can then update and resubmit the request.
    /// Only the assigned supervisor can return the request.
    /// Returns 404 if request not found or not assigned to the teacher.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpPost("/api/thesis/requests/{id}/return")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReturnReq(string id, [FromBody] MessageBody body)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var req = await _db.ThesisRequests.FirstOrDefaultAsync(x => x.Id == id && x.SupervisorEmail != null && x.SupervisorEmail.ToLower() == email.ToLower());
        if (req == null) return NotFound();
        req.Status = "returned";
        req.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Create activity for thesis request return
        await CreateActivityForThesisRequestReturnAsync(req, body?.Message, email, default);

        return Ok(new { ok = true });
    }

    /// <summary>
    /// Reject a thesis request (teachers only)
    /// </summary>
    /// <param name="id">Request identifier</param>
    /// <param name="body">Optional rejection message</param>
    /// <returns>Success status</returns>
    /// <remarks>
    /// Requires teacher role. Rejects a thesis request by setting status to "rejected".
    /// 
    /// Rejected requests cannot be resubmitted.
    /// Only the assigned supervisor can reject the request.
    /// Returns 404 if request not found or not assigned to the teacher.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpPost("/api/thesis/requests/{id}/reject")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RejectReq(string id, [FromBody] MessageBody body)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var req = await _db.ThesisRequests.FirstOrDefaultAsync(x => x.Id == id && x.SupervisorEmail != null && x.SupervisorEmail.ToLower() == email.ToLower());
        if (req == null) return NotFound();
        req.Status = "rejected";
        req.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Create activity for thesis request rejection
        await CreateActivityForThesisRequestRejectionAsync(req, email, body?.Message, default);

        return Ok(new { ok = true });
    }

    /// <summary>
    /// Get thesis supervisions for a teacher (teachers only)
    /// </summary>
    /// <param name="supervisor">Optional supervisor email (defaults to authenticated teacher)</param>
    /// <returns>List of thesis supervisions managed by the supervisor</returns>
    /// <remarks>
    /// Requires teacher role. Returns all thesis supervisions where the teacher is the supervisor.
    /// 
    /// If supervisor parameter is not provided, uses the authenticated teacher's email.
    /// Supervisions are ordered by most recently assigned first.
    /// Includes full details: student info, topic, originality check, defense date, and grades.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpGet("/api/thesis/supervisions")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListSupervisions([FromQuery] string? supervisor)
    {
        var email = supervisor ?? (User.FindFirstValue(ClaimTypes.Email) ?? string.Empty);
        var items = await _db.ThesisSupervisions.AsNoTracking()
            .Where(x => x.SupervisorEmail.ToLower() == email.ToLower())
            .OrderByDescending(x => x.AssignedAt).ToListAsync();
        var list = items.Select(t => new
        {
            id = t.Id,
            type = t.Type,
            title = t.Title,
            program = t.Program,
            degree = t.Degree,
            academicYear = t.AcademicYear,
            assignedAt = t.AssignedAt,
            dueAt = t.DueAt,
            student = new { id = t.StudentId, name = t.StudentName, email = t.StudentEmail },
            supervisor = new { name = t.SupervisorName, email = t.SupervisorEmail },
            originality = new { checkedAt = t.OriginalityCheckedAt, percentage = t.OriginalityPercentage, protocolUrl = t.OriginalityProtocolUrl },
            defense = new { date = t.DefenseDate, room = t.DefenseRoom },
            grades = ParseGrades(t.GradesJson),
            attachments = Array.Empty<object>(),
            keywords = ParseKeywords(t.KeywordsJson),
            status = t.Status,
        });
        return Ok(list);
    }

    public class StatusBody { public string Status { get; set; } = "assigned"; }
    /// <summary>
    /// Update thesis supervision status (teachers only)
    /// </summary>
    /// <param name="id">Supervision identifier</param>
    /// <param name="body">Status update request</param>
    /// <returns>Success status</returns>
    /// <remarks>
    /// Requires teacher role. Updates the status of a thesis supervision.
    /// 
    /// Common statuses: "assigned", "submitted", "in_review", "completed", etc.
    /// Only the supervisor can update the status.
    /// Returns 404 if supervision not found or not managed by the teacher.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpPost("/api/thesis/supervisions/{id}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] StatusBody body)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var sup = await _db.ThesisSupervisions.FirstOrDefaultAsync(x => x.Id == id && x.SupervisorEmail.ToLower() == email.ToLower());
        if (sup == null) return NotFound();
        var oldStatus = sup.Status;
        sup.Status = body.Status;
        await _db.SaveChangesAsync();

        // Create activity for thesis supervision status update
        await CreateActivityForThesisSupervisionStatusUpdateAsync(sup, oldStatus, body.Status, email, default);

        return Ok(new { ok = true });
    }

    public class DefenseBody { public string Date { get; set; } = string.Empty; public string Room { get; set; } = string.Empty; }
    /// <summary>
    /// Schedule thesis defense (teachers only)
    /// </summary>
    /// <param name="id">Supervision identifier</param>
    /// <param name="body">Defense details with date and room</param>
    /// <returns>Success status</returns>
    /// <remarks>
    /// Requires teacher role. Schedules the thesis defense date and room.
    /// 
    /// Only the supervisor can schedule the defense.
    /// Returns 404 if supervision not found or not managed by the teacher.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpPost("/api/thesis/supervisions/{id}/defense")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ScheduleDefense(string id, [FromBody] DefenseBody body)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var sup = await _db.ThesisSupervisions.FirstOrDefaultAsync(x => x.Id == id && x.SupervisorEmail.ToLower() == email.ToLower());
        if (sup == null) return NotFound();
        sup.DefenseDate = body.Date;
        sup.DefenseRoom = body.Room;
        await _db.SaveChangesAsync();

        // Create activity for thesis defense scheduling
        await CreateActivityForThesisDefenseSchedulingAsync(sup, body.Date, body.Room, email, default);

        return Ok(new { ok = true });
    }

    public class OriginalityBody { public double Percentage { get; set; } public string? ProtocolUrl { get; set; } }
    /// <summary>
    /// Update originality check results (teachers only)
    /// </summary>
    /// <param name="id">Supervision identifier</param>
    /// <param name="body">Originality check details with percentage and protocol URL</param>
    /// <returns>Success status</returns>
    /// <remarks>
    /// Requires teacher role. Records originality check results for a thesis.
    /// 
    /// Sets the originality percentage, protocol URL, and checked timestamp.
    /// Only the supervisor can update originality check results.
    /// Returns 404 if supervision not found or not managed by the teacher.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpPost("/api/thesis/supervisions/{id}/originality")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateOriginality(string id, [FromBody] OriginalityBody body)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var sup = await _db.ThesisSupervisions.FirstOrDefaultAsync(x => x.Id == id && x.SupervisorEmail.ToLower() == email.ToLower());
        if (sup == null) return NotFound();
        sup.OriginalityCheckedAt = DateTime.UtcNow;
        sup.OriginalityPercentage = body.Percentage;
        sup.OriginalityProtocolUrl = body.ProtocolUrl;
        await _db.SaveChangesAsync();

        // Create activity for originality check update
        await CreateActivityForThesisOriginalityUpdateAsync(sup, body.Percentage, body.ProtocolUrl, email, default);

        return Ok(new { ok = true });
    }

    public class GradeItem { public string Item { get; set; } = string.Empty; public string Term { get; set; } = "Current"; public string By { get; set; } = string.Empty; public string Grade { get; set; } = string.Empty; public string Date { get; set; } = string.Empty; }
    public class GradesBody { public List<GradeItem> Items { get; set; } = new(); }

    private static List<object> ParseGrades(string? json)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(json)) return new List<object>();
            var g = System.Text.Json.JsonSerializer.Deserialize<List<Dictionary<string, object>>>(json!) ?? new();
            return g.Cast<object>().ToList();
        }
        catch { return new List<object>(); }
    }
    /// <summary>
    /// Append grades to thesis supervision (teachers only)
    /// </summary>
    /// <param name="id">Supervision identifier</param>
    /// <param name="body">Grades to append with item, term, grader, grade, and date</param>
    /// <returns>Success status</returns>
    /// <remarks>
    /// Requires teacher role. Appends grade entries to a thesis supervision.
    /// 
    /// Grades are appended to existing grades (not replaced).
    /// Each grade entry includes item name, term, grader name, grade value, and date.
    /// Only the supervisor can append grades.
    /// Returns 404 if supervision not found or not managed by the teacher.
    /// </remarks>
    [Authorize(Roles = "teacher")]
    [HttpPost("/api/thesis/supervisions/{id}/grades")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AppendGrades(string id, [FromBody] GradesBody body)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var sup = await _db.ThesisSupervisions.FirstOrDefaultAsync(x => x.Id == id && x.SupervisorEmail.ToLower() == email.ToLower());
        if (sup == null) return NotFound();
        var existing = ParseGrades(sup.GradesJson);
        foreach (var it in body.Items ?? new List<GradeItem>())
        {
            existing.Add(new { item = it.Item, term = it.Term, by = it.By, grade = it.Grade, date = it.Date });
        }
        sup.GradesJson = System.Text.Json.JsonSerializer.Serialize(existing);
        await _db.SaveChangesAsync();

        // Create activity for thesis grades update
        await CreateActivityForThesisGradesUpdateAsync(sup, body.Items, email, default);

        return Ok(new { ok = true });
    }

    private async Task CreateActivityForThesisTopicCreationAsync(ThesisTopicEntity topic, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var meta = new Dictionary<string, object>
            {
                ["topicId"] = topic.Id,
                ["type"] = topic.Type ?? "",
                ["program"] = topic.Program ?? "",
                ["capacity"] = topic.Capacity ?? 0
            };

            var activity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Created thesis topic: {topic.Title}",
                Description = $"{topic.Type ?? ""} • Program: {topic.ProgramLabel ?? topic.Program ?? ""} • Capacity: {topic.Capacity}",
                Subject = topic.ProgramLabel ?? topic.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(activity);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisTopicUpdateAsync(ThesisTopicEntity topic, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var meta = new Dictionary<string, object>
            {
                ["topicId"] = topic.Id,
                ["state"] = topic.State ?? ""
            };

            var activity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Updated thesis topic: {topic.Title}",
                Description = $"State: {topic.State} • Program: {topic.ProgramLabel ?? topic.Program}",
                Subject = topic.ProgramLabel ?? topic.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(activity);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisTopicDeletionAsync(ThesisTopicEntity topic, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var meta = new Dictionary<string, object>
            {
                ["topicId"] = topic.Id,
                ["title"] = topic.Title ?? ""
            };

            var activity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Deleted thesis topic: {topic.Title}",
                Description = $"Topic was deleted",
                Subject = topic.ProgramLabel ?? topic.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(activity);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisRequestCreationAsync(ThesisRequestEntity req, string studentEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == studentEmail.ToLower(), ct);
            var studentName = student?.FullName ?? req.StudentName ?? studentEmail;

            var supervisorEmail = req.SupervisorEmail ?? "";
            var supervisor = !string.IsNullOrWhiteSpace(supervisorEmail)
                ? await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == supervisorEmail.ToLower(), ct)
                : null;
            var supervisorName = supervisor?.FullName ?? supervisorEmail;

            var meta = new Dictionary<string, object>
            {
                ["requestId"] = req.Id,
                ["status"] = req.Status ?? "draft",
                ["degree"] = req.Degree ?? "",
                ["program"] = req.Program ?? ""
            };

            // Create activity for student
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = req.Status == "submitted" ? $"Submitted thesis request: {req.Topic}" : $"Created thesis request: {req.Topic}",
                Description = $"Status: {req.Status} • Supervisor: {supervisorName}",
                Subject = req.Program ?? "",
                StudentEmail = studentEmail,
                StudentName = studentName,
                TeacherEmail = supervisorEmail,
                TeacherDisplay = supervisorName,
                Timestamp = now.ToString("o"),
                RequiresAction = req.Status == "submitted",
                Priority = req.Status == "submitted" ? "high" : "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = studentEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activity for supervisor if submitted
            if (req.Status == "submitted" && !string.IsNullOrWhiteSpace(supervisorEmail))
            {
                var supervisorActivity = new ActivityEntity
                {
                    Id = $"{activityId}_supervisor",
                    Type = "announcements",
                    Title = $"New thesis request: {req.Topic}",
                    Description = $"Student: {studentName} • Degree: {req.Degree} • Program: {req.Program}",
                    Subject = req.Program ?? "",
                    TeacherEmail = supervisorEmail,
                    TeacherDisplay = supervisorName,
                    StudentEmail = studentEmail,
                    StudentName = studentName,
                    Timestamp = now.ToString("o"),
                    RequiresAction = true,
                    Priority = "high",
                    MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                    CreatedByEmail = studentEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(supervisorActivity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisRequestUpdateAsync(ThesisRequestEntity req, string studentEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == studentEmail.ToLower(), ct);
            var studentName = student?.FullName ?? req.StudentName ?? studentEmail;

            var supervisorEmail = req.SupervisorEmail ?? "";
            var supervisor = !string.IsNullOrWhiteSpace(supervisorEmail)
                ? await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == supervisorEmail.ToLower(), ct)
                : null;
            var supervisorName = supervisor?.FullName ?? supervisorEmail;

            var meta = new Dictionary<string, object>
            {
                ["requestId"] = req.Id,
                ["status"] = req.Status ?? "draft"
            };

            // Create activity for student
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = req.Status == "submitted" ? $"Submitted thesis request: {req.Topic}" : $"Updated thesis request: {req.Topic}",
                Description = $"Status: {req.Status}",
                Subject = req.Program ?? "",
                StudentEmail = studentEmail,
                StudentName = studentName,
                TeacherEmail = supervisorEmail,
                TeacherDisplay = supervisorName,
                Timestamp = now.ToString("o"),
                RequiresAction = req.Status == "submitted",
                Priority = req.Status == "submitted" ? "high" : "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = studentEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activity for supervisor if submitted
            if (req.Status == "submitted" && !string.IsNullOrWhiteSpace(supervisorEmail))
            {
                var supervisorActivity = new ActivityEntity
                {
                    Id = $"{activityId}_supervisor",
                    Type = "announcements",
                    Title = $"Thesis request submitted: {req.Topic}",
                    Description = $"Student: {studentName} • Status: {req.Status}",
                    Subject = req.Program ?? "",
                    TeacherEmail = supervisorEmail,
                    TeacherDisplay = supervisorName,
                    StudentEmail = studentEmail,
                    StudentName = studentName,
                    Timestamp = now.ToString("o"),
                    RequiresAction = true,
                    Priority = "high",
                    MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                    CreatedByEmail = studentEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(supervisorActivity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisRequestDeletionAsync(ThesisRequestEntity req, string studentEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == studentEmail.ToLower(), ct);
            var studentName = student?.FullName ?? req.StudentName ?? studentEmail;

            var meta = new Dictionary<string, object>
            {
                ["requestId"] = req.Id,
                ["topic"] = req.Topic ?? ""
            };

            var activity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Deleted thesis request: {req.Topic}",
                Description = "Thesis request was deleted",
                Subject = req.Program ?? "",
                StudentEmail = studentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = studentEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(activity);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisRequestApprovalAsync(ThesisRequestEntity req, ThesisSupervisionEntity sup, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == (req.StudentEmail ?? "").ToLower(), ct);
            var studentName = student?.FullName ?? req.StudentName ?? req.StudentEmail ?? "";

            var meta = new Dictionary<string, object>
            {
                ["requestId"] = req.Id,
                ["supervisionId"] = sup.Id,
                ["topicId"] = sup.TopicId ?? "",
                ["title"] = sup.Title ?? ""
            };

            // Create activity for student
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Thesis request approved: {sup.Title}",
                Description = $"Supervisor: {teacherName} • Status: {sup.Status}",
                Subject = sup.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = req.StudentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = true,
                Priority = "high",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Approved thesis request: {studentName}",
                Description = $"Topic: {sup.Title} • Status: {sup.Status}",
                Subject = sup.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = req.StudentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisRequestRejectionAsync(ThesisRequestEntity req, string teacherEmail, string? message, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == (req.StudentEmail ?? "").ToLower(), ct);
            var studentName = student?.FullName ?? req.StudentName ?? req.StudentEmail ?? "";

            var meta = new Dictionary<string, object>
            {
                ["requestId"] = req.Id,
                ["topic"] = req.Topic ?? "",
                ["message"] = message ?? ""
            };

            // Create activity for student
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Thesis request rejected: {req.Topic}",
                Description = string.IsNullOrWhiteSpace(message) ? $"Rejected by {teacherName}" : $"Rejected by {teacherName}: {message}",
                Subject = req.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = req.StudentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = true,
                Priority = "high",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Rejected thesis request: {studentName}",
                Description = $"Topic: {req.Topic}",
                Subject = req.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = req.StudentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisRequestCancellationAsync(ThesisRequestEntity req, string studentEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == studentEmail.ToLower(), ct);
            var studentName = student?.FullName ?? req.StudentName ?? studentEmail;

            var supervisorEmail = req.SupervisorEmail ?? "";
            var supervisor = !string.IsNullOrWhiteSpace(supervisorEmail)
                ? await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == supervisorEmail.ToLower(), ct)
                : null;
            var supervisorName = supervisor?.FullName ?? supervisorEmail;

            var meta = new Dictionary<string, object>
            {
                ["requestId"] = req.Id,
                ["topic"] = req.Topic ?? ""
            };

            // Create activity for student
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Canceled thesis request: {req.Topic}",
                Description = "Thesis request was canceled",
                Subject = req.Program ?? "",
                StudentEmail = studentEmail,
                StudentName = studentName,
                TeacherEmail = supervisorEmail,
                TeacherDisplay = supervisorName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = studentEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activity for supervisor if exists
            if (!string.IsNullOrWhiteSpace(supervisorEmail))
            {
                var supervisorActivity = new ActivityEntity
                {
                    Id = $"{activityId}_supervisor",
                    Type = "announcements",
                    Title = $"Thesis request canceled: {studentName}",
                    Description = $"Topic: {req.Topic}",
                    Subject = req.Program ?? "",
                    TeacherEmail = supervisorEmail,
                    TeacherDisplay = supervisorName,
                    StudentEmail = studentEmail,
                    StudentName = studentName,
                    Timestamp = now.ToString("o"),
                    RequiresAction = false,
                    Priority = "low",
                    MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                    CreatedByEmail = studentEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(supervisorActivity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisSupervisionStatusUpdateAsync(ThesisSupervisionEntity sup, string oldStatus, string newStatus, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == (sup.StudentEmail ?? "").ToLower(), ct);
            var studentName = student?.FullName ?? sup.StudentName ?? sup.StudentEmail ?? "";

            var meta = new Dictionary<string, object>
            {
                ["supervisionId"] = sup.Id,
                ["oldStatus"] = oldStatus,
                ["newStatus"] = newStatus
            };

            // Create activity for student
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Thesis status updated: {sup.Title}",
                Description = $"Status changed: {oldStatus} → {newStatus}",
                Subject = sup.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = sup.StudentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = newStatus == "submitted" || newStatus == "in_review",
                Priority = newStatus == "completed" ? "high" : "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Updated thesis status: {studentName}",
                Description = $"Status: {oldStatus} → {newStatus}",
                Subject = sup.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = sup.StudentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisDefenseSchedulingAsync(ThesisSupervisionEntity sup, string defenseDate, string defenseRoom, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == (sup.StudentEmail ?? "").ToLower(), ct);
            var studentName = student?.FullName ?? sup.StudentName ?? sup.StudentEmail ?? "";

            var meta = new Dictionary<string, object>
            {
                ["supervisionId"] = sup.Id,
                ["defenseDate"] = defenseDate,
                ["defenseRoom"] = defenseRoom ?? ""
            };

            // Create activity for student
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Thesis defense scheduled: {sup.Title}",
                Description = $"Defense date: {defenseDate} • Room: {defenseRoom ?? "TBA"}",
                Subject = sup.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = sup.StudentEmail,
                StudentName = studentName,
                Room = defenseRoom,
                Timestamp = now.ToString("o"),
                RequiresAction = true,
                Priority = "high",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Scheduled defense: {studentName}",
                Description = $"Defense date: {defenseDate} • Room: {defenseRoom ?? "TBA"}",
                Subject = sup.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = sup.StudentEmail,
                StudentName = studentName,
                Room = defenseRoom,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisOriginalityUpdateAsync(ThesisSupervisionEntity sup, double percentage, string? protocolUrl, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == (sup.StudentEmail ?? "").ToLower(), ct);
            var studentName = student?.FullName ?? sup.StudentName ?? sup.StudentEmail ?? "";

            var meta = new Dictionary<string, object>
            {
                ["supervisionId"] = sup.Id,
                ["percentage"] = percentage,
                ["protocolUrl"] = protocolUrl ?? ""
            };

            // Create activity for student
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Originality check completed: {sup.Title}",
                Description = $"Originality: {percentage:F1}%",
                Subject = sup.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = sup.StudentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = true,
                Priority = percentage < 80 ? "high" : "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Originality check recorded: {studentName}",
                Description = $"Originality: {percentage:F1}%",
                Subject = sup.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = sup.StudentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisGradesUpdateAsync(ThesisSupervisionEntity sup, List<GradeItem>? newGrades, string teacherEmail, CancellationToken ct)
    {
        try
        {
            if (newGrades == null || newGrades.Count == 0) return;

            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == (sup.StudentEmail ?? "").ToLower(), ct);
            var studentName = student?.FullName ?? sup.StudentName ?? sup.StudentEmail ?? "";

            var gradeItems = newGrades.Select(g => $"{g.Item}: {g.Grade}").ToList();
            var meta = new Dictionary<string, object>
            {
                ["supervisionId"] = sup.Id,
                ["gradesCount"] = newGrades.Count
            };

            // Create activity for student
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "grades",
                Title = $"Thesis grades updated: {sup.Title}",
                Description = $"New grades: {string.Join(", ", gradeItems)}",
                Subject = sup.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = sup.StudentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = true,
                Priority = "high",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "grades",
                Title = $"Recorded thesis grades: {studentName}",
                Description = $"Grades: {string.Join(", ", gradeItems)}",
                Subject = sup.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = sup.StudentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForThesisRequestReturnAsync(ThesisRequestEntity req, string? message, string teacherEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == (req.StudentEmail ?? "").ToLower(), ct);
            var studentName = student?.FullName ?? req.StudentName ?? req.StudentEmail ?? "";

            var meta = new Dictionary<string, object>
            {
                ["requestId"] = req.Id,
                ["topic"] = req.Topic ?? "",
                ["message"] = message ?? ""
            };

            // Create activity for student
            var studentActivity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Thesis request returned for revision: {req.Topic}",
                Description = string.IsNullOrWhiteSpace(message) ? $"Returned by {teacherName} for revision" : $"Returned by {teacherName}: {message}",
                Subject = req.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = req.StudentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = true,
                Priority = "high",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(studentActivity);

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Returned thesis request: {studentName}",
                Description = $"Topic: {req.Topic}",
                Subject = req.Program ?? "",
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                StudentEmail = req.StudentEmail,
                StudentName = studentName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }
}
