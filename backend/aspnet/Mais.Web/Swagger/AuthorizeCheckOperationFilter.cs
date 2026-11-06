using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Mais.Web.Swagger;

/// <summary>
/// Adds standard 401/403 responses and the bearer security requirement for actions decorated with <see cref="AuthorizeAttribute"/>.
/// Since we have a global authorization filter, we add security requirement to all operations except those with <see cref="AllowAnonymousAttribute"/>.
/// </summary>
public sealed class AuthorizeCheckOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        // Check if the action or controller has [AllowAnonymous] attribute
        var hasAllowAnonymous = context.MethodInfo.DeclaringType?.GetCustomAttributes(true).OfType<AllowAnonymousAttribute>().Any() == true
                                || context.MethodInfo.GetCustomAttributes(true).OfType<AllowAnonymousAttribute>().Any();

        // If [AllowAnonymous] is present, don't add security requirement
        if (hasAllowAnonymous)
        {
            return;
        }

        // Check if the action or controller has [Authorize] attribute (explicit)
        var hasAuthorize = context.MethodInfo.DeclaringType?.GetCustomAttributes(true).OfType<AuthorizeAttribute>().Any() == true
                           || context.MethodInfo.GetCustomAttributes(true).OfType<AuthorizeAttribute>().Any();

        // Since we have a global authorization filter in Program.cs, all endpoints require auth by default
        // So we add security requirement to all operations (unless they have [AllowAnonymous])
        // This ensures Swagger UI shows the "Authorize" button for all endpoints

        operation.Responses.TryAdd("401", new OpenApiResponse { Description = "Unauthorized" });
        operation.Responses.TryAdd("403", new OpenApiResponse { Description = "Forbidden" });

        operation.Security ??= new List<OpenApiSecurityRequirement>();
        operation.Security.Add(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = "Bearer"
                    }
                },
                Array.Empty<string>()
            }
        });
    }
}
