const string ApiResourceName = "api";
const string ApiProjectPath = "../HomeHub.Api";
const string HealthEndpointPath = "/health";
const string ServerName = "postgres";
// Must equal DatabaseConnectionName in Infrastructure's InfrastructureServiceExtensions. The two projects can't share a constant, so keep them in sync by hand.
const string DatabaseName = "homehubdb";
const string PostgresImageTag = "18";

var builder = DistributedApplication.CreateBuilder(args);

// pgAdmin is a local-only tool. RunAsContainer skips this callback when publishing, so pgAdmin never deploys to Azure.
var db = builder.AddAzurePostgresFlexibleServer(ServerName)
    .RunAsContainer(container => container.WithImageTag(PostgresImageTag).WithPgAdmin())
    .AddDatabase(DatabaseName);

builder.AddDotnetProject(ApiResourceName, ApiProjectPath)
    .WithHttpHealthCheck(HealthEndpointPath)
    .WithReference(db)
    .WaitFor(db);

builder.Build().Run();
