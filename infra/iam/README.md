# infra/iam

`cdk-deploy-policy.json` is the least-privilege baseline for the GitHub Actions
deploy role. Use it instead of `AdministratorAccess`.

It grants what the `NestjsApi` stack needs: CloudFormation, STS assume of the
CDK bootstrap roles, Lambda, API Gateway, SQS, OpenSearch (`es`), S3 (CDK assets
and report attachments), scoped `iam:PassRole` to `lambda.amazonaws.com` and
`es.amazonaws.com`, SSM (CDK context), and ECR read (bootstrap assets).

The one-time `infra/cdk/_setup` stack attaches this policy to the OIDC role it
creates. If you add a service to the stack (for example RDS or Secrets Manager),
add the matching actions here and redeploy `_setup`.
