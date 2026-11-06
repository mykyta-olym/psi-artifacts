using Microsoft.AspNetCore.Builder;

namespace Mais.Web.Extensions;

public static class SecurityHeadersExtensions
{
    private static readonly string[] PermittedReferrerPolicies =
    {
        "no-referrer",
        "strict-origin-when-cross-origin"
    };

    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
    {
        return app.Use(async (context, next) =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["X-XSS-Protection"] = "0";
            headers["Referrer-Policy"] = PermittedReferrerPolicies[0];
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";

            var isSwagger = context.Request.Path.StartsWithSegments("/swagger", StringComparison.OrdinalIgnoreCase);
            if (isSwagger)
            {
                headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups";
                headers["Cross-Origin-Resource-Policy"] = "cross-origin";
                headers["Cross-Origin-Embedder-Policy"] = "unsafe-none";
                headers["Content-Security-Policy"] =
                    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';";
            }
            else
            {
                headers["Cross-Origin-Opener-Policy"] = "same-origin";
                headers["Cross-Origin-Resource-Policy"] = "same-origin";
                headers["Cross-Origin-Embedder-Policy"] = "require-corp";
                headers["Content-Security-Policy"] =
                    "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';";
            }

            await next().ConfigureAwait(false);
        });
    }
}
