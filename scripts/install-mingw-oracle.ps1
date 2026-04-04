#Requires -Version 5.1
<#
  Cai WinLibs (GCC MinGW-w64) + Oracle Instant Client Basic (x64) vao thu muc nguoi dung
  va them PATH / bien moi truong cho godror + CGO.

  Chay trong PowerShell (co the can cho phep script: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned):
    .\scripts\install-mingw-oracle.ps1
#>
$ErrorActionPreference = "Stop"

$WinLibsUrl = "https://github.com/brechtsanders/winlibs_mingw/releases/download/15.2.0posix-14.0.0-ucrt-r7/winlibs-x86_64-posix-seh-gcc-15.2.0-mingw-w64ucrt-14.0.0-r7.zip"
$OracleUrl = "https://download.oracle.com/otn_software/nt/instantclient/2390000/instantclient-basic-windows.x64-23.9.0.25.07.zip"

$Base = Join-Path $env:LOCALAPPDATA "Programs"
$WinLibsRoot = Join-Path $Base "WinLibs"
$OracleRoot = Join-Path $Base "OracleInstantClient"
$Temp = Join-Path $env:TEMP "oracle_client_soft_deps"

New-Item -ItemType Directory -Force -Path $Temp, $WinLibsRoot, $OracleRoot | Out-Null

function Add-UserPathEntry {
    param([string]$Dir)
    if (-not (Test-Path $Dir)) { return }
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -split ";" | Where-Object { $_ -and (Test-Path $_) -and ((Resolve-Path $_).Path -eq (Resolve-Path $Dir).Path) }) {
        Write-Host "PATH da co: $Dir"
        return
    }
    $newPath = if ($userPath) { "$userPath;$Dir" } else { $Dir }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Da them vao PATH (User): $Dir"
}

# --- WinLibs ---
$winZip = Join-Path $Temp "winlibs.zip"
if (-not (Test-Path (Join-Path $WinLibsRoot "mingw64\bin\gcc.exe"))) {
    Write-Host "Dang tai WinLibs (~255 MB)..."
    Invoke-WebRequest -Uri $WinLibsUrl -OutFile $winZip -UseBasicParsing
    Write-Host "Dang giai nen WinLibs -> $WinLibsRoot"
    Expand-Archive -Path $winZip -DestinationPath $WinLibsRoot -Force
    Remove-Item $winZip -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "WinLibs da co tai $WinLibsRoot\mingw64\bin"
}

$mingwBin = Join-Path $WinLibsRoot "mingw64\bin"
if (-not (Test-Path (Join-Path $mingwBin "gcc.exe"))) {
    $gcc = Get-ChildItem -Path $WinLibsRoot -Recurse -Filter "gcc.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($gcc) { $mingwBin = $gcc.DirectoryName } else { throw "Khong tim thay gcc.exe sau khi giai nen WinLibs" }
}
Add-UserPathEntry $mingwBin

# --- Oracle Instant Client ---
$ociZip = Join-Path $Temp "instantclient-basic.zip"
$marker = Get-ChildItem -Path $OracleRoot -Filter "oci.dll" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $marker) {
    Write-Host "Dang tai Oracle Instant Client Basic (~131 MB)..."
    Invoke-WebRequest -Uri $OracleUrl -OutFile $ociZip -UseBasicParsing
    Write-Host "Dang giai nen Oracle IC -> $OracleRoot"
    Expand-Archive -Path $ociZip -DestinationPath $OracleRoot -Force
    Remove-Item $ociZip -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "Oracle Instant Client da co (oci.dll)"
}

$ociDll = Get-ChildItem -Path $OracleRoot -Filter "oci.dll" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $ociDll) { throw "Khong tim thay oci.dll sau khi giai nen Oracle IC" }
$ociDir = $ociDll.DirectoryName
Add-UserPathEntry $ociDir

# godror / ODPI thuong doc OCI_LIB_DIR (thu muc chua oci.dll hoac sdk lib)
[Environment]::SetEnvironmentVariable("OCI_LIB_DIR", $ociDir, "User")
Write-Host "Da dat OCI_LIB_DIR (User) = $ociDir"

# Khuyen nghi bat CGO khi build Go
[Environment]::SetEnvironmentVariable("CGO_ENABLED", "1", "User")
Write-Host "Da dat CGO_ENABLED=1 (User)"

Write-Host ""
Write-Host "=== Xong. Mo PowerShell moi (hoac dang nhap lai) roi thu: ==="
Write-Host "  gcc --version"
Write-Host "  `$env:CGO_ENABLED=1; cd e:\RD\oracle_client_soft; wails build"
Write-Host ""
