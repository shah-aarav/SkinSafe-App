param(
  [string]$Ip,
  [int]$Port = 4176
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not (Test-Path (Join-Path $projectRoot 'dist/index.html'))) {
  throw 'Build the app first with npm run build.'
}

if (-not $Ip) {
  $routes = @(Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' |
    Sort-Object RouteMetric, InterfaceMetric)
  foreach ($route in $routes) {
    $address = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -notlike '127.*' } |
      Select-Object -First 1
    if ($address) { $Ip = $address.IPAddress; break }
  }
}

$parsed = $null
if (-not [System.Net.IPAddress]::TryParse($Ip, [ref]$parsed) -or
    $parsed.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or
    $Ip -like '127.*') {
  throw 'No LAN IPv4 address found. Connect to Wi-Fi, or pass -Ip with this PC’s Wi-Fi address.'
}
$ownedAddress = Get-NetIPAddress -AddressFamily IPv4 -IPAddress $Ip -ErrorAction SilentlyContinue
if (-not $ownedAddress) { throw "$Ip is not assigned to this PC." }
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Choose a port from 1024 to 65535.' }

$env:SKINCHECK_BIND_HOST = $Ip
$env:PORT = [string]$Port
Write-Host "Open http://${Ip}:${Port}/ in Safari on your iPhone (same Wi-Fi)."
Write-Warning 'This local HTTP connection is not encrypted. Use test accounts and non-sensitive photos only.'
Write-Host 'Keep this window open while using the app. If Windows asks about firewall access, allow Private networks only.'
Set-Location $projectRoot
node server.mjs
