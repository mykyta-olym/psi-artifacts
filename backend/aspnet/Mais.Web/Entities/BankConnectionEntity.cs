namespace Mais.Web.Entities;

public class BankConnectionEntity
{
    public string Id { get; set; } = string.Empty;
    public string StudentId { get; set; } = string.Empty; // FK to Students.Id
    public string BankName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string Iban { get; set; } = string.Empty;
    public string? Swift { get; set; }
    public bool IsPrimary { get; set; } = false;
    public string? CreatedAt { get; set; }
    public string? UpdatedAt { get; set; }
}
