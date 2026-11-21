using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HomeHub.Infrastructure.Persistence;

// Only the dotnet ef tools use this. It needs no connection string because adding and scripting migrations reads the model, not the database.
// Commands that reach the database need more: database update needs --connection, and migrations remove needs --force, because it first asks the database whether the migration was applied.
internal sealed class HomeHubDbContextFactory : IDesignTimeDbContextFactory<HomeHubDbContext>
{
    public HomeHubDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<HomeHubDbContext>();
        optionsBuilder.UseNpgsql();
        HomeHubModelOptions.Configure(optionsBuilder);
        return new HomeHubDbContext(optionsBuilder.Options);
    }
}
