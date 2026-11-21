namespace HomeHub.Infrastructure.Sync;

internal sealed class SyncState
{
    public const int CounterRowId = 1;

    public int Id { get; init; }
    public long Version { get; init; }
}
