using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Mais.Web.Data;
using Mais.Web.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Mais.Web.Services;

/// <summary>
/// Automated document distribution service that ensures all active students
/// receive required system templates (confirm, confirm_upsvar).
/// </summary>
public class DocumentAutomationService : IDocumentAutomationService
{
    private readonly AppDbContext _db;
    private readonly IDocumentRenderService _renderService;
    private readonly ILogger<DocumentAutomationService> _logger;

    private static readonly string[] AutomatedTemplates = { "confirm", "confirm_upsvar" };

    public DocumentAutomationService(
        AppDbContext db,
        IDocumentRenderService renderService,
        ILogger<DocumentAutomationService> logger)
    {
        _db = db;
        _renderService = renderService;
        _logger = logger;
    }

    public async Task RunAutomatedDistributionAsync()
    {
        _logger.LogInformation("[DocumentAutomation] Starting automated distribution scan...");

        var activeStudents = await _db.Students
            .Where(s => s.IsActivated && !s.IsArchived)
            .ToListAsync();

        if (!activeStudents.Any())
        {
            _logger.LogInformation("[DocumentAutomation] No active students found.");
            return;
        }

        _logger.LogInformation("[DocumentAutomation] Found {Count} active students", activeStudents.Count);

        var existingDocs = await _db.Documents
            .Where(d => AutomatedTemplates.Contains(d.TemplateKey))
            .Select(d => new { d.StudentId, d.TemplateKey })
            .ToListAsync();

        var existingSet = new HashSet<string>(
            existingDocs.Select(x => $"{x.StudentId}|{x.TemplateKey}")
        );

        var newDocuments = new List<DocumentRecordEntity>();

        foreach (var student in activeStudents)
        {
            foreach (var template in AutomatedTemplates)
            {
                var key = $"{student.Id}|{template}";
                if (existingSet.Contains(key))
                {
                    continue; // Student already has this document
                }

                var renderModel = BuildRenderModelForStudent(student);
                string html;
                try
                {
                    html = _renderService.RenderStandardDocument(template, renderModel);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[DocumentAutomation] Failed to render {Template} for student {StudentId}", template, student.Id);
                    continue;
                }

                var doc = new DocumentRecordEntity
                {
                    Id = Guid.NewGuid().ToString(),
                    StudentId = student.Id,
                    StudentName = student.FullName,
                    StudentEmail = student.Email,
                    TemplateKey = template,
                    Title = GetTemplateTitle(template),
                    OwnerEmail = "system@mais.local",
                    OwnerRole = "system",
                    HtmlContent = html,
                    CreatedAt = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                    CreatedByEmail = "system@mais.local"
                };

                newDocuments.Add(doc);
            }
        }

        if (newDocuments.Any())
        {
            await _db.Documents.AddRangeAsync(newDocuments);
            await _db.SaveChangesAsync();
            _logger.LogInformation("[DocumentAutomation] Created {Count} new automated documents", newDocuments.Count);
        }
        else
        {
            _logger.LogInformation("[DocumentAutomation] All students already have required documents.");
        }
    }

    private static Models.Documents.DocumentRenderModel BuildRenderModelForStudent(StudentEntity student)
    {
        return new Models.Documents.DocumentRenderModel
        {
            FullName = student.FullName ?? "",
            StudentId = student.Id ?? "",
            Program = student.Program ?? "",
            Faculty = student.Faculty ?? "Faculty of Electrical Engineering and Informatics",
            Year = student.StudyYear > 0 ? student.StudyYear.ToString() : "1",
            StudyForm = "Full-time",
            StudyLevel = student.Degree ?? "Bachelor",
            DateOfBirth = student.BirthDate ?? "",
            PlaceOfBirth = student.BirthPlace ?? "",
            NationalId = student.PersonId ?? "",
            Address = student.Address ?? "",
            Email = student.Email ?? "",
            Phone = student.Phone ?? "",
            IssuedAt = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            ValidUntil = "",
            AccommodationAddress = "",
            AccommodationFrom = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            AccommodationTo = "",
            UpsvarPurpose = "For state social support purposes",
            IncludeQr = true,
            IncludeWatermark = true
        };
    }

    private static string GetTemplateTitle(string template)
    {
        return template switch
        {
            "confirm" => "Confirmation of study",
            "confirm_upsvar" => "Labour office confirmation (ÚPSVaR)",
            _ => "Automated document"
        };
    }
}
