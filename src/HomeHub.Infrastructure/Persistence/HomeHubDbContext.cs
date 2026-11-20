using HomeHub.Infrastructure.Sync;

using Microsoft.EntityFrameworkCore;

namespace HomeHub.Infrastructure.Persistence;

public sealed class HomeHubDbContext(DbContextOptions<HomeHubDbContext> options) : DbContext(options)
{
    public DbSet<SyncState> SyncStates => Set<SyncState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(HomeHubDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
