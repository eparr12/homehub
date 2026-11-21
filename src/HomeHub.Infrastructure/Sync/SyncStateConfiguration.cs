using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HomeHub.Infrastructure.Sync;

internal sealed class SyncStateConfiguration : IEntityTypeConfiguration<SyncState>
{
    private const string TableName = "sync_state";

    public void Configure(EntityTypeBuilder<SyncState> builder)
    {
        // Singular, with the fixed key 1, on purpose: this table holds exactly one row (DATA-1 and DATA-2 exceptions).
        // The AddSyncState migration inserts that row by hand; see the comment there.
        builder.ToTable(TableName);
        builder.Property(x => x.Id).ValueGeneratedNever();
    }
}
