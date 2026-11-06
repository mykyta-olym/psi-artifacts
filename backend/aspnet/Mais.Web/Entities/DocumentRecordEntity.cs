namespace Mais.Web.Entities;

public class DocumentRecordEntity
{
    public string Id { get; set; } = string.Empty;
    public string TemplateKey { get; set; } = string.Empty;
    public string OwnerEmail { get; set; } = string.Empty;
    public string OwnerRole { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string HtmlContent { get; set; } = string.Empty;
    public string? TeacherEmail { get; set; }
    public string? TeacherName { get; set; }
    public string? StudentId { get; set; }
    public string? StudentEmail { get; set; }
    public string? StudentName { get; set; }
    public string? MetaJson { get; set; }
    public string? TargetGroupId { get; set; } // for group-wide documents
    public string CreatedAt { get; set; } = string.Empty;
    public string? CreatedByEmail { get; set; }
}
