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

## 4. Connect GitHub and AWS (one command)

Run the connect script once per repo. It (or your AI coding agent) ensures the
OIDC provider, deploys the `_setup` deploy role, provisions a database (Neon),
generates `JWT_SECRET`, and sets every GitHub Actions secret and variable the
API deploy workflow needs.

```bash
npm run setup
# preview without changing anything: scripts/connect.sh --dry-run
```

Prerequisites: `gh` (authenticated), `aws` (credentials allowed to create an
IAM role + OIDC provider and to bootstrap CDK), Node 20+. Optional: `neonctl`
to auto-provision the database. The AWS/GitHub half is fully automated.

It sets the **secrets** `AWS_DEPLOY_ROLE_ARN`, `DATABASE_URL`, `JWT_SECRET`
(and `EXPO_TOKEN`, `CLASSIFIER_API_KEY` if you pass them) and the **variables**
`AWS_REGION`, `JWT_ISSUER`, `ENABLE_OPENSEARCH` (plus `CDK_DIR`/`API_DIR`/
`CLASSIFIER_API_URL` if non-default).

## 5. Link EAS (one-time, interactive)

EAS login and store credentials are interactive by design, so finish the mobile
side by hand (the script prints these steps too):

```bash
npm i -g eas-cli && eas login
cd apps/app && eas init        # links the project
eas credentials                # iOS/Android signing, when you build
```

`eas.json` (build + submit profiles) already ships in `apps/_template`. To run
EAS builds from CI, set an `EXPO_TOKEN` secret (the connect script can do this
if you pass `--expo-token`). Full mobile setup: `docs/MOBILE.md`.

<details>
<summary>Prefer to do the AWS/GitHub side by hand?</summary>

```bash
cd infra/cdk/_setup
npm install
npx cdk deploy -c repo=<owner>/my-app   # copy the DeployRoleArn output
```

Then set the secrets/variables above manually (`gh secret set` / `gh variable set`).
</details>

## 6. Push

Push to `main`. The API deploy workflow assumes the role via OIDC, builds, runs
`cdk deploy`, and smoke-tests. Set `EXPO_PUBLIC_API_URL` for the app to the
`ApiUrl` output, then build the app via the mobile workflow.

Mobile-specific setup (EAS, credentials, native extensions): `docs/MOBILE.md`.
Deploy details and gotchas: `docs/DEPLOY.md`.
