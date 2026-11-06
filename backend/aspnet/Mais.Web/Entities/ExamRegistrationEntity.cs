namespace Mais.Web.Entities;

public class ExamRegistrationEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string TermId { get; set; } = string.Empty; // FK to ExamTerms.Id
    public string? StudentId { get; set; } // FK to Students.Id (optional convenience)
    public string StudentEmail { get; set; } = string.Empty;
    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow; // UTC
}
