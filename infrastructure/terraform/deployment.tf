# Explicit opt-in only. Configure a protected "aws-production" GitHub environment first.
resource "aws_iam_role" "deploy" {
  count       = var.github_oidc_provider_arn == null ? 0 : 1
  name_prefix = "${var.name}-deploy-"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect    = "Allow", Principal = { Federated = var.github_oidc_provider_arn }, Action = "sts:AssumeRoleWithWebIdentity",
    Condition = { StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com", "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:aws-production" } }
  }] })
}
resource "aws_iam_role_policy" "deploy" {
  count = var.github_oidc_provider_arn == null ? 0 : 1
  role  = aws_iam_role.deploy[0].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["s3:PutObject", "s3:AbortMultipartUpload"], Resource = "${aws_s3_bucket.releases.arn}/releases/*" },
    { Effect = "Allow", Action = ["ssm:SendCommand"], Resource = [aws_instance.app.arn, "arn:aws:ssm:${var.region}::document/AWS-RunShellScript"] },
    # GetCommandInvocation has no resource-level permissions.
    { Effect = "Allow", Action = ["ssm:GetCommandInvocation"], Resource = "*" }
  ] })
}
