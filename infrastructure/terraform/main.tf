data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" { state = "available" }
data "aws_ssm_parameter" "ami" { name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64" }
resource "aws_vpc" "main" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = var.name }
}
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.42.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = false
}
resource "aws_internet_gateway" "main" { vpc_id = aws_vpc.main.id }
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}
resource "aws_security_group" "web" {
  name_prefix = "${var.name}-web-"
  description = "TLS and ACME only. No SSH, database or management ingress."
  vpc_id      = aws_vpc.main.id
}
resource "aws_vpc_security_group_ingress_rule" "https" {
  for_each          = var.allowed_web_cidrs
  security_group_id = aws_security_group.web.id
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  description       = "HTTPS application traffic"
}
resource "aws_vpc_security_group_ingress_rule" "http" {
  for_each          = var.allowed_web_cidrs
  security_group_id = aws_security_group.web.id
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  description       = "ACME certificate validation and HTTPS redirects"
}
resource "aws_vpc_security_group_egress_rule" "https" {
  security_group_id = aws_security_group.web.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  description       = "SSM, image downloads, S3 and CloudWatch over TLS"
}
resource "aws_vpc_security_group_egress_rule" "http" {
  security_group_id = aws_security_group.web.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  description       = "Distribution package repositories and ACME"
}
resource "aws_cloudwatch_log_group" "containers" {
  name              = "/${var.name}/containers"
  retention_in_days = 14
}
resource "aws_iam_role" "host" {
  name_prefix        = "${var.name}-host-"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "host" {
  role = aws_iam_role.host.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    # These SSM channel APIs cannot be scoped to resource ARNs.
    { Effect = "Allow", Action = ["ssm:UpdateInstanceInformation", "ssmmessages:CreateControlChannel", "ssmmessages:CreateDataChannel", "ssmmessages:OpenControlChannel", "ssmmessages:OpenDataChannel"], Resource = "*" },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.containers.arn}:*" },
    { Effect = "Allow", Action = ["s3:GetObject"], Resource = "${aws_s3_bucket.releases.arn}/releases/*" }
  ] })
}
resource "aws_iam_instance_profile" "host" { role = aws_iam_role.host.name }
resource "aws_ebs_volume" "data" {
  availability_zone = aws_subnet.public.availability_zone
  size              = var.data_size_gb
  type              = "gp3"
  encrypted         = true
  tags              = { Name = "${var.name}-postgres" }
  lifecycle { prevent_destroy = true }
}
resource "aws_instance" "app" {
  ami                         = data.aws_ssm_parameter.ami.value
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.web.id]
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.host.name
  user_data_replace_on_change = true
  user_data                   = templatefile("${path.module}/user-data.sh.tftpl", { volume_id = replace(aws_ebs_volume.data.id, "-", "") })
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "disabled"
  }
  root_block_device {
    volume_size           = 12
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }
  credit_specification { cpu_credits = "standard" }
  tags       = { Name = var.name }
  depends_on = [aws_route_table_association.public, aws_iam_role_policy.host]
}
resource "aws_volume_attachment" "data" {
  device_name  = "/dev/sdf"
  volume_id    = aws_ebs_volume.data.id
  instance_id  = aws_instance.app.id
  force_detach = false
}
resource "aws_s3_bucket" "releases" {
  bucket_prefix = "${var.name}-${data.aws_caller_identity.current.account_id}-"
  force_destroy = false
}
resource "aws_s3_bucket_public_access_block" "releases" {
  bucket                  = aws_s3_bucket.releases.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "releases" {
  bucket = aws_s3_bucket.releases.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_lifecycle_configuration" "releases" {
  bucket = aws_s3_bucket.releases.id
  rule {
    id     = "expire-old-release-artifacts"
    status = "Enabled"
    filter { prefix = "releases/" }
    expiration { days = 14 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}
resource "aws_s3_bucket_policy" "tls" {
  bucket = aws_s3_bucket.releases.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Deny", Principal = "*", Action = "s3:*", Resource = [aws_s3_bucket.releases.arn, "${aws_s3_bucket.releases.arn}/*"], Condition = { Bool = { "aws:SecureTransport" = "false" } } }] })
}
resource "aws_cloudwatch_metric_alarm" "cpu" {
  alarm_name          = "${var.name}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  dimensions          = { InstanceId = aws_instance.app.id }
  alarm_actions       = var.alarm_sns_topic_arn == null ? [] : [var.alarm_sns_topic_arn]
  treat_missing_data  = "missing"
}
resource "aws_cloudwatch_metric_alarm" "status" {
  alarm_name          = "${var.name}-instance-status"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  dimensions          = { InstanceId = aws_instance.app.id }
  alarm_actions       = var.alarm_sns_topic_arn == null ? [] : [var.alarm_sns_topic_arn]
  treat_missing_data  = "missing"
}
