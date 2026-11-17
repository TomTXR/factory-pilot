#!/usr/bin/env bash
# Forced command for the CI deploy key on the factory VM (user "deploy").
# Accepted commands (via SSH_ORIGINAL_COMMAND):
#   deploy prod <sha>
#   deploy pr <number> <sha>
#   destroy pr <number>
#   status
# Installed to /usr/local/bin/pilot-deploy (root-owned, not writable by deploy).
set -euo pipefail

REPO_URL="git@github.com:TomTXR/factory-pilot.git"
BASE=/srv/pilot
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/github_deploy -o IdentitiesOnly=yes"

log() { printf '{"time":"%s","level":"%s","msg":"%s"}\n' "$(date -u +%FT%TZ)" "$1" "$2"; }
fail() { log error "$1"; exit 2; }

read -r -a args <<< "${SSH_ORIGINAL_COMMAND:-}"
cmd="${args[0]:-}"
target="${args[1]:-}"
sha=""

case "$cmd:$target" in
  deploy:prod)
    project="pilot-prod"; sha="${args[2]:-}" ;;
  deploy:pr | destroy:pr)
    n="${args[2]:-}"
    [[ "$n" =~ ^[0-9]{1,6}$ ]] || fail "invalid PR number"
    project="pilot-pr-$n"; sha="${args[3]:-}" ;;
  status:)
    docker ps --filter "name=pilot-" --format '{{.Names}}\t{{.Status}}'; exit 0 ;;
  *)
    fail "usage: deploy prod <sha> | deploy pr <n> <sha> | destroy pr <n> | status" ;;
esac

dir="$BASE/$project"
envfile="$BASE/env/$project.env"
mkdir -p "$BASE/env" "$BASE/locks"
exec 9>"$BASE/locks/$project.lock"
flock 9

compose() {
  COMPOSE_PROJECT_NAME="$project" EDGE_ALIAS="$project-web" \
    docker compose -f "$dir/docker-compose.yml" -f "$dir/docker-compose.server.yml" "$@"
}

if [ "$cmd" = "destroy" ]; then
  if [ -d "$dir" ]; then compose down -v --remove-orphans; fi
  rm -rf "$dir" "$envfile"
  log info "destroyed $project"
  exit 0
fi

[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || fail "invalid commit sha"

if [ ! -d "$dir/.git" ]; then git clone --quiet "$REPO_URL" "$dir"; fi
git -C "$dir" fetch --quiet origin "$sha"
git -C "$dir" checkout --quiet --force "$sha"

if [ ! -f "$envfile" ]; then
  ( umask 077; printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > "$envfile" )
fi
set -a; . "$envfile"; set +a
export APP_VERSION="$sha"

log info "deploying $project at $sha"
compose up -d --build --wait --remove-orphans
docker image prune -f > /dev/null
log info "deployed $project at $sha"
