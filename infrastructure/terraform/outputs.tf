output "instance_id" { value = aws_instance.app.id }
output "public_ip" { value = aws_instance.app.public_ip }
output "release_bucket" { value = aws_s3_bucket.releases.id }
output "log_group" { value = aws_cloudwatch_log_group.containers.name }
output "deployment_role_arn" { value = try(aws_iam_role.deploy[0].arn, null) }
output "data_volume_id" { value = aws_ebs_volume.data.id }
output "ssm_command" { value = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.region}" }
