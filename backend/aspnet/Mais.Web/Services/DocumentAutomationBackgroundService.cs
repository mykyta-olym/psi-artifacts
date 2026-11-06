using System.Threading;
using System.Threading.Tasks;
using Mais.Web.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Mais.Web.Services;

/// <summary>
/// Background service that periodically runs automated document distribution.
/// Executes every 6 hours to ensure new students receive required confirmations.
/// </summary>
public class DocumentAutomationBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DocumentAutomationBackgroundService> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromHours(6);

    public DocumentAutomationBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<DocumentAutomationBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[DocumentAutomationBG] Background service started. Running every {Hours} hours.", Interval.TotalHours);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(Interval, stoppingToken);

                using var scope = _scopeFactory.CreateScope();
                var automationService = scope.ServiceProvider.GetRequiredService<IDocumentAutomationService>();
                await automationService.RunAutomatedDistributionAsync();
            }
            catch (TaskCanceledException)
            {
                // Normal shutdown
                break;
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "[DocumentAutomationBG] Error during automated distribution cycle");
            }
        }

        _logger.LogInformation("[DocumentAutomationBG] Background service stopped.");
    }
}
