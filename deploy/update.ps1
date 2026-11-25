#Requires -Version 7.4
<#
Updates HomeHub on the host (build-plan step 1.8). Task Scheduler runs it every
5 minutes from the deploy folder, beside compose.yaml and .env, as
deploy/README.md sets up. It pulls the image that compose.yaml names, starts
it and waits for it to report healthy, then removes the untagged images that
no container uses.

It writes a line to update.log, beside itself, only for a new container, with
its version, or for a failure. It stops at the first docker command that
fails, so a failed pull leaves the container alone and a failed start prunes
nothing, and the previous image is still there; then it exits with code 1.

It never runs docker compose down or rm, --volumes, a volume command or system
prune, so it can't touch the database volume or data\backups.
deploy/update.test.ts pins the list of docker commands it runs.

The #Requires line keeps Windows PowerShell 5.1 from running it.
#>

$ErrorActionPreference = 'Stop'

$LogFile = Join-Path $PSScriptRoot 'update.log'
# Room for a failure that repeats every 5 minutes for months.
$LogLimitBytes = 1MB

function Write-Log([string] $Message) {
    $time = [DateTime]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [Globalization.CultureInfo]::InvariantCulture)
    Add-Content -LiteralPath $LogFile -Value "$time $Message"
    if ((Get-Item -LiteralPath $LogFile).Length -gt $LogLimitBytes) {
        $lines = @(Get-Content -LiteralPath $LogFile)
        $lines | Select-Object -Last ([math]::Floor($lines.Count / 2)) | Set-Content -LiteralPath $LogFile
    }
}

# A failed program doesn't stop a PowerShell script, and docker writes its
# progress to stderr also when it succeeds. So every docker call comes through
# here: it throws on a nonzero exit code, with the last stderr line as the
# reason, and returns only what docker wrote to stdout.
function Invoke-Docker {
    $output = & docker @args 2>&1
    $errors, $printed = @($output).Where({ $_ -is [System.Management.Automation.ErrorRecord] }, 'Split')
    if ($LASTEXITCODE -ne 0) {
        throw "docker $($args -join ' ') failed with exit code ${LASTEXITCODE}: $(@($printed + $errors)[-1])"
    }
    $printed
}

try {
    # Task Scheduler starts a task in System32, and Compose reads compose.yaml
    # and .env from the folder it runs in.
    Set-Location -LiteralPath $PSScriptRoot
    $before = Invoke-Docker compose ps --all --quiet
    Invoke-Docker compose pull --quiet | Out-Null
    # The time a new container gets to report healthy: above the health
    # check's 60 s start period, which a slow first start (a backup, then
    # migrations) may use, and well under the task's 5 minutes.
    Invoke-Docker compose up --detach --wait --wait-timeout 120 | Out-Null
    $after = Invoke-Docker compose ps --all --quiet
    # A line for every run would be 288 a day, so only a new container gets one.
    if ("$after" -ne "$before") {
        $version = Invoke-Docker compose exec -T homehub printenv GIT_SHA
        Write-Log "new container, version $version"
    }
    Invoke-Docker image prune --force | Out-Null
}
catch {
    Write-Log "failed: $($_.Exception.Message)"
    exit 1
}
