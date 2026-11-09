variable "region" {
  type    = string
  default = "us-east-1"
}
variable "name" {
  type    = string
  default = "opsatlas"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,24}$", var.name))
    error_message = "Name must be 3–25 lowercase letters, numbers or hyphens."
  }
}
variable "instance_type" {
  type    = string
  default = "t3.small"
  validation {
    condition     = contains(["t3.small", "t3.medium"], var.instance_type)
    error_message = "Use an x86 t3.small or t3.medium; review costs before increasing capacity."
  }
}
variable "allowed_web_cidrs" {
  type        = set(string)
  default     = ["0.0.0.0/0"]
  description = "HTTP/HTTPS ingress only; narrow this set for a private demo."
  validation {
    condition     = alltrue([for cidr in var.allowed_web_cidrs : can(cidrnetmask(cidr))])
    error_message = "Use IPv4 CIDR ranges."
  }
}
variable "data_size_gb" {
  type    = number
  default = 20
  validation {
    condition     = var.data_size_gb >= 20 && var.data_size_gb <= 100 && floor(var.data_size_gb) == var.data_size_gb
    error_message = "Use 20–100 GiB of data storage; review costs before increasing."
  }
}
variable "github_oidc_provider_arn" {
  type        = string
  default     = null
  description = "Existing GitHub OIDC provider ARN. Null omits the deployment role. No GitHub connection is created."
}
variable "github_repository" {
  type        = string
  default     = "elilovescoding/opsatlas"
  description = "Intended repository; used only if OIDC deployment is explicitly enabled later."
  validation {
    condition     = can(regex("^elilovescoding/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Portfolio deployment must be scoped to elilovescoding's repository."
  }
}
variable "alarm_sns_topic_arn" {
  type        = string
  default     = null
  description = "Optional existing SNS topic. Without it, alarms have no notification action."
}
