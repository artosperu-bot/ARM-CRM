# Add one Meta-verified WhatsApp test recipient to ARM-CRM without replacing the original.
# Does not change Meta's own recipient list, OpenAI keys, CRM data, or legacy bot.
$ErrorActionPreference = 'Stop'
$root = 'C:\DESAROLLO\ARM-CRM'
$config = Join-Path $root '.env.local'
if (!(Test-Path -LiteralPath $config)) { throw 'ARM-CRM .env.local no encontrado.' }

$lines = [System.Collections.Generic.List[string]]::new()
[void]$lines.AddRange([string[]](Get-Content -LiteralPath $config -Encoding UTF8))
$variables = @{}
foreach ($line in $lines) {
  if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$') {
    $variables[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}
if (!$variables['ARM_META_APP_SECRET']) { throw 'Primero ejecuta la configuracion original; falta App Secret.' }
if ($variables['ARM_WHATSAPP_AUTO_REPLY'] -ne 'enabled') { throw 'Respuestas automaticas desactivadas. No se modificara la lista.' }
$existing = @([string]$variables['ARM_WHATSAPP_TEST_NUMBERS'] -split ',' | ForEach-Object { $_ -replace '[^0-9]','' } | Where-Object { $_ })
$unique = @($existing | Select-Object -Unique)
if ($unique.Count -lt 1 -or $unique.Count -ge 5) { throw 'La lista actual esta vacia o alcanzo el limite de prueba de Meta (5).' }
foreach ($num in $unique) {
  if ($num -notmatch '^519[0-9]{8}$') { throw 'Hay un numero antiguo invalido; no se cambio la configuracion.' }
}

Write-Host '== STECH ARM-CRM | Agregar segundo celular de prueba ==' -ForegroundColor Cyan
Write-Host ('Actualmente autorizados: '+$unique.Count+' numero(s)')
foreach ($number in $unique) { Write-Host ('Numero existente: ***'+$number.Substring($number.Length-4)) }
Write-Host 'El nuevo numero DEBE estar verificado previamente en Meta Developers > WhatsApp > API Setup > To.'
$next = (Read-Host 'Escribe el nuevo numero peruano (+51 9XXXXXXXX)').Trim() -replace '[^0-9]',''
if ($next -match '^9[0-9]{8}$') { $next = '51'+$next }
if ($next -notmatch '^519[0-9]{8}$') { throw 'Formato invalido: 51 + celular peruano de 9 digitos.' }
if ($unique -contains $next) {
  Write-Host 'Ese celular ya figura en ARM-CRM. No se realizaron cambios.' -ForegroundColor Yellow
  exit 0
}

$confirm = (Read-Host ('Confirmas que ***'+$next.Substring($next.Length-4)+' YA esta verificado en Meta y deseas permitir respuestas del bot? Escribe AGREGAR')).Trim()
if ($confirm -cne 'AGREGAR') { throw 'Cancelado sin cambios.' }

$updated = @($unique) + @($next)
$targetKey = 'ARM_WHATSAPP_TEST_NUMBERS'
$replacement = $targetKey + '=' + ($updated -join ',')
$found = $false
for ($i=0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '^\s*ARM_WHATSAPP_TEST_NUMBERS\s*=') {
    $lines[$i] = $replacement
    $found = $true
  }
}
if (!$found) { [void]$lines.Add($replacement) }

# Write in the same private, gitignored configuration, no secret is echoed.
$utf8 = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($config, ([string]::Join([Environment]::NewLine,[string[]]$lines)+[Environment]::NewLine), $utf8)
$next = $null

# Restart strictly the new ARM gateway, never the legacy CRM or the main agent.
$bound = @(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
if ($bound.Count -ne 1) { throw 'Configuracion actualizada pero puerto 3000 no tiene un unico proceso; reinicio manual pendiente.' }
$oldPid = $bound[0].OwningProcess
$proc = Get-CimInstance Win32_Process -Filter ("ProcessId="+$oldPid)
if ($proc.Name -ne 'node.exe' -or $proc.CommandLine -notmatch 'server/whatsapp-gateway.mjs') {
  throw 'Configuracion actualizada. Puerto 3000 corresponde a otro programa; no se detuvo.'
}
Stop-Process -Id $oldPid -ErrorAction Stop
Start-Sleep -Seconds 1
$node = (Get-Command node.exe -ErrorAction Stop).Source
$newProc = Start-Process -FilePath $node -ArgumentList 'server/whatsapp-gateway.mjs' -WorkingDirectory $root -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2

$health = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 10
if (!$health.webhookVerifiedReady -or !$health.inboundConnected -or !$health.automaticReplies -or $health.testNumbersConfigured -ne $updated.Count) {
  throw 'No se pudo validar el gateway reiniciado. No hagas pruebas hasta comprobar /health.'
}
Write-Host 'ARM_WHATSAPP_EXTRA_NUMBER_READY=true' -ForegroundColor Green
Write-Host ('AUTHORIZED_TEST_NUMBERS='+$health.testNumbersConfigured)
Write-Host ('SIGNED_WEBHOOK='+$health.webhookVerifiedReady)
Write-Host ('CRM_INGEST='+$health.inboundConnected)
Write-Host ('AUTO_REPLIES='+$health.automaticReplies)
Write-Host 'Destino de Meta: +1 555-672-9256'
Write-Host 'Desde el celular adicional envia un mensaje nuevo. No se recuperan mensajes antiguos.'
