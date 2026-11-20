using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HomeHub.Infrastructure.Sync;

internal sealed class SyncStateConfiguration : IEntityTypeConfiguration<SyncState>
{
    private const string TableName = "sync_state";

    public void Configure(EntityTypeBuilder<SyncState> builder)
    {
        builder.ToTable(TableName);
        builder.Property(x => x.Id).ValueGeneratedNever();
        //Gives every database its counter row. Never change or remove this seed: the next migration would reset or delete the live row.
        builder.HasData(new SyncState { Id = SyncState.CounterRowId, Version = 0 });
    }
}
