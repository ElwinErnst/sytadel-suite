#!/usr/bin/env bash
#
# metrics.sh — AI-assisted delivery metrics derived from real artifacts.
#
# Reads git history, GitHub (via `gh`), and the ODD feature docs under
# odd/tasks/ to report three families of signal:
#
#   SPEED   — how fast change flows (commit cadence, PR lead time)
#   REWORK  — how much we redo (reverts, fix-after-feat, file churn)
#   DEFECTS — how much breaks (fix/hotfix ratio, smoke failure rate)
#
# Everything here is DERIVED from history — nothing is self-reported — so the
# numbers are reproducible by anyone with the repo. Several signals are proxies
# (a `fix:` commit is not exactly a defect); those are labelled "(proxy)".
#
# Usage:
#   scripts/metrics.sh [--json] [--submodules] [--since <git-date>]
#
#   --json         Emit a machine-readable snapshot instead of the table.
#   --submodules   Also report per-submodule git signal.
#   --since DATE   Window start (any git date, default: "90 days ago").
#
# The script is read-only; it never mutates the repository.

set -euo pipefail

SINCE="${METRICS_SINCE:-90 days ago}"
EMIT_JSON=0
WITH_SUBMODULES=0
CHURN_WINDOW_DAYS="${METRICS_CHURN_WINDOW_DAYS:-7}"
REPO_SLUG="${METRICS_REPO:-ElwinErnst/sytadel-suite}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) EMIT_JSON=1 ;;
    --submodules) WITH_SUBMODULES=1 ;;
    --since) SINCE="${2:?--since needs a date}"; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

cd "$(git rev-parse --show-toplevel)"

have_gh() { command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; }

# Weeks in the window, for cadence rates. At least 1 to avoid divide-by-zero.
window_weeks() {
  local start_epoch now_epoch days
  start_epoch="$(git log -1 --format=%ct --since="$SINCE" 2>/dev/null || true)"
  start_epoch="$(git log --since="$SINCE" --format=%ct --reverse 2>/dev/null | head -1 || true)"
  now_epoch="$(git log -1 --format=%ct 2>/dev/null || echo 0)"
  if [[ -z "$start_epoch" || "$now_epoch" -le "$start_epoch" ]]; then echo 1; return; fi
  days=$(( (now_epoch - start_epoch) / 86400 ))
  awk -v d="$days" 'BEGIN { w = d/7; printf("%.2f", (w < 1) ? 1 : w) }'
}

# ---- SPEED ------------------------------------------------------------------

commits_in_window() { git log --since="$SINCE" --no-merges --oneline | wc -l | tr -d ' '; }

# median & p90 of PR lead time (hours), via gh. Prints "median p90 count".
pr_lead_times() {
  have_gh || { echo "na na 0"; return; }
  local tmp; tmp="$(mktemp)"
  gh pr list --repo "$REPO_SLUG" --state merged --limit 200 \
     --json createdAt,mergedAt \
     -q '.[] | select(.mergedAt != null) | ((((.mergedAt|fromdateiso8601) - (.createdAt|fromdateiso8601)) / 3600))' \
     2>/dev/null | awk '$1 >= 0' | sort -n > "$tmp" || true
  local n; n="$(wc -l < "$tmp" | tr -d ' ')"
  if [[ "$n" -eq 0 ]]; then rm -f "$tmp"; echo "na na 0"; return; fi
  awk -v n="$n" '
    { a[NR]=$1 }
    END {
      med = (n % 2) ? a[int(n/2)+1] : (a[n/2] + a[n/2+1]) / 2
      p = int(0.9 * n); if (p < 1) p = 1
      printf("%.1f %.1f %d", med, a[p], n)
    }' "$tmp"
  rm -f "$tmp"
}

# ---- REWORK -----------------------------------------------------------------

reverts_in_window() { git log --since="$SINCE" --grep='^Revert' --oneline | wc -l | tr -d ' '; }

# fix(scope) commits whose scope also appears in a feat(scope) commit in window.
fix_after_feat() {
  local feats fixes count=0 scope
  feats="$(git log --since="$SINCE" --format='%s' | sed -nE 's/^feat\(([^)]+)\).*/\1/p' | sort -u)"
  fixes="$(git log --since="$SINCE" --format='%s' | sed -nE 's/^fix\(([^)]+)\).*/\1/p')"
  [[ -z "$fixes" ]] && { echo 0; return; }
  while IFS= read -r scope; do
    [[ -z "$scope" ]] && continue
    if grep -qxF "$scope" <<<"$feats"; then count=$((count + 1)); fi
  done <<<"$fixes"
  echo "$count"
}

# Churn: % of files re-touched within CHURN_WINDOW_DAYS of a prior change.
churn_pct() {
  local tmp; tmp="$(mktemp)"
  # "epoch<TAB>path" for every file change in the window.
  git log --since="$SINCE" --no-merges --format='C%ct' --name-only \
    | awk 'BEGIN{t=0} /^C[0-9]+$/{t=substr($0,2); next} NF{print t"\t"$0}' > "$tmp"
  local total retouched win=$((CHURN_WINDOW_DAYS * 86400))
  total="$(cut -f2 "$tmp" | sort -u | wc -l | tr -d ' ')"
  if [[ "$total" -eq 0 ]]; then rm -f "$tmp"; echo "0.0"; return; fi
  retouched="$(sort -k2 "$tmp" | awk -v win="$win" '
    { if ($2 == prevpath && (prevts - $1) <= win && (prevts - $1) >= 0) hit[$2]=1
      prevpath=$2; prevts=$1 }
    END { c=0; for (f in hit) c++; print c }')"
  awk -v r="$retouched" -v t="$total" 'BEGIN { printf("%.1f", 100*r/t) }'
  rm -f "$tmp"
}

# ODD forecast-vs-actual drift, mean |actual-forecast|/forecast across docs.
odd_drift() {
  local docs tmp; docs=(odd/tasks/*.md)
  [[ -e "${docs[0]}" ]] || { echo "na 0"; return; }
  tmp="$(mktemp)"
  grep -hE '^(forecast_lines|actual_lines):' odd/tasks/*.md 2>/dev/null > "$tmp" || true
  awk '
    /^forecast_lines:/ { f=$2; next }
    /^actual_lines:/   { if (f>0) { d+=( ($2>f?$2-f:f-$2) / f ); n++ }; f=0 }
    END { if (n==0) print "na 0"; else printf("%.0f %d", 100*d/n, n) }' "$tmp"
  rm -f "$tmp"
}

# ---- DEFECTS ----------------------------------------------------------------

# fix/hotfix merged PRs ÷ total merged PRs (gh); commit proxy otherwise.
defect_ratio() {
  if have_gh; then
    local titles total fixes
    titles="$(gh pr list --repo "$REPO_SLUG" --state merged --limit 200 --json title -q '.[].title' 2>/dev/null || true)"
    total="$(grep -c '' <<<"$titles" 2>/dev/null || echo 0)"
    [[ -z "$titles" ]] && total=0
    if [[ "$total" -gt 0 ]]; then
      fixes="$(grep -ciE '^(fix|hotfix)' <<<"$titles" || true)"
      awk -v f="${fixes:-0}" -v t="$total" 'BEGIN { printf("%.1f %d %d pr", 100*f/t, f, t) }'
      return
    fi
  fi
  # proxy from commits
  local total fixes
  total="$(git log --since="$SINCE" --no-merges --oneline | wc -l | tr -d ' ')"
  [[ "$total" -eq 0 ]] && { echo "0.0 0 0 commit-proxy"; return; }
  fixes="$(git log --since="$SINCE" --no-merges --format='%s' | grep -ciE '^fix(\(|:)' || true)"
  awk -v f="${fixes:-0}" -v t="$total" 'BEGIN { printf("%.1f %d %d commit-proxy", 100*f/t, f, t) }'
}

# smoke-check failure rate on main (gh). Prints "pct failures total".
smoke_failure_rate() {
  have_gh || { echo "na na na"; return; }
  local rows total fails
  rows="$(gh run list --repo "$REPO_SLUG" --workflow smoke.yml --branch main --limit 50 \
          --json conclusion -q '.[].conclusion' 2>/dev/null || true)"
  [[ -z "$rows" ]] && { echo "na na na"; return; }
  total="$(grep -c '' <<<"$rows")"
  fails="$(grep -c 'failure' <<<"$rows" || true)"
  awk -v f="${fails:-0}" -v t="$total" 'BEGIN { printf("%.1f %d %d", 100*f/t, f, t) }'
}

# ---- gather -----------------------------------------------------------------

WEEKS="$(window_weeks)"
COMMITS="$(commits_in_window)"
COMMITS_PER_WEEK="$(awk -v c="$COMMITS" -v w="$WEEKS" 'BEGIN { printf("%.1f", c/w) }')"
read -r LEAD_MED LEAD_P90 PR_COUNT <<<"$(pr_lead_times)"
# Without gh there is no PR data at all; report null rather than a misleading 0.
have_gh || PR_COUNT="na"
PRS_PER_WEEK="$(awk -v c="$PR_COUNT" -v w="$WEEKS" 'BEGIN { if (c=="na"||c==0){print "na"} else printf("%.1f", c/w) }' 2>/dev/null || echo na)"
[[ "$PR_COUNT" == "0" ]] && PRS_PER_WEEK="na"

REVERTS="$(reverts_in_window)"
FIX_AFTER_FEAT="$(fix_after_feat)"
CHURN="$(churn_pct)"
read -r DRIFT DRIFT_N <<<"$(odd_drift)"
read -r DEFECT_PCT DEFECT_FIX DEFECT_TOTAL DEFECT_SRC <<<"$(defect_ratio)"
read -r SMOKE_PCT SMOKE_FAILS SMOKE_TOTAL <<<"$(smoke_failure_rate)"

if [[ "$EMIT_JSON" -eq 1 ]]; then
  cat <<JSON
{
  "window_since": "$SINCE",
  "generated_from": "$( have_gh && echo 'git+gh' || echo 'git-only' )",
  "speed": {
    "commits": $COMMITS,
    "commits_per_week": $COMMITS_PER_WEEK,
    "prs": $( [[ "$PR_COUNT" == "na" ]] && echo null || echo "$PR_COUNT" ),
    "prs_per_week": $( [[ "$PRS_PER_WEEK" == "na" ]] && echo null || echo "$PRS_PER_WEEK" ),
    "pr_lead_time_hours_median": $( [[ "$LEAD_MED" == "na" ]] && echo null || echo "$LEAD_MED" ),
    "pr_lead_time_hours_p90": $( [[ "$LEAD_P90" == "na" ]] && echo null || echo "$LEAD_P90" )
  },
  "rework": {
    "reverts": $REVERTS,
    "fix_after_feat": $FIX_AFTER_FEAT,
    "churn_pct": $CHURN,
    "churn_window_days": $CHURN_WINDOW_DAYS,
    "odd_forecast_drift_pct": $( [[ "$DRIFT" == "na" ]] && echo null || echo "$DRIFT" ),
    "odd_docs_with_metrics": $DRIFT_N
  },
  "defects": {
    "fix_ratio_pct": $DEFECT_PCT,
    "fix_count": $DEFECT_FIX,
    "total": $DEFECT_TOTAL,
    "fix_ratio_source": "$DEFECT_SRC",
    "smoke_failure_pct": $( [[ "$SMOKE_PCT" == "na" ]] && echo null || echo "$SMOKE_PCT" ),
    "smoke_fails": $( [[ "$SMOKE_FAILS" == "na" ]] && echo null || echo "$SMOKE_FAILS" ),
    "smoke_runs": $( [[ "$SMOKE_TOTAL" == "na" ]] && echo null || echo "$SMOKE_TOTAL" )
  }
}
JSON
  exit 0
fi

bar() { printf '%s\n' "────────────────────────────────────────────"; }
na() { [[ "$1" == "na" ]] && echo "n/a" || echo "$1"; }

bar
echo "Delivery metrics — window: since \"$SINCE\"  (source: git+$( have_gh && echo gh || echo 'git only' ))"
bar
echo "SPEED"
printf "  commits                 %s  (%s/week)\n" "$COMMITS" "$COMMITS_PER_WEEK"
printf "  merged PRs              %s  (%s/week)\n" "$(na "$PR_COUNT")" "$(na "$PRS_PER_WEEK")"
printf "  PR lead time            median %sh · p90 %sh\n" "$(na "$LEAD_MED")" "$(na "$LEAD_P90")"
echo "REWORK"
printf "  reverts                 %s\n" "$REVERTS"
printf "  fix-after-feat (scope)  %s\n" "$FIX_AFTER_FEAT"
printf "  churn (re-touch <%sd)    %s%%\n" "$CHURN_WINDOW_DAYS" "$CHURN"
printf "  ODD forecast drift      %s%s  (%s docs)\n" "$(na "$DRIFT")" "$([[ "$DRIFT" == "na" ]] || echo '%')" "$DRIFT_N"
echo "DEFECTS"
printf "  fix/hotfix ratio        %s%%  (%s/%s, %s) (proxy)\n" "$DEFECT_PCT" "$DEFECT_FIX" "$DEFECT_TOTAL" "$DEFECT_SRC"
printf "  smoke failure rate      %s%s  (%s/%s runs)\n" "$(na "$SMOKE_PCT")" "$([[ "$SMOKE_PCT" == "na" ]] || echo '%')" "$(na "$SMOKE_FAILS")" "$(na "$SMOKE_TOTAL")"
bar

if [[ "$WITH_SUBMODULES" -eq 1 ]]; then
  echo "PER-SUBMODULE (git signal)"
  git config --file .gitmodules --get-regexp path | awk '{print $2}' | while read -r sm; do
    [[ -d "$sm/.git" || -f "$sm/.git" ]] || continue
    c="$(git -C "$sm" log --since="$SINCE" --no-merges --oneline 2>/dev/null | wc -l | tr -d ' ')"
    r="$(git -C "$sm" log --since="$SINCE" --no-merges --format='%s' 2>/dev/null | grep -ciE '^fix(\(|:)' || true)"
    printf "  %-28s commits %-4s fix-commits %s\n" "$sm" "$c" "${r:-0}"
  done
  bar
fi
