using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/status")]
public class StatusController : ControllerBase
{
    /// <summary>
    /// Health check endpoint
    /// </summary>
    /// <returns>Server status and current UTC time</returns>
    /// <remarks>
    /// Public endpoint (no authentication required) for health checks and monitoring.
    /// Returns server status and current UTC timestamp.
    /// </remarks>
    [HttpGet("ping")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult Ping()
    {
        return Ok(new
        {
            status = "ok",
            serverTime = DateTime.UtcNow
        });
    }
}
