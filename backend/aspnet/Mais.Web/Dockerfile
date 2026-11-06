# Multi-stage build for ASP.NET Core 9 API
# Build context expected at repo root to access backend and data folders

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# copy csproj and restore first (better layer caching)
COPY backend/aspnet/Mais.Web/Mais.Web.csproj backend/aspnet/Mais.Web/
RUN dotnet restore backend/aspnet/Mais.Web/Mais.Web.csproj

# copy source and publish
COPY backend/aspnet/Mais.Web/ backend/aspnet/Mais.Web/
RUN dotnet publish backend/aspnet/Mais.Web/Mais.Web.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:5000
# copy published app
COPY --from=build /app/publish .
# create wwwroot directory for static files (even if empty)
RUN mkdir -p /app/wwwroot
# create data-protection-keys directory for persistent key storage
RUN mkdir -p /app/data-protection-keys
# copy seed data to absolute path that matches ../../data/seed from ContentRoot
COPY backend/data/seed /data/seed
EXPOSE 5000
ENTRYPOINT ["dotnet", "Mais.Web.dll"]
