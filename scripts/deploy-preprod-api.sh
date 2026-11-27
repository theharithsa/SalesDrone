#!/usr/bin/env bash
set -euo pipefail
project=sales-drone-avinya
region=asia-south1
[[ "${GCP_PROJECT_ID:-}" == "$project" && "${GITHUB_SHA:-}" =~ ^[0-9a-f]{40}$ &&
  "${GITHUB_RUN_ID:-}" =~ ^[1-9][0-9]*$ && "${GITHUB_RUN_ATTEMPT:-}" =~ ^[1-9][0-9]*$ ]]
: "${DYNATRACE_TENANT_URL:?Missing Dynatrace endpoint}"
archive=$(mktemp -d)
trap 'rm -r "$archive"' EXIT
(cd functions && zip -q -r "$archive/source.zip" package.json package-lock.json src)
source="gs://$project-preprod-build/functions/$GITHUB_SHA-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT.zip"
gcloud storage cp "$archive/source.zip" "$source" --project "$project" --quiet
env_file="$archive/environment.json"
node --input-type=module -e 'import { writeFileSync } from "node:fs"; writeFileSync(process.argv[1], JSON.stringify({FIREBASE_CONFIG:JSON.stringify({projectId:process.env.GCP_PROJECT_ID}),SDR_REGION:"asia-south1",APP_CHECK_MODE:"enforce",DYNATRACE_TENANT_URL:process.env.DYNATRACE_TENANT_URL,SDR_EMAIL_ENABLED:process.env.PREPROD_EMAIL_ENABLED==="true"?"true":"false",...(process.env.PREPROD_EMAIL_BETA_ENABLED==="true"?{SDR_EMAIL_BETA_ENABLED:"true",SDR_EMAIL_BETA_ADDRESS:process.env.PREPROD_EMAIL_BETA_ADDRESS,SDR_EMAIL_BETA_TEST_INBOX:process.env.PREPROD_EMAIL_BETA_TEST_INBOX}:{})}));' "$env_file"
runtime_account="salesdrone-preprod-runtime@$project.iam.gserviceaccount.com"
secrets='DYNATRACE_API_TOKEN=DYNATRACE_API_TOKEN:latest,PREPROD_CURSOR_SECRET=PREPROD_CURSOR_SECRET:latest'
if [[ "${PREPROD_EMAIL_ENABLED:-}" == true ]]; then
  secrets+=',SDR_RESEND_API_KEY=PREPROD_RESEND_API_KEY:latest,SDR_RESEND_WEBHOOK_SECRET=PREPROD_RESEND_WEBHOOK_SECRET:latest'
fi
deploy_args=(--gen2 --region "$region" --project "$project" --runtime nodejs22 --trigger-http --source "$source"
  --service-account "$runtime_account"
  --build-service-account "projects/$project/serviceAccounts/salesdrone-preprod-build@$project.iam.gserviceaccount.com" \
  --docker-repository "projects/$project/locations/$region/repositories/salesdrone-preprod-ingress" \
  --env-vars-file "$env_file" --set-secrets "$secrets" --timeout 120s --min-instances 0 --quiet)
gcloud functions deploy preprodApi "${deploy_args[@]}" \
  --allow-unauthenticated --entry-point preprodApi --memory 512Mi --max-instances 2
worker_identity=(preprodEmail --gen2 --project "$project" --region "$region" --quiet)
worker_exists=false
if gcloud functions describe "${worker_identity[@]}" --format='value(name)' >/dev/null 2>&1; then
  worker_exists=true
fi
if [[ "${PREPROD_EMAIL_ENABLED:-}" == true || "${PREPROD_EMAIL_BETA_ENABLED:-}" == true || "$worker_exists" == true ]]; then
  worker_args=(--entry-point preprodEmail --memory 256Mi --max-instances 1 --concurrency 1)
  # Private on creation. Updates keep the scheduler's invocation policy intact.
  if [[ "$worker_exists" == false ]]; then
    worker_args+=(--no-allow-unauthenticated)
  fi
  gcloud functions deploy preprodEmail "${deploy_args[@]}" "${worker_args[@]}"
  worker_url=$(gcloud functions describe "${worker_identity[@]}" --format='value(serviceConfig.uri)')
  [[ "$worker_url" =~ ^https://preprodemail-[a-z0-9-]+\.a\.run\.app$ ]]
  status=$(curl --silent --show-error --connect-timeout 5 --max-time 15 --output /dev/null --write-out '%{http_code}' "$worker_url")
  if [[ "$status" != 401 && "$status" != 403 ]]; then
    echo 'Pre-production email worker did not deny unauthenticated access.' >&2
    exit 1
  fi
fi
