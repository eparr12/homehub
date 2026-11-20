using HomeHub.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HomeHub.Infrastructure;

public static class InfrastructureServiceExtensions
{
    //Must equal the database resource name in the AppHost. The two projects can’t share a constant, so keep them in sync by hand.
    private const string DatabaseConnectionName = "homehubdb";

    public static IHostApplicationBuilder AddInfrastructure(this IHostApplicationBuilder builder)
    {
        builder.AddAzureNpgsqlDbContext<HomeHubDbContext>(DatabaseConnectionName, configureDbContextOptions: HomeHubModelOptions.Configure);
        return builder;
    }

    public static async Task MigrateDatabaseAsync(this IHost host, CancellationToken cancellationToken = default)
    {
        await using var scope = host.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<HomeHubDbContext>();
        await dbContext.Database.MigrateAsync(cancellationToken);
    }
}
