param([switch]$Once)
$ErrorActionPreference="Stop"
$root="C:\DESAROLLO\ARM-CRM"
$state=Join-Path $env:LOCALAPPDATA "STECH_ARMCRM"
$log=Join-Path $state "watchdog.log"
New-Item -ItemType Directory -Path $state -Force|Out-Null
function Log-Message([string]$message){
  $line=(Get-Date -Format "yyyy-MM-dd HH:mm:ss")+" "+$message
  Add-Content -Path $log -Value $line -Encoding UTF8
}
function Probe([int]$port,[string]$path){
  try{
    $url="http://127.0.0.1:"+$port+$path
    $response=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 5
    if([int]$response.StatusCode -ne 200){return $false}
    if($port -eq 3000){
      $data=$response.Content|ConvertFrom-Json
      return [bool]($data.status -eq "ready_for_signed_ingest" -and
         $data.webhookVerifiedReady -and $data.inboundConnected -and
         $data.testNumbersConfigured -eq 2 -and $data.automaticReplies)
    }
    if($port -eq 8789){
      $data=$response.Content|ConvertFrom-Json
      return [bool]($data.ok -and $data.configured)
    }
    return $true
  }catch{return $false}
}
function Check-One([string]$name,[int]$port,[string]$path,[string[]]$arguments){
  if(Probe $port $path){return}
  $listeners= @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  if($listeners.Count -gt 0){
    # Never kill unknown/healthy processes on shared PC020.
    Log-Message ("WARN "+$name+" port="+$port+" occupied, health unavailable; no restart")
    return
  }
  $node=(Get-Command node.exe -ErrorAction Stop).Source
  $p=Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 2
  if(Probe $port $path){Log-Message ("RESTORED "+$name+" PID="+$p.Id)}
  else{Log-Message ("WARN "+$name+" failed health after start PID="+$p.Id)}
}
function Cycle {
  if(-not (Test-Path (Join-Path $root "server\whatsapp-gateway.mjs"))){
    Log-Message "ERROR ARM-CRM sources unavailable";return
  }
  Check-One "WhatsApp" 3000 "/health" @("server/whatsapp-gateway.mjs")
  Check-One "ALEX" 8789 "/health" @("server/agent-server.mjs")
  Check-One "Panel" 5175 "/" @("node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5175","--strictPort")
}
if($Once){Cycle;Write-Output "ARM_WATCHDOG_ONCE_COMPLETED=true";exit 0}
$mutex=New-Object System.Threading.Mutex($false,"Local\STECH_ARMCRM_WATCHDOG")
$acquired=$false
try{
 $acquired=$mutex.WaitOne(0)
 if(-not $acquired){exit 0}
 Log-Message "WATCHDOG_STARTED mode=logged_on_user"
 while($true){
   try{Cycle}
   catch{Log-Message ("ERROR cycle type="+$_.Exception.GetType().Name)}
   Start-Sleep -Seconds 60
 }
}finally{
 if($acquired){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
