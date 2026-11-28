#!/usr/bin/env bash
set -euo pipefail
project=sales-drone-avinya
region=asia-south1
job=salesdrone-preprod-email
runtime="salesdrone-preprod-runtime@$project.iam.gserviceaccount.com"
scope=(--project "$project" --location "$region" --quiet)
if [[ "$#" -ne 1 || ( "$1" != configure && "$1" != pause ) ]]; then
  echo 'Usage: scripts/preprod-email-schedule.sh configure|pause' >&2
  exit 2
fi
if [[ "$1" == pause ]]; then
  gcloud scheduler jobs pause "$job" "${scope[@]}"
  exit
fi
function_identity=$(gcloud functions describe preprodEmail --gen2 --project "$project" \
  --region "$region" --format='csv[no-heading](serviceConfig.service,serviceConfig.uri,serviceConfig.environmentVariables.SDR_EMAIL_ENABLED)')
IFS=, read -r service uri enabled <<< "$function_identity"
[[ "$service" == "projects/$project/locations/$region/services/preprodemail" && "$uri" == https://preprodemail-*.run.app && "$enabled" == true ]]
gcloud run services add-iam-policy-binding preprodemail --project "$project" --region "$region" \
  --member "serviceAccount:$runtime" --role roles/run.invoker --quiet >/dev/null
options=( "$job" "${scope[@]}" --schedule '*/5 * * * *' --time-zone Etc/UTC --uri "$uri"
  --http-method POST --oidc-service-account-email "$runtime" --oidc-token-audience "$uri"
  --attempt-deadline 120s --max-retry-attempts 0 )
if gcloud scheduler jobs describe "$job" "${scope[@]}" --format='value(name)' >/dev/null 2>&1; then
  gcloud scheduler jobs update http "${options[@]}" >/dev/null
else
  gcloud scheduler jobs create http "${options[@]}" >/dev/null
fi
if [[ $(gcloud scheduler jobs describe "$job" "${scope[@]}" --format='value(state)') == PAUSED ]]; then
  gcloud scheduler jobs resume "$job" "${scope[@]}" >/dev/null
fi
echo 'Pre-production email schedule points to the private pre-production worker.'
