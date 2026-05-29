import * as path from "path";
import * as fs from "fs";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface SetupStackProps extends cdk.StackProps {
  /** GitHub repo to grant deploy access to, format `<owner>/<name>`. */
  readonly repo: string;
  /** Name for the IAM role created (default: `github-actions-<reponame>`). */
  readonly roleName: string;
}

/**
 * One-time setup stack. Provisions:
 *  - GitHub OIDC identity provider (only if not already in the account)
 *  - IAM role trusted by GitHub Actions for the given repo
 *  - Inline policy from infra/iam/cdk-deploy-policy.json attached to the role
 *
 * Run once per AWS account + GitHub repo:
 *
 *   cd infra/cdk/_setup
 *   npm install
 *   npx cdk deploy -c repo=elleskay/<your-app>
 *
 * Outputs the role ARN. Copy that into the repo's GitHub Actions secrets as
 * AWS_DEPLOY_ROLE_ARN. After this stack exists, the deploy workflow can OIDC-
 * assume into AWS with zero stored credentials.
 */
export class SetupStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SetupStackProps) {
    super(scope, id, props);

    // Reuse the existing provider if there's already one in this account.
    // GitHub Actions OIDC is a singleton per account; deploying a second
    // provider for the same issuer fails.
    const providerArn = `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`;
    const oidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      "GitHubOidc",
      providerArn,
    );

    const policyPath = path.resolve(__dirname, "..", "..", "..", "iam", "cdk-deploy-policy.json");
    const policyDoc = iam.PolicyDocument.fromJson(
      JSON.parse(fs.readFileSync(policyPath, "utf-8")),
    );

    const role = new iam.Role(this, "DeployRole", {
      roleName: props.roleName,
      description: `GitHub Actions OIDC deploy role for ${props.repo}`,
      assumedBy: new iam.WebIdentityPrincipal(oidcProvider.openIdConnectProviderArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        },
        StringLike: {
          "token.actions.githubusercontent.com:sub": `repo:${props.repo}:*`,
        },
      }),
      inlinePolicies: {
        "cdk-deploy": policyDoc,
      },
      maxSessionDuration: cdk.Duration.hours(1),
    });

    new cdk.CfnOutput(this, "DeployRoleArn", {
      value: role.roleArn,
      description: "Copy this into GitHub Actions secrets as AWS_DEPLOY_ROLE_ARN.",
    });

    new cdk.CfnOutput(this, "Repo", {
      value: props.repo,
      description: "GitHub repo this role trusts.",
    });
  }
}
