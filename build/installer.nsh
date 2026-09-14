; SOCDOF Windows NSIS Installer Customization Script
; Copyright (c) 2026 Strudelcode - Yuri / Strudel

!macro preInit
  ; Ensure 64-bit registry view is enabled for x64 architecture
  SetRegView 64
!macroend

!macro customInit
  ; Ensure 64-bit registry view is active during setup
  SetRegView 64
!macroend

!macro customInstall
  ; Post-installation hook
!macroend

!macro customUnInstall
  ; Post-uninstallation hook
!macroend
