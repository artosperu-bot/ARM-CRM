$ErrorActionPreference="Stop"
$root="C:\DESAROLLO\ARM-CRM"
$watch=Join-Path $root "scripts\ARM-CRM-Watchdog-PC020.ps1"
if(!(Test-Path $watch)){throw "ARM_WATCHDOG_NOT_FOUND"}
$startup=[Environment]::GetFolderPath("Startup")
if(!(Test-Path $startup)){throw "WINDOWS_STARTUP_NOT_AVAILABLE"}
$shell=New-Object -ComObject WScript.Shell
$target=Join-Path $startup "STECH ARM-CRM PC020.lnk"
$shortcut=$shell.CreateShortcut($target)
$powershell=(Get-Command powershell.exe -ErrorAction Stop).Source
$shortcut.TargetPath=$powershell
$shortcut.Arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$watch+'"'
$shortcut.WorkingDirectory=$root
$shortcut.WindowStyle=7
$shortcut.Description="STECH ARM-CRM: arranque y comprobacion de salud cada minuto, solo durante la sesion de Windows"
$shortcut.Save()
if(!(Test-Path $target)){throw "ARM_WATCHDOG_SHORTCUT_NOT_CREATED"}
Write-Output "ARM_AUTOSTART_LINK_READY=true"
Write-Output ("STARTUP_SHORTCUT="+$target)
Write-Output "MODE=ON_USER_LOGON_NOT_WINDOWS_SERVICE"
Write-Output "CHECK_INTERVAL_SECONDS=60"
# Start now, not only after the next sign-in.
$running=Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
 Where-Object {$_.CommandLine -like "*ARM-CRM-Watchdog-PC020.ps1*" -and $_.CommandLine -notlike "*INSTALAR-ARM-CRM-INICIO*"}
if(!$running){
 $proc=Start-Process -FilePath $powershell -ArgumentList $shortcut.Arguments -WorkingDirectory $root -WindowStyle Hidden -PassThru
 Write-Output ("WATCHDOG_STARTED_PID="+$proc.Id)
}else{
 Write-Output "WATCHDOG_ALREADY_RUNNING=true"
}
