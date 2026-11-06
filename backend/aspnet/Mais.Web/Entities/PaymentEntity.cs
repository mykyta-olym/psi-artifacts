namespace Mais.Web.Entities;

/// <summary>
/// Student payment record - tracks tuition, fees, and other financial transactions
/// </summary>
public class PaymentEntity
{
    public int Id { get; set; }
    
    /// <summary>
    /// FK to Students.Id
    /// </summary>
    public string StudentId { get; set; } = string.Empty;
    
    /// <summary>
    /// Payment type: tuition, dormitory, library, exam_retake, other
    /// </summary>
    public string Type { get; set; } = "tuition";
    
    /// <summary>
    /// Description of the payment
    /// </summary>
    public string Description { get; set; } = string.Empty;
    
    /// <summary>
    /// Amount in EUR
    /// </summary>
    public decimal Amount { get; set; }
    
    /// <summary>
    /// Currency code (default EUR)
    /// </summary>
    public string Currency { get; set; } = "EUR";
    
    /// <summary>
    /// Status: pending, posted, failed, refunded
    /// </summary>
    public string Status { get; set; } = "pending";
    
    /// <summary>
    /// Variable symbol used for the payment
    /// </summary>
    public string? VariableSymbol { get; set; }
    
    /// <summary>
    /// Specific symbol used for the payment
    /// </summary>
    public string? SpecificSymbol { get; set; }
    
    /// <summary>
    /// Academic year (e.g., "2025/2026")
    /// </summary>
    public string? AcademicYear { get; set; }
    
    /// <summary>
    /// Semester: WS or SS
    /// </summary>
    public string? Semester { get; set; }
    
    /// <summary>
    /// Due date for the payment
    /// </summary>
    public DateOnly? DueDate { get; set; }
    
    /// <summary>
    /// Date when payment was posted/received
    /// </summary>
    public DateOnly? PostedDate { get; set; }
    
    /// <summary>
    /// External reference (bank transaction ID, etc.)
    /// </summary>
    public string? ExternalRef { get; set; }
    
    /// <summary>
    /// Notes or additional info
    /// </summary>
    public string? Notes { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
