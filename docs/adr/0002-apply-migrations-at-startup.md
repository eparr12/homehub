# ADR-0002: Apply database migrations when the Api starts

Date: 2026-11-20

## Status

Accepted

## Context

HomeHub's schema changes only through EF Core migrations, and each migration's generated SQL is reviewed in its pull request ([DATA-4](../coding-standards.md)). Something has to apply those migrations to every database: the local PostgreSQL container, the test database in the integration tests, and the Azure Database for PostgreSQL Flexible Server.

Locally, the AppHost starts a new PostgreSQL container on every run, with no data volume, so the schema has to be built from nothing each time. HomeHub runs one Api instance, both locally and in Azure for a two-person household.

EF Core 9 and later take a database lock while they migrate. The Npgsql provider locks the `__EFMigrationsHistory` table for the length of each migration's transaction, so two instances that start together can't apply the same migration twice. EF Core also refuses to migrate when the model has changes that no migration covers, so a forgotten migration fails at startup instead of going unnoticed. PostgreSQL runs schema changes inside transactions, so a migration that fails or is interrupted rolls back completely.

In Azure, Aspire's Microsoft Entra ID setup makes the Api's managed identity an administrator of the Flexible Server, so the Api already holds the rights to change the schema.

## Decision

We will apply pending migrations when the Api starts, before it serves any request.

- `Program.cs` awaits `MigrateDatabaseAsync`, an extension method on `IHost` in Infrastructure, after `Build` and before `RunAsync`. The method resolves `HomeHubDbContext` from its own dependency injection scope and awaits `Database.MigrateAsync`.
- A failed migration is not caught. The exception ends the process before it serves a request, and Aspire or Azure reports the Api as failed ([OBS-3](../coding-standards.md)).
- We will not call `EnsureCreated`, and we will not wrap migrations in a transaction of our own.
- Every migration's SQL is still reviewed in its pull request with `dotnet ef migrations script` before it merges.
- Every migration keeps the schema usable by the Api version before it. From build step 1.8, Azure Container Apps keeps the old revision serving until the new one is ready ([Revisions in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/revisions)), so for a short time the old Api runs against the schema the new Api just migrated. Migration bundles wouldn't remove that window, because a bundle run before the deploy leaves the old Api on the new schema too. A breaking change, such as renaming or dropping a column, is split across releases: one adds the new shape, and a later one removes the old shape once no running version uses it.

This decision holds while HomeHub runs one Api instance and its data is easy to rebuild. When any of the following becomes true, we will move to migration bundles run by the deployment pipeline, in a new ADR that supersedes this one:

- The Api runs more than one replica.
- The Api's identity should lose the right to change the schema.
- A migration is slow enough to fail the Api's startup health checks.
- The household's data deserves a backup and a gated step before each schema change.

## Alternatives considered

- **Migration bundles run by the deployment pipeline.** `dotnet ef migrations bundle` builds a self-contained executable that applies pending migrations ([Applying migrations](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying)), and the deploy job would run it before the new version starts. It separates schema changes from app startup and lets the Api's identity drop its schema rights. Not chosen yet because there is no deployment pipeline until build step 1.8, and it needs a second identity with schema rights in CI. It is the planned replacement.
- **An idempotent SQL script applied by the pipeline.** `dotnet ef migrations script --idempotent` produces SQL that is safe to run against a database at any migration, so the reviewed SQL is exactly what runs. Rejected because it needs psql and database credentials in CI, plus an apply step, which is more tooling than one instance needs.
- **A migration service in the AppHost.** Aspire's documented pattern adds a small worker project that applies migrations and exits, and the Api waits for it to finish. Rejected because it adds a project and a container to build and run, and in Azure another Container App, for little gain with one instance.
- **Aspire's `AddEFMigrations`.** The Aspire.Hosting.EntityFrameworkCore integration runs migrations from the AppHost. Rejected because it is still a preview in Aspire 17.0.
- **`EnsureCreated`.** EF Core builds the schema straight from the model. Rejected because it writes no migration history, so later migrations can't run against that database.

## Consequences

- Every database, including a fresh local container, gets the current schema with no manual step, and the same code path runs locally and in Azure.
- The schema can't fall behind the code, because the version that needs a migration applies it.
- EF Core logs each migration it applies, so the Aspire dashboard and the Azure logs show what ran and when.
- The Api keeps the right to change the schema in Azure, which is more than it needs to serve requests.
- A bad migration stops the Api from starting until a fix is deployed. Reverting the code doesn't revert the schema, because down migrations never run on their own.
- The SQL is reviewed in the pull request, but nobody inspects it at deploy time, and a long migration delays startup.
- A breaking schema change takes two releases instead of one.
- The migration runs whenever the Api's entry point runs, not only when it's deployed. Build-time OpenAPI generation launches the entry point with an inert server ([Generate OpenAPI documents](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/openapi/aspnetcore-openapi)), so if API-7's types come from a document generated at build time (build step 1.7), the migration call has to skip that case, or every build would try to migrate a database.
