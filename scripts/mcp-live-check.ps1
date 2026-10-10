# Live acceptance check for A12: does a real WorkBuddy session call the campusbiz MCP tool?
# Needs: signed-in `codebuddy`, network access to WorkBuddy. Costs a little model quota.
# Expected output: a TOOL_USE line for mcp__campusbiz__calculate_finance and RESULT with 300 / 14.
Set-Location (Join-Path $PSScriptRoot "..")
$tmp = Join-Path $env:TEMP "campusbiz-mcp-live"
New-Item -ItemType Directory -Force $tmp | Out-Null
$settings = Join-Path $tmp "settings.json"
Set-Content -Path $settings -Value '{"enableAllProjectMcpServers": true}' -Encoding ascii
$prompt = "Use the calculate_finance tool with sellingPriceSen=500, variableCostPerUnitSen=200, monthlyFixedCostsSen=10000, targetMonthlyProfitSen=80000, dailyCapacityUnits=40, operatingDaysPerMonth=22, startingCapitalSen=30000. Do not do any arithmetic yourself. Reply with only: requiredMonthlyUnits=<n> requiredDailyUnits=<n>"
$out = Join-Path $tmp "out.jsonl"
$prompt | codebuddy -p --mcp-config ".mcp.json" --tools "" --allowedTools "mcp__campusbiz__calculate_finance" --settings $settings --output-format stream-json --verbose --no-session-persistence --max-turns 5 *> $out
$text = (Get-Content $out -Raw).TrimStart([char]0xFEFF)
foreach ($l in ($text -split "`r?`n" | Where-Object { $_.Trim().StartsWith("{") })) {
  try { $o = $l | ConvertFrom-Json } catch { continue }
  if ($o.type -eq "system" -and $o.mcp_servers) { "MCP: " + ($o.mcp_servers | ConvertTo-Json -Compress) }
  if ($o.type -eq "assistant") { foreach ($c in $o.message.content) {
    if ($c.type -eq "tool_use") { "TOOL_USE: $($c.name) $($c.input | ConvertTo-Json -Compress)" }
    elseif ($c.type -eq "text") { "TEXT: $($c.text)" } } }
  if ($o.type -eq "result") { "RESULT: is_error=$($o.is_error) $($o.result)" }
}
