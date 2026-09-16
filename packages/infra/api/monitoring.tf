resource "aws_sns_topic" "alarms" {
  name = "${var.project}-alarms"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
  # AWS emails a confirmation link. Nothing arrives until it is clicked.
}

# The alarm that matters most on a new account. Billing metrics only exist in
# us-east-1 and only after "Receive Billing Alerts" is enabled in the billing
# console preferences - README step 0.
resource "aws_cloudwatch_metric_alarm" "billing" {
  alarm_name          = "${var.project}-monthly-bill"
  namespace           = "AWS/Billing"
  metric_name         = "EstimatedCharges"
  dimensions          = { Currency = "USD" }
  statistic           = "Maximum"
  period              = 21600 # 6h - billing updates a few times a day
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.billing_alarm_usd
  alarm_description   = "Estimated monthly charges above $${var.billing_alarm_usd}"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

# The API is returning 500s. TRD 12.2 wants a page; an email is what exists.
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${var.project}-api-5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  dimensions          = { LoadBalancer = aws_lb.api.arn_suffix }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_description   = "More than 5 server errors in 5 minutes"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

# No healthy targets: the API is down, or a deploy is failing.
resource "aws_cloudwatch_metric_alarm" "api_unhealthy" {
  alarm_name  = "${var.project}-api-unhealthy"
  namespace   = "AWS/ApplicationELB"
  metric_name = "HealthyHostCount"
  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_description   = "No healthy API task for 3 minutes"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}
