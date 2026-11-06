using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/payments")]
[Authorize]
public class PaymentsController : ControllerBase
{
    private readonly AppDbContext _db;

    public PaymentsController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Get all payments for a student
    /// </summary>
    [HttpGet("student/{studentId}")]
    public async Task<IActionResult> GetStudentPayments(
        string studentId,
        [FromQuery] string? status = null,
        [FromQuery] string? academicYear = null,
        CancellationToken ct = default)
    {
        var query = _db.Payments
            .AsNoTracking()
            .Where(p => p.StudentId == studentId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(p => p.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(academicYear))
        {
            query = query.Where(p => p.AcademicYear == academicYear);
        }

        var payments = await query
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

        return Ok(payments);
    }

    /// <summary>
    /// Get payment summary for a student
    /// </summary>
    [HttpGet("student/{studentId}/summary")]
    public async Task<IActionResult> GetStudentPaymentSummary(string studentId, CancellationToken ct = default)
    {
        var payments = await _db.Payments
            .AsNoTracking()
            .Where(p => p.StudentId == studentId)
            .ToListAsync(ct);

        var totalPaid = payments.Where(p => p.Status == "posted").Sum(p => p.Amount);
        var totalPending = payments.Where(p => p.Status == "pending").Sum(p => p.Amount);
        var totalDue = payments.Where(p => p.Status == "pending" && p.DueDate.HasValue && p.DueDate.Value <= DateOnly.FromDateTime(DateTime.UtcNow)).Sum(p => p.Amount);

        var byType = payments
            .GroupBy(p => p.Type)
            .Select(g => new
            {
                Type = g.Key,
                Total = g.Sum(p => p.Amount),
                Paid = g.Where(p => p.Status == "posted").Sum(p => p.Amount),
                Pending = g.Where(p => p.Status == "pending").Sum(p => p.Amount)
            })
            .ToList();

        var byYear = payments
            .GroupBy(p => p.AcademicYear ?? "Unknown")
            .Select(g => new
            {
                AcademicYear = g.Key,
                Total = g.Sum(p => p.Amount),
                Paid = g.Where(p => p.Status == "posted").Sum(p => p.Amount),
                Pending = g.Where(p => p.Status == "pending").Sum(p => p.Amount)
            })
            .OrderByDescending(y => y.AcademicYear)
            .ToList();

        return Ok(new
        {
            studentId,
            totalPayments = payments.Count,
            totalPaid,
            totalPending,
            totalDue,
            currency = "EUR",
            byType,
            byYear
        });
    }

    /// <summary>
    /// Get a specific payment by ID
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetPayment(int id, CancellationToken ct = default)
    {
        var payment = await _db.Payments.FindAsync([id], ct);
        if (payment == null) return NotFound(new { error = "Payment not found" });
        return Ok(payment);
    }

    /// <summary>
    /// Create a new payment (admin only)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreatePayment([FromBody] CreatePaymentRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.StudentId))
        {
            return BadRequest(new { error = "StudentId is required" });
        }

        var student = await _db.Students.FindAsync([req.StudentId], ct);
        if (student == null)
        {
            return NotFound(new { error = "Student not found" });
        }

        var payment = new PaymentEntity
        {
            StudentId = req.StudentId,
            Type = req.Type ?? "tuition",
            Description = req.Description ?? "",
            Amount = req.Amount,
            Currency = req.Currency ?? "EUR",
            Status = req.Status ?? "pending",
            VariableSymbol = req.VariableSymbol,
            SpecificSymbol = req.SpecificSymbol,
            AcademicYear = req.AcademicYear,
            Semester = req.Semester,
            DueDate = !string.IsNullOrEmpty(req.DueDate) ? DateOnly.Parse(req.DueDate) : null,
            PostedDate = !string.IsNullOrEmpty(req.PostedDate) ? DateOnly.Parse(req.PostedDate) : null,
            ExternalRef = req.ExternalRef,
            Notes = req.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Payments.Add(payment);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetPayment), new { id = payment.Id }, payment);
    }

    /// <summary>
    /// Update payment status
    /// </summary>
    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> UpdatePaymentStatus(int id, [FromBody] UpdatePaymentStatusRequest req, CancellationToken ct = default)
    {
        var payment = await _db.Payments.FindAsync([id], ct);
        if (payment == null) return NotFound(new { error = "Payment not found" });

        var validStatuses = new[] { "pending", "posted", "failed", "refunded" };
        if (!validStatuses.Contains(req.Status?.ToLower()))
        {
            return BadRequest(new { error = "Invalid status. Use: pending, posted, failed, refunded" });
        }

        payment.Status = req.Status!.ToLower();
        if (payment.Status == "posted" && !payment.PostedDate.HasValue)
        {
            payment.PostedDate = DateOnly.FromDateTime(DateTime.UtcNow);
        }
        payment.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(payment);
    }

    /// <summary>
    /// Delete a payment
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeletePayment(int id, CancellationToken ct = default)
    {
        var payment = await _db.Payments.FindAsync([id], ct);
        if (payment == null) return NotFound(new { error = "Payment not found" });

        _db.Payments.Remove(payment);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    /// <summary>
    /// Get finance data for a student (combined symbols and payments)
    /// </summary>
    [HttpGet("student/{studentId}/finance")]
    public async Task<IActionResult> GetStudentFinance(string studentId, CancellationToken ct = default)
    {
        var payments = await _db.Payments
            .AsNoTracking()
            .Where(p => p.StudentId == studentId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

        var variableSymbols = await _db.VariableSymbols
            .AsNoTracking()
            .Where(v => v.StudentId == studentId)
            .OrderByDescending(v => v.IsActive)
            .ToListAsync(ct);

        var bankConnections = await _db.BankConnections
            .AsNoTracking()
            .Where(b => b.StudentId == studentId)
            .OrderByDescending(b => b.IsPrimary)
            .ToListAsync(ct);

        // Get primary variable symbol or generate one
        var primaryVs = variableSymbols.FirstOrDefault(v => v.IsActive);
        var variableSymbol = primaryVs?.Symbol ?? "";

        // Generate specific symbol from student ID if not available
        var specificSymbol = payments.FirstOrDefault()?.SpecificSymbol ?? "";
        if (string.IsNullOrEmpty(specificSymbol) && !string.IsNullOrEmpty(studentId))
        {
            var hash = Math.Abs(studentId.GetHashCode()) % 1000000;
            specificSymbol = hash.ToString("D6");
        }

        return Ok(new
        {
            studentId,
            variableSymbol,
            specificSymbol,
            payments = payments.Select(p => new
            {
                p.Id,
                p.Type,
                p.Description,
                p.Amount,
                p.Currency,
                p.Status,
                p.AcademicYear,
                p.Semester,
                dueDate = p.DueDate?.ToString("yyyy-MM-dd"),
                postedDate = p.PostedDate?.ToString("yyyy-MM-dd"),
                p.CreatedAt
            }),
            variableSymbols,
            bankConnections
        });
    }
}

public class CreatePaymentRequest
{
    public string? StudentId { get; set; }
    public string? Type { get; set; }
    public string? Description { get; set; }
    public decimal Amount { get; set; }
    public string? Currency { get; set; }
    public string? Status { get; set; }
    public string? VariableSymbol { get; set; }
    public string? SpecificSymbol { get; set; }
    public string? AcademicYear { get; set; }
    public string? Semester { get; set; }
    public string? DueDate { get; set; }
    public string? PostedDate { get; set; }
    public string? ExternalRef { get; set; }
    public string? Notes { get; set; }
}

public class UpdatePaymentStatusRequest
{
    public string? Status { get; set; }
}
