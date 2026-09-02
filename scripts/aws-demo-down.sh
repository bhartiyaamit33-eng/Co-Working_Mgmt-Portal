#!/usr/bin/env bash
# Terminate the DSSE demo EC2 instance created by aws-demo-up.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
NAME="${DSSE_DEMO_NAME:-dsse-booking-demo}"

IDS="$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Name,Values=$NAME" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
  --query 'Reservations[].Instances[].InstanceId' --output text)"

if [[ -z "$IDS" ]]; then
  echo "No demo instances found in $REGION"
  exit 0
fi

echo "Terminating: $IDS"
aws ec2 terminate-instances --region "$REGION" --instance-ids $IDS >/dev/null
echo "Done. Security group, key pair, and CloudFront (if any) are left in place."
if [[ -f "$ROOT/deploy/.last-cloudfront-id" ]]; then
  echo "Disable the demo CloudFront distro in the AWS console when finished: $(cat "$ROOT/deploy/.last-cloudfront-id")"
fi
rm -f "$ROOT/deploy/.last-public-ip" "$ROOT/deploy/.last-instance-id"
