# 업데이트 기록

# 0.1.0 (2026-10-11)
- 처음 공개합니다. 찾았다(FOUND YOU)의 스팀 판에서 steamworks.js 대신 쓰려고 만든 모듈을 떼어 냈습니다
- `initSteam`, `shutdownSteam`: `SteamAPI_InitFlat` 으로 붙고 수동 디스패치를 켭니다. 스팀이 꺼져 있거나 DLL 을 읽지 못하면 이유를 담아 던집니다
- `runSteamFrame`, `setOverlayListener`: 스팀 신호를 한 곳에서 모두 꺼내고, 스팀 오버레이가 열리고 닫히는 신호(`GameOverlayActivated_t`)를 나눠 줍니다
- `readGameLanguage`, `unlockAchievement`: 게임 언어와 업적
- `isCloudEnabled`, `readCloudFile`, `writeCloudFile`: 스팀 클라우드를 UTF-8 글로 읽고 씁니다
- `startInput`, `readInputState`: Steam Input 의 디지털 동작을 모든 패드에서 합쳐 읽습니다. 동작 정의 파일은 실행 중에 알립니다(`SetInputActionManifestFilePath`). 누르고 있는 패드가 플레이스테이션 패드인지도 알려 줍니다
- `enableElectronOverlay`: Electron 창에 스팀 오버레이가 덧그려지게 합니다
- 예제: Node.js 로 붙어 보기, Electron 메인과 preload, Steam Input 의 동작 정의와 패드 여덟 종류의 공식 배치
