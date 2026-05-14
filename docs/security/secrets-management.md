# Secrets Management Rules

## Scope
This project uses local environment files for development and must keep secrets out of source control.

## Rules

1. Never commit live credentials to git.
2. Commit only template files named .env.example.
3. Keep local secrets in .env files, which are ignored by git.
4. Rotate any leaked credential immediately.
5. Do not paste secrets into issues, pull requests, or logs.

## Local Setup

1. Copy each .env.example file to .env.
2. Replace placeholder values with local credentials.
3. Keep production credentials in a managed secret store when deployed.

## Incident Response

1. Revoke exposed secrets.
2. Regenerate secrets.
3. Update environment and restart affected services.
4. Record incident details and corrective actions.
