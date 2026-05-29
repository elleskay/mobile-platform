# Setup

From a fresh clone to a deployable app. The app ships via EAS; the API ships via
GitHub Actions + CDK.

## 1. Create your repo

```bash
gh repo create my-app --template elleskay/mobile-platform --clone --private
cd my-app
npm install
```

## 2. Create the app and API from the templates

```bash
# App: copy the demo, then overlay native references from apps/_template
cp -r apps/_demo apps/app
# API: copy the service template (becomes the services/api workspace)
cp -r services/_template services/api
```

Edit `apps/app/app.json` (or add `app.config.ts` from `apps/_template`) with your
real bundle ids and EAS project id. Edit `services/api/package.json` name.

## 3. Rename the CDK package

```bash
git mv infra/cdk/_template infra/cdk/my-app
# Edit infra/cdk/my-app/bin/app.ts: rename the stack id (e.g. MyAppApi)
```

## 4. Provision the deploy role (one time per AWS account + repo)

```bash
cd infra/cdk/_setup
npm install
npx cdk deploy -c repo=<owner>/my-app
# Copy the DeployRoleArn output.
```

## 5. Configure GitHub

Secrets:
- `AWS_DEPLOY_ROLE_ARN` (from step 4)
- `DATABASE_URL`, `JWT_SECRET`, `CLASSIFIER_API_KEY` (as needed)
- `EXPO_TOKEN` (for the mobile build workflow)

Variables:
- `AWS_REGION` (e.g. `ap-southeast-1`)
- `API_DIR` = `services/api`, `APP_DIR` = `apps/app`, `CDK_DIR` = `infra/cdk/my-app`
- `JWT_ISSUER`, `CLASSIFIER_API_URL`, `ENABLE_OPENSEARCH` (optional)

## 6. Push

Push to `main`. The API deploy workflow assumes the role via OIDC, builds, runs
`cdk deploy`, and smoke-tests. Set `EXPO_PUBLIC_API_URL` for the app to the
`ApiUrl` output, then build the app via the mobile workflow.

Mobile-specific setup (EAS, credentials, native extensions): `docs/MOBILE.md`.
Deploy details and gotchas: `docs/DEPLOY.md`.
