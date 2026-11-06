using System.Reflection;
using System.Linq;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.DataProtection;
using Mais.Web.Extensions;
using Mais.Web.Swagger;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Services;
using Mais.Web.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "MAIS Management API",
        Version = "v1",
        Description = "Secure API surface for MAIS management system (courses, schedules, exams, gradebook).",
        Contact = new OpenApiContact
        {
            Name = "MAIS Platform Team",
            Email = "support@mais.local"
        },
        License = new OpenApiLicense
        {
            Name = "MIT License",
            Url = new Uri("https://opensource.org/licenses/MIT")
        }
    });

    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath, includeControllerXmlComments: true);
    }

    options.SupportNonNullableReferenceTypes();
    options.CustomSchemaIds(type => type.FullName);

    var securityScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT Authorization header. Example: \"Bearer {access_token}\"."
    };
    options.AddSecurityDefinition("Bearer", securityScheme);
    options.OperationFilter<AuthorizeCheckOperationFilter>();
});

var jwtSection = builder.Configuration.GetSection("Jwt");
var issuer = jwtSection.GetValue<string>("Issuer") ?? "mais.local";
var audience = jwtSection.GetValue<string>("Audience") ?? "mais.local";
var key = jwtSection.GetValue<string>("Key");
if (string.IsNullOrWhiteSpace(key))
{
    key = "dev-super-secret-key-change-me-please-32bytes";
}
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));

var tokenValidationParameters = new TokenValidationParameters
{
    ValidateIssuer = true,
    ValidateAudience = true,
    ValidateIssuerSigningKey = true,
    ValidateLifetime = true,
    ValidIssuer = issuer,
    ValidAudience = audience,
    IssuerSigningKey = signingKey,
    ClockSkew = TimeSpan.FromSeconds(30),
    NameClaimType = ClaimTypes.Email,
    RoleClaimType = ClaimTypes.Role
};

builder.Services.AddSingleton(tokenValidationParameters);
// Configure DataProtection to use persistent storage in /app/data-protection-keys
// This ensures keys persist across container restarts
var dataProtectionKeysPath = Path.Combine(builder.Environment.ContentRootPath, "data-protection-keys");
Directory.CreateDirectory(dataProtectionKeysPath);
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath));

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = tokenValidationParameters;
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            // SignalR sends token via query string for WebSocket connections
            // Check if path starts with /hubs (handles both /hubs/data and /hubs/chat etc.)
            if (!string.IsNullOrEmpty(accessToken) &&
                path.StartsWithSegments("/hubs", StringComparison.OrdinalIgnoreCase))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            var tokenType = context.Principal?.FindFirst("token_type")?.Value;
            if (!string.Equals(tokenType, "access", StringComparison.OrdinalIgnoreCase))
            {
                context.Fail("Invalid token type");
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireTeacher", policy => policy.RequireRole("teacher"));
    options.AddPolicy("RequireStudent", policy => policy.RequireRole("student"));
});

builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = ctx =>
    {
        ctx.ProblemDetails.Extensions["traceId"] = ctx.HttpContext.TraceIdentifier;
        if (ctx.Exception != null)
        {
            ctx.ProblemDetails.Extensions["exception"] = ctx.Exception.GetType().Name;
        }
    };
});

builder.Services.AddHttpLogging(logging =>
{
    logging.LoggingFields = HttpLoggingFields.RequestMethod |
                             HttpLoggingFields.RequestPath |
                             HttpLoggingFields.ResponseStatusCode |
                             HttpLoggingFields.RequestBody;
    logging.RequestHeaders.Add("Authorization");
});

builder.Services.AddCors(options =>
{
    var configuredOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>();
    var defaultOrigins = new[]
    {
        "http://localhost:4028",
        "http://127.0.0.1:4028",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    };
    var origins = (configuredOrigins != null && configuredOrigins.Length > 0 ? configuredOrigins : defaultOrigins)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .SetIsOriginAllowed(origin => true)); // Allow all origins for development
});

builder.Services.AddControllers(options =>
{
    var policy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
    options.Filters.Add(new AuthorizeFilter(policy));
})
.AddJsonOptions(options =>
{
    // Use camelCase for JSON property names to match JavaScript conventions
    options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.JsonSerializerOptions.WriteIndented = false;
})
.ConfigureApiBehaviorOptions(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var problemDetails = new ValidationProblemDetails(context.ModelState)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Validation failed"
        };
        problemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
        return new BadRequestObjectResult(problemDetails);
    };
});

var conn = Environment.GetEnvironmentVariable("MAIS__DB__CONNECTION")
           ?? builder.Configuration.GetConnectionString("Default")
           ?? "Host=localhost;Port=5432;Database=mais;Username=postgres;Password=postgres";

// Enable legacy timestamp behavior for Npgsql to work with timestamp without time zone
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(conn));
builder.Services.AddScoped<DbSeeder>();
builder.Services.AddSingleton<ISimplePasswordHasher, SimplePasswordHasher>();
builder.Services.AddScoped<IDataUpdateService, DataUpdateService>();
builder.Services.AddSingleton<IEmailService, EmailService>();
builder.Services.AddScoped<IActivityService, ActivityService>();
builder.Services.AddSingleton<IDocumentRenderService, DocumentRenderService>();
builder.Services.AddScoped<IDocumentAutomationService, DocumentAutomationService>();
builder.Services.AddHostedService<DocumentAutomationBackgroundService>();
builder.Services.AddHealthChecks();
builder.Services.Configure<GeminiOptions>(builder.Configuration.GetSection("Gemini"));
builder.Services.AddHttpClient<IGeminiService, GeminiService>();
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
}).AddJsonProtocol(options =>
{
    options.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpLogging();
app.UseSecurityHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
// HTTPS redirection disabled for local development
// app.UseHttpsRedirection();
app.UseStaticFiles();

// Ignore favicon requests to reduce noise in logs
app.MapGet("/favicon.ico", () => Results.NoContent()).ExcludeFromDescription();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "MAIS Management API v1");
    options.DocumentTitle = "MAIS API Documentation";
    options.InjectStylesheet("/swagger-ui/swagger-dark.css");
});

app.UseRouting();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/healthz");
app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat").RequireCors("Frontend");
app.MapHub<DataHub>("/hubs/data").RequireCors("Frontend");
app.MapHub<GradesHub>("/hubs/grades").RequireCors("Frontend");
app.MapHub<ActivitiesHub>("/hubs/activities").RequireCors("Frontend");
app.MapHub<ScheduleHub>("/hubs/schedule").RequireCors("Frontend");
app.MapHub<ResourcesHub>("/hubs/resources").RequireCors("Frontend");
app.MapHub<StudentsHub>("/hubs/students").RequireCors("Frontend");
app.MapHub<ExamsHub>("/hubs/exams").RequireCors("Frontend");
app.MapHub<SurveysHub>("/hubs/surveys").RequireCors("Frontend");
app.MapHub<EnrollmentHub>("/hubs/enrollment").RequireCors("Frontend");
app.MapHub<ThesisHub>("/hubs/thesis").RequireCors("Frontend");
app.MapHub<AttendanceHub>("/hubs/attendance").RequireCors("Frontend");
app.MapHub<FacultyHub>("/hubs/faculty").RequireCors("Frontend");

// Seed database (best-effort)
using (var scope = app.Services.CreateScope())
{
    try
    {
        var seeder = scope.ServiceProvider.GetRequiredService<DbSeeder>();
        await seeder.EnsureCreatedAndSeededAsync();
        // Best-effort schema upgrade for Students table to add optional profile columns
        try
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var sql = @"
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""Phone"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""Phone2"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""AltEmail"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""Address"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""ClassName"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""IsicCardNumber"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""StudentNumber"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""StudyNumber"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""PassportId"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""BirthDate"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""BirthPlace"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""Nationality"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""FamilyStatus"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""HealthStatus"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""ParentName"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""ConsentPersonalData"" boolean;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""ConsentCompanyOffers"" boolean;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""PersonId"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""IsArchived"" boolean DEFAULT false;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""IsActivated"" boolean DEFAULT false;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""ActivationToken"" text;
                ALTER TABLE IF EXISTS ""Students"" ADD COLUMN IF NOT EXISTS ""ActivationTokenExpiry"" timestamp;
                ALTER TABLE IF EXISTS ""Faculty"" ADD COLUMN IF NOT EXISTS ""IsActivated"" boolean DEFAULT false;
                ALTER TABLE IF EXISTS ""Faculty"" ADD COLUMN IF NOT EXISTS ""ActivationToken"" text;
                ALTER TABLE IF EXISTS ""Faculty"" ADD COLUMN IF NOT EXISTS ""ActivationTokenExpiry"" timestamp;
                ALTER TABLE IF EXISTS ""UserCredentials"" ADD COLUMN IF NOT EXISTS ""TemporaryPassword"" text;";
            await db.Database.ExecuteSqlRawAsync(sql);
        }
        catch (Exception ex)
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
            logger.LogWarning(ex, "[db] Optional Students schema upgrade skipped");
        }

        // Run automated document distribution on startup
        try
        {
            var automationService = scope.ServiceProvider.GetRequiredService<IDocumentAutomationService>();
            await automationService.RunAutomatedDistributionAsync();
        }
        catch (Exception ex)
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
            logger.LogWarning(ex, "[automation] Document automation skipped");
        }
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
        logger.LogError(ex, "Database seed failed. API will continue with file-backed endpoints.");
    }
}

app.Run();
