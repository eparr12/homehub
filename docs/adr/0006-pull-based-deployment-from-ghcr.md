# ADR-0006: Pull-based deployment from GHCR

Nov 25, 2026 · Ethan

## Status

Accepted

## Context

Every merge to main deploys itself (GIT-1). Main changes only through a pull request with passing CI, and each pull request gets a review from the HomeHub claude.ai project before it merges (AI-6). The host is the desktop now, under Docker Desktop, and the NAS from Phase 7, under Docker Engine, with the same image and the same compose.yaml on both. The host isn't reachable from the internet (ADR-0004), and HomeHub costs $0 to run, so CI runs on GitHub Actions, which is free for a public repo, and the image goes to GitHub Container Registry (GHCR) as a public package.

## Decision

CI builds the image, proves that it starts, and pushes it to GHCR, and the host pulls it on a schedule:

- **The host pulls.** Every 5 minutes, update.ps1 in the deploy folder runs `docker compose pull`, `docker compose up --detach --wait` and `docker image prune --force`, and Compose replaces the container only when the image or .env changed. The host needs no inbound access, no CI runner and no credentials, because the package is public.
- **An image starts in CI before it's pushed.** The image job builds the image, then starts it through compose.yaml as the host runs it: first with a backups folder it can't write to, which the server must refuse, then with a writable one, whose answers it checks. `--pull never` keeps the test on the image it just built. Only then, on a push to main, does the job push the image as `sha-` and the commit's first 7 characters, and as `main` while main still names that commit.
- **The workflow uses the runner's own docker commands**, so no third-party code runs with a token that can write packages (ci.yml).
- **The base image is pinned by digest**, so a new Node image is meant to reach the host only through a Dependabot pull request, which CI checks like any other. That pull request is still to be seen: Dependabot's docs don't say how it bumps a digest pin (#13), and none has come yet.
- **The live database sits in a Docker volume**, on the disk of Docker Desktop's Linux VM, and only finished backups sit in the Windows folder, the deploy folder's data\backups (DATA-9). Resetting Docker Desktop deletes the volume, so the backups are what survive it.
- **compose.yaml and update.ps1 reach the host only by my hand.** They're copies in the deploy folder, so what the container may touch on the desktop never changes with a merge, and a pull request that changes either starts its description with "Copy to the host:".
- **On the desktop, Task Scheduler runs update.ps1 in my session**, because Docker Desktop runs there. A console program that Task Scheduler starts opens a window, and until Phase 6 the wall is the desktop's second screen, so the task starts pwsh through `conhost.exe --headless`, which runs it with none. That flag is undocumented: it comes from reports on PowerShell issue 3028, and #14's trial saw no window, sampling about every 1.5 s.
- **A test pins the docker commands.** deploy/update.test.ts runs the real script under pwsh, with a stand-in for docker, and compares the whole list of commands it runs with toEqual, because that list is what keeps the script from ever removing a container or a volume.
- **The version in update.log comes from the container.** After a new container starts, the script asks it for GIT_SHA, the commit its image was built from, and logs that, which is the version /api/health reports.
- **Nothing rolls back by itself.** An image that can't start fails `up --wait`, and every later run logs it again until a good image reaches main, or until I put an older `sha-` tag in .env as HOMEHUB_TAG. Migrations only add tables and columns (DATA-11), so the older image runs on the newer database.
- **A run that hangs past 15 minutes isn't stopped.** At the task's time limit, Task Scheduler ends conhost.exe and lets go of the run, but the script goes on, and later runs can start beside it. #15's trial saw it with a 1-minute limit: the task read Ready at the limit while the script kept writing, and a second run, started by hand, ran beside the hung one. On November 25 I decided to accept that, as deploy/README.md documents it, because the script removes nothing, so overlapping runs can only fail and log. On the NAS, systemd's timeout will end the whole run.

## Alternatives considered

**A self-hosted runner** on the host, deploying as part of CI. The repo is public, so a fork's pull request could run code on it.

**Watchtower**, the usual container auto-updater, in place of the scheduled pull. It was archived in December 2025.

**A build alone as CI's proof.** It proves too little: in a trial before #13, which its description reports, an image with pino in devDependencies built, would have passed check and e2e, and exited at once.

**Docker's own actions** for the login, build and push. They'd be third-party code running with a token that can write packages.

**The base image's tag alone**, node:26-slim, as build-plan step 1.8's prompt had it. A new Node image would then arrive with whatever build came next, without a pull request of its own.

**The deploy folder's data folder mounted at /data**, database and all, as step 1.8's prompt had it. Docker Desktop shares a Windows folder into its Linux VM over a file-sharing layer. Docker's guidance is to keep bind-mounted data off it, and SQLite users report corrupted WAL databases on it. #13's trial saw the two kinds of mount from inside the container: /data, the volume, was ext4 on the VM's disk, and /data/backups was a 9p share of the Windows drive.

**Copies that arrive with a merge.** A merge could then change what the container may touch on the desktop.

**`pwsh -WindowStyle Hidden`**, the documented way to hide the window. It still flashes one (PowerShell issue 3028), and with Windows Terminal as the default terminal it's reported not to hide at all.

**A test that only checks for the commands it expects**, rather than the whole list. A script that also ran `docker compose down` would pass it.

**Reading the version from /api/health**, as a draft of step 1.8's second prompt, the one behind #14, had the script do. Asking the container for GIT_SHA keeps docker the only thing the script reaches, so update.test.ts's list of commands covers all of it.

**An automatic rollback**, with the script starting the previous image after a failed start, which step 1.8's second prompt decided against by default. A failed start prunes nothing, so the previous image is one line in .env away, and the image job's smoke test keeps an image that can't start off main (deploy/README.md).

**update.ps1 refusing to start while another run is going**, so that hung runs can't pile up. It's not built and not tried.

## Consequences

**A merge reaches the host in about 6 minutes at most.** The image job runs in under a minute, which #13's Find out d timed at 39 s and 29 s, and the task runs every 5 minutes. #17's merge showed at the address 158 s after the merge (its Find out b).

**A failed run shows only in update.log.** conhost hides the script's exit code, so the task's last result stays 0 after a failed run, and a run that can't start the script shows nowhere (deploy/README.md).

**The repo and the package stay public.** The host pulls without credentials only because the package is public, and Actions and the registry cost nothing because the repo is (the overview's Cost watch-list).

**Updates run only while I'm signed in.** Docker Desktop and the task both run in my session, and after a Windows Update restart HomeHub comes back once someone signs in. On the NAS, a systemd timer will take the task's place.

**The review gate rests on who can push a branch.** A pull request from a branch of this repo runs its own copy of ci.yml, and that copy can give its token packages: write, because GitHub's docs say only a fork's pull request is held to a read-only token. #13's Find out c did that on purpose, with a temporary commit that ran the push step on its pull request and pushed a tag named trial. So such a branch could push the main tag before any review, and the host runs whatever the main tag names within 5 minutes. Pushing the main tag that way is read, not tried. A session on the desktop already runs commands there, but my sessions also run on the laptop, and from there this is a path to the host that skips the review. What bounds it today is the container (SEC-9) and what it can touch: the database volume and the backups folder. From Phase 7 the host is the NAS, so step 7.2 decides whether the host should check more than the tag.
