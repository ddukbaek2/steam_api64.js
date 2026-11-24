# 업데이트 기록

# 다음 판 (dev, 아직 내지 않음, 0.2.0 으로 낼 판)
- **스팀웍스 SDK 1.65 에 맞춥니다.** 인터페이스 판: `ISteamApps` v009, `ISteamUtils` v011, `ISteamUserStats` v013, `ISteamInput` v007, `ISteamRemoteStorage` v016 그대로, `ISteamFriends` v018 을 새로 엽니다. SDK 1.60 이하의 DLL 로는 시작하지 못하니 게임의 `steam_api64.dll`(맥은 `libsteam_api.dylib`)을 1.65 의 것으로 바꿉니다. 함수 이름과 돌려주는 꼴은 그대로입니다
- `RequestCurrentStats` 를 부르지 않습니다. SDK 1.61 부터 없어졌고, 스팀이 시작할 때 업적과 통계의 지금 값을 저절로 받습니다
- 새 함수: `readAchievement`(열었는지와 연 때), `clearAchievement`, `readStatInt`, `readStatFloat`, `setStatInt`, `setStatFloat`, `storeStats`, `setRichPresence`, `clearRichPresence`, `readSteamHardware`(SDK 1.65 의 `IsRunningOnSteamHardware`, 없어진 `IsSteamRunningOnSteamDeck` 대신), `isRunningUnderProton`
- `startInput` 에 아날로그 동작 이름(넷째 값, 넣지 않아도 됨)을 받고, `readInputState` 가 `analog: { 동작 이름: { x, y } }` 를 돌려줍니다. (`ISteamInput::GetAnalogActionHandle`, `GetAnalogActionData`) 탑다운 게임의 이동과 조준처럼 스틱으로 받는 것에 씁니다
- `isPlayStation` 은 단추를 누른 패드에 더해 스틱을 기울인 패드도 봅니다
- 앱 480 으로 붙어 Steam Input 시작과 아날로그 읽기가 오류 없이 도는 것은 봤습니다(2026-11-09, 패드 없이). 실제 패드로 값이 들어오는 것을 본 뒤에 판을 냅니다
- `triggerVibration(leftSpeed, rightSpeed)`: Steam Input 으로 받는 모든 패드를 떨게 합니다(`ISteamInput::TriggerVibration`). 세기는 0 ~ 1 이고, 다시 부를 때까지 떨므로 멈출 때는 `0, 0` 으로 부릅니다. 실제 패드와 스팀덱에서 떨리는 것을 본 뒤에 판을 냅니다

# 0.1.2 (2026-11-01)
- `readSteamUiLanguage`: 스팀 화면 언어(`ISteamUtils::GetSteamUILanguage`)를 읽습니다. 스팀은 게임을 깔 때 게임마다의 언어 칸에 영어를 적어 두어, 게임 언어(`readGameLanguage`)가 스팀 화면 언어와 달리 영어로 오는 일이 많습니다. 사용자의 언어를 알고 싶으면 이것을 봅니다

# 0.1.1 (2026-10-11)
- 리드미: 스팀웍스의 Steam Input 설정을 바꾸지 않아도 된다고 고칩니다. `startInput` 이 실행 중에 동작 정의 파일을 알리는 것만으로 스팀덱에서 십자키와 A, B 가 들어오는 것을 확인했습니다
- 코드는 0.1.0 과 같습니다

# 0.1.0 (2026-10-11)
- 처음 공개합니다. 스팀 게임에서 steamworks.js 대신 쓰려고 만든 모듈을 떼어 냈습니다
- `initSteam`, `shutdownSteam`: `SteamAPI_InitFlat` 으로 붙고 수동 디스패치를 켭니다. 스팀이 꺼져 있거나 DLL 을 읽지 못하면 이유를 담아 던집니다
- `runSteamFrame`, `setOverlayListener`: 스팀 신호를 한 곳에서 모두 꺼내고, 스팀 오버레이가 열리고 닫히는 신호(`GameOverlayActivated_t`)를 나눠 줍니다
- `readGameLanguage`, `unlockAchievement`: 게임 언어와 업적
- `isCloudEnabled`, `readCloudFile`, `writeCloudFile`: 스팀 클라우드를 UTF-8 글로 읽고 씁니다
- `startInput`, `readInputState`: Steam Input 의 디지털 동작을 모든 패드에서 합쳐 읽습니다. 동작 정의 파일은 실행 중에 알립니다(`SetInputActionManifestFilePath`). 누르고 있는 패드가 플레이스테이션 패드인지도 알려 줍니다
- `enableElectronOverlay`: Electron 창에 스팀 오버레이가 덧그려지게 합니다
- 예제: Node.js 로 붙어 보기, Electron 메인과 preload, Steam Input 의 동작 정의와 패드 여덟 종류의 공식 배치
