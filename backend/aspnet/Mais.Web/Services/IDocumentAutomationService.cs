using System.Threading.Tasks;

namespace Mais.Web.Services;

/// <summary>
/// Provides automated document distribution for students missing required confirmations.
/// </summary>
public interface IDocumentAutomationService
{
    /// <summary>
    /// Scans all active students and auto-generates missing system documents (confirm, confirm_upsvar).
    /// Intended for scheduled background execution.
    /// </summary>
    Task RunAutomatedDistributionAsync();
}
