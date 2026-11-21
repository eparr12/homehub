using HomeHub.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HomeHub.Infrastructure;

public static class InfrastructureHostExtensions
{
    public static async Task MigrateDatabaseAsync(this IHost host, CancellationToken cancellationToken)
    {
        await using var scope = host.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<HomeHubDbContext>();
        await dbContext.Database.MigrateAsync(cancellationToken);
    }
}
