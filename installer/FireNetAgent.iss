#define AppName "FireNet DM4615 Agent"
#define AppVersion "0.1.0"
#define AppPublisher "FireNet"
#define AppExeName "Dm4615.Agent.exe"

[Setup]
AppId={{A21F0B36-84F5-4E72-AC71-4615D0A1A615}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\FireNet\DM4615 Agent
DefaultGroupName={#AppName}
OutputDir=..\artifacts\installer
OutputBaseFilename=FireNet-DM4615-Agent-Setup
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#AppExeName}
WizardStyle=modern

[Files]
Source: "..\artifacts\win-x64\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\src\agent\README.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\docs\windows-agent-vpn.md"; DestDir: "{app}\docs"; Flags: ignoreversion

[Icons]
Name: "{group}\FireNet DM4615 Agent - Documentação"; Filename: "{app}\docs\README.md"
Name: "{commondesktop}\FireNet DM4615 Agent"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; Flags: unchecked

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Iniciar agente FireNet DM4615"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\logs"
