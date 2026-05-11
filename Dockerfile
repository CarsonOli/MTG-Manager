# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project file first so restore can be cached between builds.
COPY backend/MtgManager/MtgManager/MtgManager.csproj backend/MtgManager/MtgManager/
RUN dotnet restore backend/MtgManager/MtgManager/MtgManager.csproj

# Copy source and publish the API.
COPY backend/MtgManager/MtgManager/ backend/MtgManager/MtgManager/
RUN dotnet publish backend/MtgManager/MtgManager/MtgManager.csproj -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Render provides PORT at runtime. Bind Kestrel to it.
CMD ["sh", "-c", "ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080} dotnet MtgManager.dll"]
