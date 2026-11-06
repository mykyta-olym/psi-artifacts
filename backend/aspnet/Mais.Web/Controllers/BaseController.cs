using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public abstract class BaseController : ControllerBase
{
    protected readonly IWebHostEnvironment Env;
    protected readonly IConfiguration Config;

    protected BaseController(IWebHostEnvironment env, IConfiguration config)
    {
        Env = env; Config = config;
    }

    protected string SeedPath()
    {
        // Resolve relative to ContentRoot (project folder), not bin directory
        var configured = Config.GetSection("Seed").GetValue<string>("Path");
        var baseDir = Path.Combine(Env.ContentRootPath, configured ?? string.Empty);
        return Path.GetFullPath(baseDir);
    }

    protected async Task<T?> ReadJsonAsync<T>(string fileName)
    {
        var full = Path.Combine(SeedPath(), fileName);
        if (!System.IO.File.Exists(full)) return default;
        await using var fs = System.IO.File.OpenRead(full);
        return await JsonSerializer.DeserializeAsync<T>(fs, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            ReadCommentHandling = JsonCommentHandling.Skip
        });
    }
}
