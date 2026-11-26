# Deploying HomeHub on the host

HomeHub runs from a deploy folder, C:\HomeHub, where a scheduled task runs update.ps1 every 5 minutes. Each run pulls the image that CI pushed for main, starts it if anything changed, and removes the untagged images that no container uses. This page sets that up on the desktop. On the NAS, in Phase 7, a systemd timer takes the task's place.

## The deploy folder

C:\HomeHub sits on a local disk, never in OneDrive (DATA-9). It holds:

| File or folder | Where it comes from |
| --- | --- |
| compose.yaml | A copy of the repo's compose.yaml |
| update.ps1 | A copy of the repo's deploy/update.ps1 |
| .env | Written by hand, in step 4 below |
| data\backups | Made by Docker at the first start. For now, the server writes a backup here only before a migration; the nightly backup comes in Phase 2. |
| update.log | Written by update.ps1 |

The database isn't in this folder. It lives in the Docker volume homehub_database, on the disk of Docker Desktop's Linux VM, because SQLite's locks and write-ahead log can't be trusted in a folder shared from Windows. Resetting Docker Desktop deletes that volume, so data\backups is what survives. Until the nightly backup exists (Phase 2), that's a copy from before the last migration.

## The copies come by hand

compose.yaml and update.ps1 reach the host only when you copy them, so what the container may touch on this machine changes only by your hand, never by a merge. A pull request that changes either file puts "Copy to the host:" and the file names on the first line of its description. After it merges, copy them again, as in step 3.

## Setting up

1. In Docker Desktop's settings, under General, turn on "Start Docker Desktop when you sign in to your computer".
2. Keep Windows from sleeping while it's plugged in:

   ```powershell
   powercfg /change standby-timeout-ac 0
   powercfg /change hibernate-timeout-ac 0
   ```

   On a laptop, also set closing the lid to do nothing while plugged in, in Settings under System, Power & battery.
3. Make the folder and copy the two files into it, from the repo folder:

   ```powershell
   New-Item -ItemType Directory C:\HomeHub
   Copy-Item .\compose.yaml, .\deploy\update.ps1 C:\HomeHub
   ```

   PowerShell 7's default execution policy, RemoteSigned, runs a script copied this way. A file downloaded through a browser is marked as coming from the internet and won't run until you run `Unblock-File` on it.
4. Write C:\HomeHub\.env with the real logins in place of these made-up ones:

   ```sh
   ALLOWED_USERS=alex@example.com=alex,sam@example.com=sam
   ```

   Nothing else belongs in it. compose.yaml sets NODE_ENV, HOST, PORT and DATA_DIR itself, and HOMEHUB_TAG goes in only for a rollback.
5. Run the script once by hand, then read its log and ask the server for its version:

   ```powershell
   pwsh -NoProfile -File C:\HomeHub\update.ps1; $LASTEXITCODE
   Get-Content C:\HomeHub\update.log
   curl.exe http://127.0.0.1:8080/api/health
   ```

   The exit code is 0, the log has one line, such as `2026-11-25T17:20:10Z new container, version 7a89aa25272ef1bc0201c37e297b0f45ab22b435`, and /api/health reports the same version: the commit that main's image was built from.
6. Register the task, below.
7. Publish HomeHub on the tailnet: see Publishing on the tailnet.

## The task

```powershell
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument '--headless pwsh.exe -NoProfile -NonInteractive -File C:\HomeHub\update.ps1'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId (whoami) -LogonType Interactive
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'HomeHub update' -Action $action -Trigger $trigger -Principal $principal -Settings $settings
```

Registering needs no administrator. The task:

- **Runs every 5 minutes**, from now on, with no end date.
- **Runs only while you're signed in**, because Docker Desktop runs in your session. It isn't elevated: RunLevel stays Limited, the default.
- **Skips a run while the last one is still going**, but only while that one is under 15 minutes old. After that, the task lets go of it, and later runs can start beside it: see the next bullet.
- **Lets go of a run after 15 minutes, but doesn't stop it.** At the limit, Task Scheduler ends conhost.exe and the task leaves Running, but pwsh.exe and the script go on. So the limit doesn't stop a hung run, and later runs can start beside it. A trial with a 1-minute limit and a stand-in script that wrote a line every 10 s for 5 minutes showed it: at 1 minute the task was Ready and conhost.exe was gone, while pwsh.exe wrote every line to the end, almost 4 minutes later. Until the limit, the task stays Running while the script runs, which the setting above relies on. Task Scheduler's default limit is 3 days. This one has to outlast a slow pull of the 100 MB image and the 120 s that a new container gets to report healthy, so never set it below 10 minutes.
- **Runs on battery too.** By default, Task Scheduler doesn't start a task on battery and stops one that's running when the power goes. On a laptop that would pause the updates, and could stop one halfway through replacing the container.
- **Opens no window.** A console program that Task Scheduler starts opens one, and until Phase 6 the wall is this desktop's second screen. `pwsh -WindowStyle Hidden` still flashes a window (PowerShell issue 3028), and with Windows Terminal as the default terminal it's reported not to hide at all. `conhost.exe --headless` runs pwsh with no window. That flag is undocumented: it comes from reports on that issue, and a trial run here showed no window.

conhost hides the script's exit code: the task's last result stays 0, even after a failed run, and reads 267014 only after a run that passed the time limit, until the next run starts. So update.log is the only place a failed run shows, and a run that can't start the script shows nowhere (see When a run fails).

To start a run now, see when it last ran and runs next, or remove the task:

```powershell
Start-ScheduledTask -TaskName 'HomeHub update'
Get-ScheduledTaskInfo -TaskName 'HomeHub update' | Format-List LastRunTime, NextRunTime
Unregister-ScheduledTask -TaskName 'HomeHub update' -Confirm:$false
```

## What a run does

update.ps1 moves into its own folder, because Task Scheduler starts it in System32 and Compose reads compose.yaml and .env from the folder it runs in. Then it runs `docker compose pull`, `docker compose up --detach --wait` and `docker image prune --force`. Compose replaces the container only when the image or .env changed, so a changed .env takes effect on the next run by itself. The prune removes every image on this machine that has no tag and that no container uses, HomeHub's or not.

The script stops at the first docker command that fails, and exits with code 1. After a failed pull the container keeps running. After a failed start nothing is pruned, so the previous image is still on disk. It never runs `docker compose down` or `rm`, `--volumes`, a volume command or `docker system prune`, so it can't touch the database or the backups.

update.log gets a line only for a new container, with its version, or for a failure, with the docker command and the last thing docker said. A run that changed nothing writes nothing. Once the log passes 1 MB, it keeps its newer half.

```text
2026-11-25T17:20:10Z new container, version 7a89aa25272ef1bc0201c37e297b0f45ab22b435
2026-11-25T17:20:41Z failed: docker compose pull --quiet failed with exit code 1: Error response from daemon: failed to resolve reference "ghcr.io/eparr12/homehub:no-such-tag": ghcr.io/eparr12/homehub:no-such-tag: not found
```

## When a run fails

- **Docker Desktop hasn't started yet after you sign in.** The first command fails with something like `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; ... The system cannot find the file specified.` HomeHub isn't running either until Docker Desktop is. The first run after Docker Desktop is up works, so a line or two like this after a sign-in is normal.
- **No network.** The pull fails, and the container keeps running the image it has. The next run with a network catches up.
- **An image that can't start.** The start fails with `container homehub-homehub-1 is unhealthy`, and every later run logs it again. Nothing rolls back by itself, so HomeHub stays down until a good image arrives on main, or until you roll back. The image job's smoke test in CI is what keeps such an image off main.
- **A run that hangs past 15 minutes.** The task lets go of it, and later runs start beside it, but its pwsh.exe goes on, with any docker.exe it started under it. The hung run writes no line to update.log, and the task's last result reads 267014 (0x41306, SCHED_S_TASK_TERMINATED) only until the next run starts, within 5 minutes. So look for the run itself: a pwsh.exe whose command line names C:\HomeHub\update.ps1 and that started more than 15 minutes ago. These show the last result, every run with its start time, and what one run started:

  ```powershell
  Get-ScheduledTaskInfo -TaskName 'HomeHub update' | Format-List LastRunTime, LastTaskResult
  Get-CimInstance Win32_Process -Filter "Name = 'pwsh.exe'" | Where-Object CommandLine -like '*C:\HomeHub\update.ps1*' | Format-Table ProcessId, CreationDate
  Get-CimInstance Win32_Process -Filter 'ParentProcessId = <id>' | Format-Table ProcessId, Name, CreationDate
  ```

  End a run that started more than 15 minutes ago, and everything under it, with `taskkill /T /F /PID <id>`, using its ProcessId. A younger run may only be slow, so leave it alone.
- **The script doesn't start at all.** A PowerShell older than 7.4 refuses it over its #Requires line, and a broken copy stops at the parser. Either way PowerShell prints the error and exits with 1 before the script writes anything, so update.log gets no line, and the task's last result is still 0. So when a merge doesn't arrive, the log has no new line and no run hangs (above), the script isn't starting: run step 5's command by hand to see why.

## Rolling back

Put an older image's tag in C:\HomeHub\.env, as `sha-` and the commit's first 7 characters, such as this made-up one:

```sh
HOMEHUB_TAG=sha-1a2b3c4
```

The task's next run starts that image, or `Start-ScheduledTask -TaskName 'HomeHub update'` starts a run now. Migrations only add tables and columns (DATA-11), so an older image still runs on a newer database. To go forward again, delete the line, and the next run starts main's image.

## Publishing on the tailnet

Tailscale Serve publishes HomeHub to the tailnet at `https://homehub.<tailnet>.ts.net` and passes each request to the container on 127.0.0.1:8080 ([the tailscale serve command](https://tailscale.com/docs/reference/tailscale-cli/serve)). In a PowerShell window on the host, which needn't be elevated, publish it and read the setting back:

```powershell
tailscale serve --bg --https=443 http://127.0.0.1:8080
tailscale serve status
```

The status reads:

```text
https://homehub.<tailnet>.ts.net (tailnet only)
|-- / proxy http://127.0.0.1:8080
```

It must say tailnet only. Never turn on Funnel, which would put HomeHub on the internet (SEC-2). If the status ever says anything else, run `tailscale serve reset`, then publish again. Two things come from Tailscale's docs, and no restart has tried them yet: `--bg` keeps the setting across restarts, and Tailscale on Windows runs in your session, like Docker Desktop, so the address answers once you've signed in ([Run unattended](https://tailscale.com/kb/1088/run-unattended)). To stop publishing, run `tailscale serve --https=443 off`.

What Serve does to a request:

- **It replaces any identity header that a client sends with its own.** From a device on the tailnet, /api/me gave the same answer with a forged `Tailscale-User-Login` or `Tailscale_User_Login` header as without one.
- **It sets none for a tagged device**, as [Tailscale's Serve page](https://tailscale.com/kb/1312/serve) says.
- **It compresses nothing.** The app's script came back whole, with no Content-Encoding, to a request that accepted gzip and br.

## Who may use it

A person needs a device on the tailnet, signed in to Tailscale as themselves, and their pair in ALLOWED_USERS:

1. Invite them from the admin console's Users page ([Tailscale's steps](https://tailscale.com/docs/features/sharing/how-to/invite-any-user)). They accept the invite in a browser before they sign in to the Tailscale app.
2. Check that their device is on the admin console's Machines page, under their name. If they're on Users but the device isn't on Machines, its Tailscale app is signed in to another tailnet, and switching the account in the app to ours fixes it.
3. Add their pair to ALLOWED_USERS in C:\HomeHub\.env, as in Setting up's step 4, with the login as the Users page shows it. The task's next run replaces the container and logs a `new container` line.
4. On their device, open `https://homehub.<tailnet>.ts.net/api/me`, which shows their short name. That's the check, because a device whose login isn't on the list still gets every page of the app, installs it and loads it offline; only /api/me answers it with a 401.

A line the server can't read stops HomeHub. Every run then logs a `failed: docker compose up` line in update.log, and `docker logs homehub-homehub-1 --tail 5` shows the server's `invalid configuration` lines. Each one's error field names the variable and the entry, such as `Entry 2 isn't a login=shortname pair`, never a login. Fix the line, and the next run starts HomeHub again.

A 401 carries a requestId. The server's log line with that ID gives the reason, never the login: `login not on ALLOWED_USERS`, or `login header missing` for a tagged device or a request that didn't come through Serve. To find it, put the 401's requestId in place of this made-up one:

```powershell
docker logs homehub-homehub-1 | Select-String '3f6c1e2a-9b4d-4f7a-8c5e-2d1b0a9f8e7d'
```

A lost phone is removed from the tailnet in the admin console the same day (SEC-11).
