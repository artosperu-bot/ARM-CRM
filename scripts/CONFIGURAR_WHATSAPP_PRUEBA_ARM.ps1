# STECH ARM-CRM sandbox WhatsApp configuration for PC020.
# No changes to legacy backend, other services, Meta app or Cloudflare tunnel.
$ErrorActionPreference = 'Stop'
$project = 'C:\DESAROLLO\ARM-CRM'
$path = Join-Path $project '.env.local'
if (!(Test-Path $path)) { throw 'No se encontro ARM-CRM\.env.local' }
Write-Host '== STECH | Configuracion segura de WhatsApp de prueba ==' -ForegroundColor Cyan
$secure = Read-Host 'App Secret de la app Wp_Test_N8N_001 (oculto al escribir)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $appSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
if ($appSecret -notmatch '^[A-Fa-f0-9]{32}$') { throw 'App Secret invalido: deben ser 32 caracteres hexadecimales.' }
$recipient = (Read-Host 'Tu celular PERSONAL ya autorizado en Meta (ejemplo +51 9XXXXXXXX)').Trim() -replace '[^0-9]', ''
if ($recipient -match '^9[0-9]{8}$') { $recipient = '51'+$recipient }
if ($recipient -notmatch '^519[0-9]{8}$') { throw 'Solo se acepta un celular peruano: 51 + 9 digitos.' }
$simulation = (Read-Host 'Usar precios/stock ficticios de Supabase SOLO para este numero? [S/N]').Trim().ToUpperInvariant()
if ($simulation -notin @('S','N')) { throw 'Elige S o N.' }
$simFlag = if ($simulation -eq 'S') { 'enabled' } else { 'disabled' }
Write-Host 'Solo ese celular recibira respuestas del agente; no otros clientes.' -ForegroundColor Yellow
$approve = (Read-Host 'Para activar el envio SOLO a tu celular escribe ACTIVAR').Trim()
if ($approve -cne 'ACTIVAR') { throw 'No se activo el envio.' }
$existing = @(Get-Content -LiteralPath $path -Encoding UTF8)
$keys = @('ARM_META_APP_SECRET','ARM_WHATSAPP_TEST_NUMBERS','ARM_WHATSAPP_AUTO_REPLY','ARM_WHATSAPP_TEST_OFFERS')
$unchanged = @($existing | Where-Object {
  $line = $_
  -not ($keys | Where-Object { $line -match ('^\s*' + [regex]::Escape($_) + '\s*=') })
})
$append = @(
  ('ARM_META_APP_SECRET='+$appSecret),
  ('ARM_WHATSAPP_TEST_NUMBERS='+$recipient),
  'ARM_WHATSAPP_AUTO_REPLY=enabled',
  ('ARM_WHATSAPP_TEST_OFFERS='+$simFlag)
)
$utf8 = New-Object System.Text.UTF8Encoding($false)
$all = [string[]]($unchanged+$append)
[System.IO.File]::WriteAllText($path,([string]::Join([Environment]::NewLine,$all)+[Environment]::NewLine),$utf8)
$appSecret = $null
$recipient = $null
Write-Host 'Configuracion privada guardada sin mostrar secretos.' -ForegroundColor Green
$active = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
if ($active.Count -gt 0) {
  if ($active.Count -ne 1) { throw 'Hay varios procesos en puerto 3000, cancelado.' }
  $pidToStop = $active[0].OwningProcess
  $proc = Get-CimInstance Win32_Process -Filter ("ProcessId="+$pidToStop)
  if ($proc.Name -ne 'node.exe' -or $proc.CommandLine -notmatch 'server/whatsapp-gateway.mjs') {
    throw 'El puerto 3000 no pertenece al gateway nuevo, no se detuvo.'
  }
  Stop-Process -Id $pidToStop -ErrorAction Stop
  Start-Sleep -Seconds 1
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
$started = Start-Process -FilePath $node -ArgumentList 'server/whatsapp-gateway.mjs' -WorkingDirectory $project -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 3
$health = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 10
if (!$health.webhookVerifiedReady -or !$health.inboundConnected -or !$health.automaticReplies -or $health.testNumbersConfigured -ne 1) {
  throw 'Gateway de prueba no preparado. No se activo la cuenta en Supabase.'
}
Write-Host 'Gateway verificado y restringido a un celular: OK' -ForegroundColor Green
Push-Location $project
try {
  & $node 'server/activate-whatsapp-test.mjs'
  if ($LASTEXITCODE -ne 0) { throw 'No se activo el numero de prueba en Supabase.' }
} finally { Pop-Location }
Write-Host 'LISTO: desde tu celular verificado escribe al numero Meta de prueba.' -ForegroundColor Green
Write-Host 'Destino: +1 555-672-9256'
Write-Host 'Mensaje sugerido: Hola, busco el Armor X13 para construccion.'
