using HomeHub.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddInfrastructure();

var app = builder.Build();

app.MapDefaultEndpoints();

await app.MigrateDatabaseAsync(CancellationToken.None);

await app.RunAsync();
