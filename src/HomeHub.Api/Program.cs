using HomeHub.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddInfrastructure();

var app = builder.Build();

app.MapDefaultEndpoints();

// Nothing can cancel this yet: the host starts listening for shutdown signals like Ctrl+C only when RunAsync begins.
// That's safe, because PostgreSQL rolls back a migration that's interrupted (ADR-0002).
await app.MigrateDatabaseAsync(CancellationToken.None);

await app.RunAsync();
