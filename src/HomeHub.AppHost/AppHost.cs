const string ApiResourceName = "api";
const string ApiProjectPath = "../HomeHub.Api";
const string HealthEndpointPath = "/health";

var builder = DistributedApplication.CreateBuilder(args);

builder.AddDotnetProject(ApiResourceName, ApiProjectPath).WithHttpHealthCheck(HealthEndpointPath);

builder.Build().Run();
