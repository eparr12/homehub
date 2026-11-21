using Microsoft.EntityFrameworkCore;

namespace HomeHub.Infrastructure.Persistence;

// The running app and the EF Core tools both call this, so migrations are built from the same model the app runs.
// Put any option that changes the model here, never in just one of them.
internal static class HomeHubModelOptions
{
    public static void Configure(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseSnakeCaseNamingConvention();
    }
}
