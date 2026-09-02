#!/usr/bin/env bash
# Launch a public AWS demo of the DSSE booking portal (one EC2 + Docker).
# Requires: aws CLI logged in (`aws login` or `aws configure`), Docker is optional
# (images are built on the instance).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
NAME="${DSSE_DEMO_NAME:-dsse-booking-demo}"
INSTANCE_TYPE="${DSSE_INSTANCE_TYPE:-t3.medium}"
KEY_NAME="${DSSE_KEY_NAME:-${NAME}-key}"
KEY_FILE="${DSSE_KEY_FILE:-$HOME/.ssh/${KEY_NAME}.pem}"

echo "Using region: $REGION"

IDENT="$(aws sts get-caller-identity --region "$REGION" --output json)"
ACCOUNT="$(echo "$IDENT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["Account"])')"
echo "AWS account: $ACCOUNT"

MY_IP="$(curl -sf https://checkip.amazonaws.com | tr -d '[:space:]')"
if [[ -z "$MY_IP" ]]; then
  echo "Could not detect your public IP for SSH allowlisting." >&2
  exit 1
fi
echo "SSH will be allowed from ${MY_IP}/32"

AMI_ID="$(aws ssm get-parameter \
  --region "$REGION" \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query Parameter.Value --output text)"
echo "AMI: $AMI_ID"

if ! aws ec2 describe-key-pairs --region "$REGION" --key-names "$KEY_NAME" >/dev/null 2>&1; then
  mkdir -p "$(dirname "$KEY_FILE")"
  aws ec2 create-key-pair --region "$REGION" --key-name "$KEY_NAME" \
    --query 'KeyMaterial' --output text > "$KEY_FILE"
  chmod 400 "$KEY_FILE"
  echo "Created key pair $KEY_NAME → $KEY_FILE"
else
  if [[ ! -f "$KEY_FILE" ]]; then
    echo "Key pair $KEY_NAME exists in AWS but $KEY_FILE is missing. Set DSSE_KEY_FILE to the pem path." >&2
    exit 1
  fi
fi

SG_ID="$(aws ec2 describe-security-groups --region "$REGION" \
  --filters "Name=group-name,Values=${NAME}-sg" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"
if [[ -z "$SG_ID" || "$SG_ID" == "None" ]]; then
  VPC_ID="$(aws ec2 describe-vpcs --region "$REGION" --filters Name=isDefault,Values=true \
    --query 'Vpcs[0].VpcId' --output text)"
  SG_ID="$(aws ec2 create-security-group --region "$REGION" \
    --group-name "${NAME}-sg" \
    --description "DSSE booking demo HTTP + SSH from operator IP" \
    --vpc-id "$VPC_ID" \
    --query GroupId --output text)"
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
    --protocol tcp --port 80 --cidr 0.0.0.0/0 >/dev/null
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
    --protocol tcp --port 22 --cidr "${MY_IP}/32" >/dev/null
  echo "Created security group $SG_ID"
else
  echo "Reusing security group $SG_ID"
fi

EXISTING="$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Name,Values=$NAME" "Name=instance-state-name,Values=pending,running" \
  --query 'Reservations[].Instances[].InstanceId' --output text)"
if [[ -n "$EXISTING" ]]; then
  INSTANCE_ID="$(echo "$EXISTING" | awk '{print $1}')"
  echo "Reusing running instance $INSTANCE_ID"
else
  USER_DATA="$(cat <<'UD'
#!/bin/bash
set -eux
dnf update -y
dnf install -y docker git rsync
systemctl enable --now docker
usermod -aG docker ec2-user
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
if [[ ! -f /swapfile ]]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
fi
swapon /swapfile || true
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
touch /opt/dsse-docker-ready
UD
)"
  INSTANCE_ID="$(aws ec2 run-instances --region "$REGION" \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --user-data "$USER_DATA" \
    --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":20,"VolumeType":"gp3","Encrypted":true,"DeleteOnTermination":true}}]' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME},{Key=Project,Value=dsse-booking}]" \
    --query 'Instances[0].InstanceId' --output text)"
  echo "Launched $INSTANCE_ID"
fi

aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"
PUBLIC_IP="$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"
echo "Public IP: $PUBLIC_IP"

SSH=(ssh -i "$KEY_FILE" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "ec2-user@${PUBLIC_IP}")
echo "Waiting for SSH…"
for _ in $(seq 1 60); do
  if "${SSH[@]}" "echo ok" >/dev/null 2>&1; then
    break
  fi
  sleep 5
done
"${SSH[@]}" "echo ssh-ready"

echo "Waiting for Docker on the instance…"
for _ in $(seq 1 60); do
  if "${SSH[@]}" "test -f /opt/dsse-docker-ready && docker info >/dev/null 2>&1"; then
    break
  fi
  sleep 5
done
"${SSH[@]}" "docker info >/dev/null"

REMOTE_DIR="/home/ec2-user/dsse"
JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@123}"

echo "Copying application files…"
"${SSH[@]}" "mkdir -p $REMOTE_DIR"
rsync -az --delete \
  --exclude node_modules --exclude .venv --exclude .git --exclude frontend/build \
  --exclude '*.pyc' --exclude __pycache__ --exclude .pytest_cache \
  -e "ssh -i $KEY_FILE -o StrictHostKeyChecking=accept-new" \
  "$ROOT/" "ec2-user@${PUBLIC_IP}:${REMOTE_DIR}/"

"${SSH[@]}" "cat > ${REMOTE_DIR}/.env <<EOF
JWT_SECRET=${JWT_SECRET}
DB_NAME=coworking
ADMIN_EMAIL=ideas.iitb@gmail.com
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_SYNC_ON_START=true
MEMBER_EMAIL_DOMAIN=iitb.ac.in
CORS_ORIGINS=http://${PUBLIC_IP},http://localhost
EOF"

echo "Building and starting containers (first time takes several minutes)…"
"${SSH[@]}" "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml up --build -d"

echo "Waiting for http://${PUBLIC_IP}/health …"
for _ in $(seq 1 60); do
  if curl -sf "http://${PUBLIC_IP}/health" >/dev/null; then
    break
  fi
  sleep 5
done

echo
echo "Share this link with testers:"
echo "  http://${PUBLIC_IP}/"
echo
echo "Admin login: ideas.iitb@gmail.com"
echo "Admin password: ${ADMIN_PASSWORD}"
echo "Team testers must use an @iitb.ac.in email."
echo
echo "Stop/delete later: AWS_REGION=$REGION $ROOT/scripts/aws-demo-down.sh"
echo "$PUBLIC_IP" > "$ROOT/deploy/.last-public-ip"
echo "$INSTANCE_ID" > "$ROOT/deploy/.last-instance-id"
