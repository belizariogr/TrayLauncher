#define AppName    "TrayLauncher"
#define AppExe     "TrayLauncher.exe"
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#define SrcDir     "..\dist\win-unpacked"
#define IcoFile    "..\assets\icon\traylauncher.ico"

[Setup]
AppId={{B3F2A1C4-7E8D-4F9A-B6C2-1D3E5A7F9B0C}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppName}
DefaultDirName={localappdata}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=TrayLauncher-Setup
SetupIconFile={#IcoFile}
UninstallDisplayIcon={app}\{#AppExe}
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=
WizardStyle=modern
ShowLanguageDialog=auto

[Languages]
Name: "ptbr";   MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "en";     MessagesFile: "compiler:Default.isl"
Name: "es";     MessagesFile: "compiler:Languages\Spanish.isl"

[CustomMessages]
ptbr.StartupCheckbox=Iniciar {#AppName} automaticamente com o Windows
en.StartupCheckbox=Start {#AppName} automatically with Windows
es.StartupCheckbox=Iniciar {#AppName} automáticamente con Windows

ptbr.FinishRunApp=Executar {#AppName} agora
en.FinishRunApp=Launch {#AppName} now
es.FinishRunApp=Ejecutar {#AppName} ahora

[Tasks]
Name: "startup"; Description: "{cm:StartupCheckbox}"; GroupDescription: "{#AppName}"; Flags: checkedonce

[Files]
Source: "{#SrcDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}";        Filename: "{app}\{#AppExe}"
Name: "{group}\Uninstall";         Filename: "{uninstallexe}"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks:

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "{#AppName}"; ValueData: """{app}\{#AppExe}"""; \
  Flags: uninsdeletevalue; Tasks: startup

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:FinishRunApp}"; \
  Flags: nowait postinstall skipifsilent
