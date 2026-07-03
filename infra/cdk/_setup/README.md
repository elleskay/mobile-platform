# Platform setup CDK

One-time stack that provisions the AWS side of GitHub Actions OIDC deploys for an app on this platform.

## Use

Run once per AWS account + GitHub repo combo:

```bash
cd infra/cdk/_setup
npm install
npx cdk bootstrap aws://<account>/<region>   # only if account never bootstrapped
npx cdk deploy -c repo=elleskay/<your-app>
```

Outputs `DeployRoleArn`. Copy that into the repo's GitHub Actions secrets as `AWS_DEPLOY_ROLE_ARN`.

After this stack exists, the deploy workflow can assume the role via OIDC. No long-lived access keys needed.

## Prerequisites

You need AWS credentials that can:

- Create an IAM role
- Read the existing OIDC provider (or create one, if missing; see Caveats)
- Run CloudFormation

The simplest path: use the AWS root account or a user with `IAMFullAccess` for this one-time deploy. After the role exists, the role itself takes over via OIDC and you don't need broad credentials again.

## What it creates

- IAM role named `github-actions-<reponame>` (override with `-c roleName=...`)
- Trust policy scoped to your specific GitHub repo via `repo:<owner>/<name>:*`
- Inline policy from `infra/iam/cdk-deploy-policy.json`
- One-hour max session duration

The role is locked to the named repo; another repo on the same OIDC provider can't assume it.

## Caveats

- **OIDC provider must already exist** in the account. AWS only allows one per issuer (`token.actions.githubusercontent.com`). The stack uses `fromOpenIdConnectProviderArn` rather than creating it, which assumes it's there. `scripts/connect.sh` creates it when missing; to do it by hand on a fresh account:

  ```bash
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 1c58a3a8518e8759bf075b76b750d4f2df264fcd
  ```

  (AWS has ignored the thumbprint for GitHub's OIDC issuer since 2023, but the API still requires one.) Then run this stack.

- **The role's policy is `cdk-deploy` from `infra/iam/cdk-deploy-policy.json`**, which is permissive on the services the stack uses (`lambda:*`, `apigateway:*`, `sqs:*`, `es:*`, `s3:*`). Fine for portfolio scale; tighten resource ARNs for production.

## Updating the policy later

Edit `infra/iam/cdk-deploy-policy.json` and redeploy this stack. CloudFormation updates the role's inline policy in place. The role ARN stays the same so no GitHub secret needs to change.

## Tearing down

```bash
cd infra/cdk/_setup
npx cdk destroy -c repo=elleskay/<your-app>
```

Removes the role. The OIDC provider is left alone (other apps might depend on it).
