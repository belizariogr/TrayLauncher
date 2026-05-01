Unicode True

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; ─── Definitions ──────────────────────────────────────────────────────────────
!define APPNAME  "TrayLauncher"
!define APPEXE   "TrayLauncher.exe"
!ifndef APPVERSION
  !define APPVERSION "1.0.0"
!endif
!define SRCDIR   "..\dist\win-unpacked"
!define ICOFILE  "..\assets\icon\traylauncher.ico"

; ─── General ──────────────────────────────────────────────────────────────────
Name             "${APPNAME} ${APPVERSION}"
OutFile          "..\dist\TrayLauncher-Setup.exe"
InstallDir       "$LOCALAPPDATA\${APPNAME}"
InstallDirRegKey HKCU "Software\${APPNAME}" "InstallDir"
RequestExecutionLevel user
BrandingText     "${APPNAME} ${APPVERSION}"

; ─── Variables ────────────────────────────────────────────────────────────────
Var StartupCheckbox
Var StartupState

; ─── MUI Settings ─────────────────────────────────────────────────────────────
!define MUI_ABORTWARNING
!define MUI_ICON   "${ICOFILE}"
!define MUI_UNICON "${ICOFILE}"

!define MUI_FINISHPAGE_RUN           "$INSTDIR\${APPEXE}"
!define MUI_FINISHPAGE_RUN_TEXT      "Executar ${APPNAME} agora"
!define MUI_FINISHPAGE_RUN_NOTCHECKED

; ─── Pages ────────────────────────────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
Page custom   StartupPage_Create   StartupPage_Leave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ─── Languages ────────────────────────────────────────────────────────────────
!insertmacro MUI_LANGUAGE "PortugueseBR"
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Spanish"

; ─── Startup Option Page ──────────────────────────────────────────────────────
Function StartupPage_Create
  !insertmacro MUI_HEADER_TEXT "Opções de Inicialização" \
    "Configure como o ${APPNAME} será iniciado."

  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateLabel} 0 0 100% 20u \
    "Escolha as opções adicionais de instalação:"
  Pop $1

  ${NSD_CreateCheckBox} 0 28u 100% 14u \
    "Iniciar ${APPNAME} automaticamente com o Windows"
  Pop $StartupCheckbox
  ${NSD_SetState} $StartupCheckbox ${BST_CHECKED}

  nsDialogs::Show
FunctionEnd

Function StartupPage_Leave
  ${NSD_GetState} $StartupCheckbox $StartupState
FunctionEnd

; ─── Install ──────────────────────────────────────────────────────────────────
Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${SRCDIR}\*.*"

  ; Startup registry entry
  ${If} $StartupState == ${BST_CHECKED}
    WriteRegStr HKCU \
      "Software\Microsoft\Windows\CurrentVersion\Run" \
      "${APPNAME}" '"$INSTDIR\${APPEXE}"'
  ${Else}
    DeleteRegValue HKCU \
      "Software\Microsoft\Windows\CurrentVersion\Run" "${APPNAME}"
  ${EndIf}

  ; Add/Remove Programs info
  WriteRegStr  HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "DisplayName"     "${APPNAME}"
  WriteRegStr  HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr  HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "DisplayIcon"     '"$INSTDIR\${APPEXE}"'
  WriteRegStr  HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "Publisher"       "${APPNAME}"
  WriteRegStr  HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "DisplayVersion"  "${APPVERSION}"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "NoRepair"  1

  WriteRegStr HKCU "Software\${APPNAME}" "InstallDir" "$INSTDIR"

  ; Shortcuts
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut  "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${APPEXE}"
  CreateShortCut  "$SMPROGRAMS\${APPNAME}\Uninstall.lnk"  "$INSTDIR\Uninstall.exe"
  CreateShortCut  "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${APPEXE}"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

; ─── Uninstall ────────────────────────────────────────────────────────────────
Section "Uninstall"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APPNAME}"

  RMDir /r "$INSTDIR"

  Delete "$DESKTOP\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\Uninstall.lnk"
  RMDir  "$SMPROGRAMS\${APPNAME}"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
  DeleteRegKey HKCU "Software\${APPNAME}"
SectionEnd
