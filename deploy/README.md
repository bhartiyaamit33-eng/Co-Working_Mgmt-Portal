# Public demo (AWS EC2)

Testers open **one URL**. Nginx serves the React app and proxies `/api` to FastAPI. MongoDB stays on the instance (not exposed).

## After AWS login

From the repo root:

```bash
aws login          # or: aws configure
chmod +x scripts/aws-demo-up.sh scripts/aws-demo-down.sh
./scripts/aws-demo-up.sh
```

Default region is `ap-south-1` (Mumbai). Override with `AWS_REGION=us-east-1`.

The script prints a public `http://<ip>/` link. **From the IIT Bombay campus network, share the CloudFront HTTPS URL instead** (`https://<id>.cloudfront.net/`) — campus proxy blocks direct SSH/HTTP to EC2 public IPs.

Testers must use an `@iitb.ac.in` or `@iitbombay.org` email.

Tear down when you are done (avoids ongoing EC2 charges):

```bash
./scripts/aws-demo-down.sh
```

## Local preview of the same stack

```bash
export JWT_SECRET=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
docker compose -f docker-compose.prod.yml up --build
```

Then open http://localhost/
