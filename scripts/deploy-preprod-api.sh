#!/usr/bin/env bash
set -euo pipefail
project=sales-drone-avinya
region=asia-south1
[[ "${GCP_PROJECT_ID:-}" == "$project" && "${GITHUB_SHA:-}" =~ ^[0-9a-f]{40}$ ]]
: "${DYNATRACE_TENANT_URL:?Missing Dynatrace endpoint}"
archive=$(mktemp -d)
trap 'rm -r "$archive"' EXIT
(cd functions && zip -q -r "$archive/source.zip" package.json package-lock.json src)
source="gs://$project-preprod-build/functions/$GITHUB_SHA-$GITHUB_RUN_ATTEMPT.zip"
gcloud storage cp "$archive/source.zip" "$source" --project "$project" --quiet
env_file="$archive/environment.json"
node --input-type=module -e 'import { writeFileSync } from "node:fs"; writeFileSync(process.argv[1], JSON.stringify({FIREBASE_CONFIG:JSON.stringify({projectId:process.env.GCP_PROJECT_ID}),SDR_REGION:"asia-south1",APP_CHECK_MODE:"enforce",DYNATRACE_TENANT_URL:process.env.DYNATRACE_TENANT_URL}));' "$env_file"
gcloud functions deploy preprodApi --gen2 --region "$region" --project "$project" \
  --runtime nodejs22 --trigger-http --entry-point preprodApi --source "$source" \
  --service-account "salesdrone-preprod-runtime@$project.iam.gserviceaccount.com" \
  --build-service-account "projects/$project/serviceAccounts/salesdrone-preprod-build@$project.iam.gserviceaccount.com" \
  --docker-repository "projects/$project/locations/$region/repositories/salesdrone-preprod-ingress" \
  --env-vars-file "$env_file" --set-secrets 'DYNATRACE_API_TOKEN=DYNATRACE_API_TOKEN:latest,PREPROD_CURSOR_SECRET=PREPROD_CURSOR_SECRET:latest' \
  --timeout 120s --memory 512Mi --max-instances 2 --min-instances 0 --quiet
