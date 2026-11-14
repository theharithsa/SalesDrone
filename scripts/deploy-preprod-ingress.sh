#!/usr/bin/env bash
set -euo pipefail
project=sales-drone-avinya
region=asia-south1
service=salesdrone-preprod-ingress
[[ "${GCP_PROJECT_ID:-}" == "$project" && "${GITHUB_SHA:-}" =~ ^[0-9a-f]{40}$ ]]
upstream=$(gcloud functions describe preprodApi --gen2 --region "$region" --project "$project" --format='value(serviceConfig.uri)')
[[ "$upstream" =~ ^https://preprodapi-[a-z0-9-]+\.a\.run\.app$ ]]
image="$region-docker.pkg.dev/$project/$service/api:$GITHUB_SHA"
if ! gcloud artifacts docker images describe "$image" --project "$project" --quiet >/dev/null 2>&1; then
  gcloud builds submit . --project "$project" --region "$region" \
    --config services/ingress/cloudbuild.yaml --substitutions "_IMAGE=$image" \
    --service-account "projects/$project/serviceAccounts/salesdrone-preprod-build@$project.iam.gserviceaccount.com" \
    --gcs-source-staging-dir "gs://$project-preprod-build/source" --suppress-logs --quiet
fi
gcloud run deploy "$service" --project "$project" --region "$region" --image "$image" \
  --service-account "salesdrone-preprod-ingress@$project.iam.gserviceaccount.com" \
  --set-env-vars "API_UPSTREAM=$upstream,SALESDRONE_ENVIRONMENT=pre-production,DYNATRACE_TENANT_URL=$DYNATRACE_TENANT_URL" \
  --set-secrets DYNATRACE_API_TOKEN=DYNATRACE_API_TOKEN:latest \
  --cpu 1 --memory 1Gi --concurrency 2 --min-instances 0 --max-instances 2 \
  --timeout 75s --cpu-throttling --quiet
