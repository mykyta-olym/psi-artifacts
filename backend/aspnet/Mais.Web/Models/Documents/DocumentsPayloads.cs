using System.Collections.Generic;

namespace Mais.Web.Models.Documents;

public class DocumentRenderRequest
{
    public string Template { get; set; } = string.Empty;
    public DocumentFormDto? Form { get; set; }
    public string? StudentId { get; set; }
    public string? CustomHtml { get; set; }
    public string? CustomTitle { get; set; }
}

public class DocumentRenderResponse
{
    public string Html { get; set; } = string.Empty;
    public string? DocumentId { get; set; }
    public DocumentRenderModel? Data { get; set; }
}

public class DocumentAssignRequest
{
    public string Template { get; set; } = string.Empty;
    public DocumentFormDto? Form { get; set; }
    public List<string> StudentIds { get; set; } = new();
    public bool ApplyToAllActive { get; set; }
    public bool IncludeArchived { get; set; }
    public string? CustomHtml { get; set; }
    public string? CustomTitle { get; set; }
}

public class DocumentAssignResponse
{
    public int TargetCount { get; set; }
    public int Created { get; set; }
    public List<string> StudentIds { get; set; } = new();
    public string? SampleStudentId { get; set; }
    public string? SampleHtml { get; set; }
}

public class DocumentAssignFacultyRequest
{
    public string Template { get; set; } = string.Empty;
    public DocumentFormDto? Form { get; set; }
    public List<string> FacultyIds { get; set; } = new();
    public string? CustomHtml { get; set; }
    public string? CustomTitle { get; set; }
}

public class DocumentAssignFacultyResponse
{
    public int TargetCount { get; set; }
    public int Created { get; set; }
    public List<string> FacultyIds { get; set; } = new();
    public string? SampleFacultyId { get; set; }
    public string? SampleHtml { get; set; }
}

public class DocumentRecordDto
{
    public string Id { get; set; } = string.Empty;
    public string TemplateKey { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string OwnerRole { get; set; } = string.Empty;
    public string OwnerEmail { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string? TeacherEmail { get; set; }
    public string? TeacherName { get; set; }
    public string? StudentId { get; set; }
    public string? StudentEmail { get; set; }
    public string? StudentName { get; set; }
    public string? Html { get; set; }
}
