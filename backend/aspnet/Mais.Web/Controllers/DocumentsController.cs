using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Models.Documents;
using Mais.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mais.Web.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class DocumentsController : BaseController
{
    private readonly AppDbContext _db;
    private readonly IDocumentRenderService _renderer;
    private readonly ILogger<DocumentsController> _logger;
    private readonly IDataUpdateService _dataUpdateService;

    public DocumentsController(AppDbContext db, IDocumentRenderService renderer, ILogger<DocumentsController> logger, IDataUpdateService dataUpdateService, IWebHostEnvironment env, IConfiguration config)
        : base(env, config)
    {
        _db = db;
        _renderer = renderer;
        _logger = logger;
        _dataUpdateService = dataUpdateService;
    }

    private string CurrentEmail => User?.FindFirst(ClaimTypes.Email)?.Value ?? string.Empty;
    private string CurrentRole => User?.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;

    [HttpPost("render")]
    [Authorize(Policy = "RequireTeacher")]
    public async Task<ActionResult<DocumentRenderResponse>> RenderDocument([FromBody] DocumentRenderRequest request, CancellationToken ct)
    {
        if (request == null)
        {
            return BadRequest(new { error = "Template is required" });
        }

        var usesCustomHtml = !string.IsNullOrWhiteSpace(request.CustomHtml);
        var normalizedTemplate = (request.Template ?? string.Empty).Trim();
        if (!usesCustomHtml && string.IsNullOrWhiteSpace(normalizedTemplate))
        {
            return BadRequest(new { error = "Template is required" });
        }

        var model = DocumentModelFactory.CreateModel(request.Form);
        StudentEntity? student = null;
        if (!string.IsNullOrWhiteSpace(request.StudentId))
        {
            student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == request.StudentId, ct);
            if (student == null)
            {
                return NotFound(new { error = "Student not found" });
            }
            DocumentModelFactory.ApplyStudentContext(model, student);
        }

        string html;
        if (usesCustomHtml)
        {
            html = DocumentModelFactory.ApplyPlaceholders(request.CustomHtml!, model);
            model.TemplateKey = string.IsNullOrWhiteSpace(normalizedTemplate) ? "custom" : normalizedTemplate;
        }
        else
        {
            html = _renderer.RenderStandardDocument(normalizedTemplate, model);
            if (string.IsNullOrEmpty(html))
            {
                return BadRequest(new { error = "Unsupported template" });
            }
        }

        return Ok(new DocumentRenderResponse
        {
            Html = html,
            Data = model
        });
    }

    [HttpPost("assign")]
    [Authorize(Policy = "RequireTeacher")]
    public async Task<ActionResult<DocumentAssignResponse>> AssignDocuments([FromBody] DocumentAssignRequest request, CancellationToken ct)
    {
        if (request == null)
        {
            return BadRequest(new { error = "Template is required" });
        }

        var usesCustomHtml = !string.IsNullOrWhiteSpace(request.CustomHtml);
        var normalizedTemplate = (request.Template ?? string.Empty).Trim();
        if (!usesCustomHtml && string.IsNullOrWhiteSpace(normalizedTemplate))
        {
            return BadRequest(new { error = "Template is required" });
        }
        if (usesCustomHtml && string.IsNullOrWhiteSpace(request.CustomTitle))
        {
            return BadRequest(new { error = "Custom title is required" });
        }

        IQueryable<StudentEntity> query = _db.Students.AsNoTracking();
        if (!request.IncludeArchived)
        {
            query = query.Where(s => !s.IsArchived);
        }

        List<StudentEntity> targets;
        if (request.ApplyToAllActive)
        {
            targets = await query.ToListAsync(ct);
        }
        else
        {
            var ids = (request.StudentIds ?? new List<string>())
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (ids.Count == 0)
            {
                return BadRequest(new { error = "Provide at least one student id" });
            }
            targets = await query.Where(s => ids.Contains(s.Id)).ToListAsync(ct);
        }

        if (targets.Count == 0)
        {
            return BadRequest(new { error = "No matching students" });
        }

        var teacherEmail = CurrentEmail;
        var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email == teacherEmail, ct);
        var created = new List<string>();
        string? sampleHtml = null;
        string? sampleStudentId = null;

        foreach (var student in targets)
        {
            var model = DocumentModelFactory.CreateModel(request.Form);
            DocumentModelFactory.ApplyStudentContext(model, student);

            string html;
            string templateKey;
            string title;

            if (usesCustomHtml)
            {
                templateKey = string.IsNullOrWhiteSpace(normalizedTemplate) ? "custom" : normalizedTemplate;
                model.TemplateKey = templateKey;
                title = string.IsNullOrWhiteSpace(request.CustomTitle)
                    ? DocumentModelFactory.GetTemplateTitle(templateKey)
                    : request.CustomTitle!.Trim();
                html = DocumentModelFactory.ApplyPlaceholders(request.CustomHtml!, model);
            }
            else
            {
                html = _renderer.RenderStandardDocument(normalizedTemplate, model);
                if (string.IsNullOrEmpty(html))
                {
                    continue;
                }
                templateKey = model.TemplateKey;
                title = DocumentModelFactory.GetTemplateTitle(model.TemplateKey);
            }

            if (sampleHtml == null)
            {
                sampleHtml = html;
                sampleStudentId = student.Id;
            }

            // System templates should show "System" as teacher name
            var isSystemTemplate = templateKey == "confirm" || templateKey == "confirm_upsvar";
            var teacherNameForDocument = isSystemTemplate ? "System" : (teacher?.FullName ?? teacherEmail);
            
            var record = new DocumentRecordEntity
            {
                Id = Guid.NewGuid().ToString("n"),
                TemplateKey = templateKey,
                OwnerEmail = student.Email,
                OwnerRole = "student",
                Title = title,
                HtmlContent = html,
                TeacherEmail = teacherEmail,
                TeacherName = teacherNameForDocument,
                StudentId = student.Id,
                StudentEmail = student.Email,
                StudentName = student.FullName,
                MetaJson = JsonSerializer.Serialize(model),
                CreatedAt = DateTime.UtcNow.ToString("o"),
                CreatedByEmail = teacherEmail
            };
            _db.Documents.Add(record);
            created.Add(student.Id);
        }

        await _db.SaveChangesAsync(ct);

        // Notify via SignalR - notify the teacher who created the documents
        await _dataUpdateService.NotifyDocumentUpdated(null, "created", teacherEmail);
        
        // Also notify each student who received a document
        foreach (var student in targets)
        {
            if (!string.IsNullOrWhiteSpace(student.Email))
            {
                await _dataUpdateService.NotifyDocumentUpdated(null, "assigned", student.Email);
            }
        }

        return Ok(new DocumentAssignResponse
        {
            TargetCount = targets.Count,
            Created = created.Count,
            StudentIds = created,
            SampleHtml = sampleHtml,
            SampleStudentId = sampleStudentId
        });
    }

    [HttpPost("assign-faculty")]
    [Authorize(Policy = "RequireTeacher")]
    public async Task<ActionResult<DocumentAssignFacultyResponse>> AssignDocumentsToFaculty([FromBody] DocumentAssignFacultyRequest request, CancellationToken ct)
    {
        if (request == null)
        {
            return BadRequest(new { error = "Template is required" });
        }

        var usesCustomHtml = !string.IsNullOrWhiteSpace(request.CustomHtml);
        var normalizedTemplate = (request.Template ?? string.Empty).Trim();
        if (!usesCustomHtml && string.IsNullOrWhiteSpace(normalizedTemplate))
        {
            return BadRequest(new { error = "Template is required" });
        }
        if (usesCustomHtml && string.IsNullOrWhiteSpace(request.CustomTitle))
        {
            return BadRequest(new { error = "Custom title is required" });
        }

        var ids = (request.FacultyIds ?? new List<string>())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        
        if (ids.Count == 0)
        {
            return BadRequest(new { error = "Provide at least one faculty id" });
        }

        var targets = await _db.Faculty.AsNoTracking()
            .Where(f => ids.Contains(f.Id))
            .ToListAsync(ct);

        if (targets.Count == 0)
        {
            return BadRequest(new { error = "No matching faculty members" });
        }

        var senderEmail = CurrentEmail;
        var sender = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email == senderEmail, ct);
        var created = new List<string>();
        string? sampleHtml = null;
        string? sampleFacultyId = null;

        foreach (var faculty in targets)
        {
            var model = DocumentModelFactory.CreateModel(request.Form);
            
            string html;
            string templateKey;
            string title;

            if (usesCustomHtml)
            {
                templateKey = string.IsNullOrWhiteSpace(normalizedTemplate) ? "custom" : normalizedTemplate;
                model.TemplateKey = templateKey;
                title = string.IsNullOrWhiteSpace(request.CustomTitle)
                    ? DocumentModelFactory.GetTemplateTitle(templateKey)
                    : request.CustomTitle!.Trim();
                html = DocumentModelFactory.ApplyPlaceholders(request.CustomHtml!, model);
            }
            else
            {
                html = _renderer.RenderStandardDocument(normalizedTemplate, model);
                if (string.IsNullOrEmpty(html))
                {
                    continue;
                }
                templateKey = model.TemplateKey;
                title = DocumentModelFactory.GetTemplateTitle(model.TemplateKey);
            }

            if (sampleHtml == null)
            {
                sampleHtml = html;
                sampleFacultyId = faculty.Id;
            }

            // System templates should show "System" as teacher name
            var isSystemTemplate = templateKey == "confirm" || templateKey == "confirm_upsvar";
            var teacherNameForDocument = isSystemTemplate ? "System" : (sender?.FullName ?? senderEmail);

            var record = new DocumentRecordEntity
            {
                Id = Guid.NewGuid().ToString("n"),
                TemplateKey = templateKey,
                OwnerEmail = faculty.Email,
                OwnerRole = "teacher",
                Title = title,
                HtmlContent = html,
                TeacherEmail = senderEmail,
                TeacherName = teacherNameForDocument,
                CreatedAt = DateTime.UtcNow.ToString("o"),
                CreatedByEmail = senderEmail,
                MetaJson = JsonSerializer.Serialize(model)
            };
            _db.Documents.Add(record);
            created.Add(faculty.Id);
        }

        await _db.SaveChangesAsync(ct);

        // Notify via SignalR - notify the sender
        await _dataUpdateService.NotifyDocumentUpdated(null, "created", senderEmail);
        
        // Also notify each faculty member who received a document
        foreach (var faculty in targets)
        {
            if (!string.IsNullOrWhiteSpace(faculty.Email))
            {
                await _dataUpdateService.NotifyDocumentUpdated(null, "assigned", faculty.Email);
            }
        }

        return Ok(new DocumentAssignFacultyResponse
        {
            TargetCount = targets.Count,
            Created = created.Count,
            FacultyIds = created,
            SampleHtml = sampleHtml,
            SampleFacultyId = sampleFacultyId
        });
    }

    [HttpPost("teacher/profile")]
    [Authorize(Policy = "RequireTeacher")]
    public async Task<ActionResult<DocumentRenderResponse>> GenerateTeacherProfile(CancellationToken ct)
    {
        var email = CurrentEmail;
        var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email == email, ct);
        if (teacher == null)
        {
            return NotFound(new { error = "Teacher profile not found" });
        }

        var classes = await _db.ClassGroups.AsNoTracking()
            .Where(c => c.TeacherEmail != null && c.TeacherEmail == teacher.Email)
            .OrderBy(c => c.Name)
            .Take(30)
            .ToListAsync(ct);

        var referenceStudentsQuery = _db.Students.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(teacher.Program))
        {
            referenceStudentsQuery = referenceStudentsQuery.Where(s => s.Program == teacher.Program);
        }
        else if (!string.IsNullOrWhiteSpace(teacher.Faculty))
        {
            referenceStudentsQuery = referenceStudentsQuery.Where(s => s.Faculty == teacher.Faculty);
        }

        var referenceStudents = await referenceStudentsQuery
            .OrderBy(s => s.FullName)
            .Take(20)
            .ToListAsync(ct);

        var model = new TeacherProfileDocumentModel
        {
            TeacherId = teacher.Id,
            FullName = teacher.FullName,
            Email = teacher.Email,
            Faculty = teacher.Faculty,
            Departments = ParseStringArray(teacher.DepartmentsJson),
            Subjects = ParseStringArray(teacher.SubjectsJson),
            Office = teacher.Office,
            Phone = teacher.Phone,
            EmploymentType = teacher.EmploymentType,
            Status = teacher.Status,
            ClassesCount = teacher.ClassesCount ?? classes.Count,
            YearsExperience = teacher.YearsExperience,
            HireDate = teacher.HireDate,
            About = teacher.About,
            Classes = classes.Select(c => new TeacherProfileClassSummary
            {
                Name = c.Name,
                Program = c.Program,
                Type = "Class",
                StudentCount = c.StudentCount,
                Year = TryParseYear(c.Name)
            }).ToList(),
            Students = referenceStudents.Select(s => new TeacherProfileStudentSummary
            {
                FullName = s.FullName,
                Program = s.Program,
                Year = s.StudyYear,
                Email = s.Email
            }).ToList(),
            GeneratedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm")
        };

        var html = _renderer.RenderTeacherProfileDocument(model);
        var record = new DocumentRecordEntity
        {
            Id = Guid.NewGuid().ToString("n"),
            TemplateKey = DocumentTemplateKeys.TeacherProfile,
            OwnerEmail = teacher.Email,
            OwnerRole = "teacher",
            Title = "Teacher profile report",
            HtmlContent = html,
            TeacherEmail = teacher.Email,
            TeacherName = teacher.FullName,
            CreatedAt = DateTime.UtcNow.ToString("o"),
            CreatedByEmail = teacher.Email,
            MetaJson = JsonSerializer.Serialize(model)
        };
        _db.Documents.Add(record);
        await _db.SaveChangesAsync(ct);

        // Notify via SignalR
        await _dataUpdateService.NotifyDocumentUpdated(record.Id, "created", email);

        return Ok(new DocumentRenderResponse
        {
            Html = html,
            DocumentId = record.Id
        });
    }

    [HttpGet("my")]
    public async Task<ActionResult<IEnumerable<DocumentRecordDto>>> GetMyDocuments([FromQuery] bool includeHtml = false, CancellationToken ct = default)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Unauthorized();

        var role = CurrentRole;
        
        List<DocumentRecordEntity> docs;
        
        if (role == "student")
        {
            // Для студентів: документи надіслані їм (StudentEmail) або створені ними (OwnerEmail)
            docs = await _db.Documents.AsNoTracking()
                .Where(d => d.StudentEmail == email || d.OwnerEmail == email)
                .OrderByDescending(d => d.CreatedAt)
                .Take(100)
                .ToListAsync(ct);
        }
        else
        {
            // Для викладачів: тільки їхні документи
            docs = await _db.Documents.AsNoTracking()
                .Where(d => d.OwnerEmail == email)
                .OrderByDescending(d => d.CreatedAt)
                .Take(100)
                .ToListAsync(ct);
        }

        var result = docs.Select(d => ToDto(d, includeHtml)).ToList();
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<DocumentRecordDto>> GetDocument(string id, [FromQuery] bool includeHtml = true, CancellationToken ct = default)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Unauthorized();

        var record = await _db.Documents.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id, ct);
        if (record == null) return NotFound();

        var ownsRecord = string.Equals(record.OwnerEmail, email, StringComparison.OrdinalIgnoreCase);
        var issuedRecord = string.Equals(record.TeacherEmail, email, StringComparison.OrdinalIgnoreCase);
        var isStudentRecipient = string.Equals(record.StudentEmail, email, StringComparison.OrdinalIgnoreCase);
        
        if (!ownsRecord && !issuedRecord && !isStudentRecipient)
        {
            return Forbid();
        }

        return Ok(ToDto(record, includeHtml));
    }

    private static DocumentRecordDto ToDto(DocumentRecordEntity entity, bool includeHtml)
    {
        return new DocumentRecordDto
        {
            Id = entity.Id,
            TemplateKey = entity.TemplateKey,
            Title = entity.Title,
            OwnerRole = entity.OwnerRole,
            OwnerEmail = entity.OwnerEmail,
            CreatedAt = entity.CreatedAt,
            TeacherEmail = entity.TeacherEmail,
            TeacherName = entity.TeacherName,
            StudentId = entity.StudentId,
            StudentEmail = entity.StudentEmail,
            StudentName = entity.StudentName,
            Html = includeHtml ? entity.HtmlContent : null
        };
    }

    private static string[] ParseStringArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Array.Empty<string>();
        try
        {
            var parsed = JsonSerializer.Deserialize<string[]>(json);
            return parsed?.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToArray() ?? Array.Empty<string>();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    private static int? TryParseYear(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var digits = new string(value.Where(char.IsDigit).ToArray());
        if (int.TryParse(digits, out var year)) return year;
        return null;
    }
}
