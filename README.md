<div align="center">

# steam_api64.js

**스팀 SDK(steam_api64.dll)를 koffi 로 직접 부르는 Node.js, Electron 모듈**

[![version](https://img.shields.io/badge/version-0.1.0-d4b06a?style=flat-square)](UPDATE.md)
[![license](https://img.shields.io/badge/license-MIT-3f3f46?style=flat-square)](LICENSE)
[![platform](https://img.shields.io/badge/platform-Windows%20x64-3f3f46?style=flat-square)](#요구-사항)
[![dependencies](https://img.shields.io/badge/dependencies-koffi-3f3f46?style=flat-square)](package.json)

[빠른 시작](#빠른-시작) / [Electron 에서 쓰기](#electron-에서-쓰기) / [기능](#기능) / [Steam Input](#steam-input) / [묶어서 내기](#묶어서-내기) / [업데이트 기록](UPDATE.md)

</div>

---

## 소개

steam_api64.js 는 스팀 SDK 의 C 함수(flat API)를 [koffi](https://koffi.dev/) 로 직접 부르는 작은 모듈입니다.
다른 감싼 라이브러리를 거치지 않으므로, 그 라이브러리들이 주지 않던 것도 받습니다.

- **스팀 오버레이 신호.** 스팀 신호(콜백)를 수동 디스패치로 이 모듈이 한 곳에서 모두 꺼내므로, 오버레이(Shift+Tab)가 열리고 닫히는 것(`GameOverlayActivated_t`)을 받습니다. 오버레이를 열면 게임을 멈추는 데 씁니다.
- **스팀덱의 패드.** Electron 27 이상은 스팀덱(Proton) 위에서 스팀이 만든 가상 패드를 보지 못해, 브라우저의 게임패드 읽기로는 덱의 단추가 하나도 들어오지 않습니다. 이 모듈은 Steam Input 의 동작(위, 아래, 확인 같은 것)을 스팀에게 직접 물어 그 길을 피합니다.
- **업적, 클라우드, 게임 언어.** 스팀 게임에 흔히 필요한 것을 함께 둡니다.
- 의존성은 koffi 하나이고, 네이티브 모듈을 Electron 판마다 다시 빌드할 필요가 없습니다. (koffi 는 Node-API 를 씁니다)

찾았다(FOUND YOU)의 스팀 판에서 쓰려고 만들었습니다.

## 요구 사항

- Windows 64 비트
- Node.js 16 이상, 또는 Electron (메인 프로세스)
- 스팀웍스 SDK 의 `redistributable_bin/win64/steam_api64.dll`
  - 이 리포에는 들어 있지 않습니다. 밸브의 약관상 재배포 파일은 게임과 함께만 배포합니다. [스팀웍스 파트너 사이트](https://partner.steamgames.com/downloads/list)에서 SDK 를 받아 꺼내 씁니다.
  - 시험한 판은 SDK 1.58 ~ 1.60 입니다. (`ISteamApps` v008, `ISteamUserStats` v012, `ISteamRemoteStorage` v016, `ISteamInput` v006) 인터페이스 판이 다른 SDK 의 DLL 은 함수 이름이 달라 읽지 못합니다.
- 스팀 클라이언트가 켜져 있어야 붙습니다.

## 설치

```bash
npm install github:ddukbaek2/steam_api64.js#release
```

판을 고정하려면 태그를 씁니다.

```bash
npm install github:ddukbaek2/steam_api64.js#v0.1.0
```

git 서브모듈로 넣어 쓸 수도 있습니다. 그때는 쓰는 쪽에 `koffi` 를 설치합니다.

```bash
git submodule add -b release https://github.com/ddukbaek2/steam_api64.js.git libs/steam_api64.js
npm install koffi
```

## 빠른 시작

```js
const path = require("path");
const steamApi = require("steam_api64.js");

// 스팀으로 띄우면 스팀이 앱 번호를 알려 줍니다. 스팀 없이 띄운 개발판은 이 번호로 붙습니다.
steamApi.initSteam(480, path.join(__dirname, "steam_api64.dll"));

console.log(steamApi.readGameLanguage());   // "koreana", "english" 같은 것

steamApi.setOverlayListener((isActive) => {
	console.log(isActive ? "오버레이 열림" : "오버레이 닫힘");
});

// 스팀 신호는 자주 꺼내야 합니다. (초에 60 번쯤)
setInterval(() => {
	steamApi.runSteamFrame();
}, 1000 / 60);
```

`initSteam` 은 스팀이 꺼져 있거나 DLL 을 읽지 못하면 이유를 담아 던집니다. 받아서 스팀 없이 도는 길로 가면 됩니다.

[examples/node/smoke.js](examples/node/smoke.js) 가 가장 짧은 예제입니다. (`node examples/node/smoke.js 480`)

## Electron 에서 쓰기

스팀 SDK 는 메인 프로세스에서만 부릅니다. 게임 창에는 preload 가 필요한 것만 엽니다.

```js
const { app } = require("electron");
const steamApi = require("steam_api64.js");

// 앱이 준비되기 전에 붙고 오버레이를 켭니다.
steamApi.initSteam(STEAM_APP_ID, path.join(appDirectory, "steam_api64.dll"));
steamApi.enableElectronOverlay(app);
```

`enableElectronOverlay(app)` 는 오버레이가 Electron 창에 덧그려지도록 `in-process-gpu`, `disable-direct-composition` 스위치를 켜고, 창이 늘 다시 그려지게 합니다.

메인 프로세스에서 스팀 신호와 패드 동작을 초에 60 번 읽어, 바뀌면 창에 보내고, 언어, 업적, 클라우드는 IPC 로 받는 전체 예제는 [examples/electron](examples/electron) 에 있습니다.

## 기능

| 함수 | 하는 일 |
|---|---|
| `initSteam(appId, libraryPath)` | DLL 을 읽고 스팀에 붙습니다(`SteamAPI_InitFlat`). 수동 디스패치를 켭니다. 앱 번호는 환경 변수 `SteamAppId` 가 없을 때만 넣습니다 |
| `shutdownSteam()` | Steam Input 과 스팀 연결을 닫습니다. (앱이 닫힐 때) |
| `runSteamFrame()` | 스팀 신호를 꺼내 나눠 주고 놓아 줍니다. 자주 부릅니다 |
| `setOverlayListener(listener)` | 오버레이가 열리고 닫힐 때 부를 것. (`true` 면 열림) |
| `readGameLanguage()` | 스팀이 정한 게임 언어. (스팀 API 의 언어 코드) |
| `unlockAchievement(id)` | 업적을 열고 스팀에 올립니다. 스팀이 아직 지금 값을 보내 주지 않았으면 `false` 이고, 다시 청해 둡니다 |
| `isCloudEnabled()` | 사용자 계정과 이 앱의 스팀 클라우드가 둘 다 켜져 있는지 |
| `readCloudFile(name)` | 스팀 클라우드의 파일을 UTF-8 글로 읽습니다. (없으면 `null`) |
| `writeCloudFile(name, text)` | 스팀 클라우드에 UTF-8 글을 씁니다. (썼는지) |
| `startInput(manifestPath, actionSetName, actionNames)` | Steam Input 을 시작하고 동작 정의 파일을 알립니다 |
| `readInputState()` | 지금 눌린 동작. `{ pressed: { 동작 이름: true }, isPlayStation }` (시작하지 않았으면 `null`) |
| `enableElectronOverlay(app)` | Electron 에서 오버레이 켜기. (앱이 준비되기 전) |

## Steam Input

패드를 동작으로 읽으려면 **동작 정의 파일(액션 매니페스트)** 과 **패드 종류별 공식 배치** 가 게임 폴더에 있어야 합니다.
[examples/steam_input](examples/steam_input) 에 위, 아래, 왼쪽, 오른쪽, 확인, 취소 여섯 동작의 예가 있습니다.

- `actions.vdf`: 동작 묶음(`InGame`)과 디지털 동작, 지역화, 패드 종류마다 배치 파일 경로
- `controller_neptune.vdf`(스팀덱), `controller_xboxone.vdf`, `controller_ps5.vdf` 같은 것: 십자키는 방향, 아래 단추(A, ✕)는 확인, 오른쪽 단추(B, ○)는 취소. 스팀 컨트롤러는 십자키가 없어 왼쪽 트랙패드를 십자키로 씁니다

```js
steamApi.startInput(path.join(appDirectory, "steam_input", "actions.vdf"), "InGame", ["up", "down", "left", "right", "confirm", "cancel"]);

// 매 프레임
steamApi.runSteamFrame();
const inputState = steamApi.readInputState();
if (inputState !== null && inputState.pressed.confirm === true) {
	// 확인
}
```

스팀웍스 설정도 함께 바꿉니다.

1. 스팀웍스 설정 편집 → 애플리케이션 → Steam Input
2. **Steam Input 기본 컨트롤러 구성**: 사용자 지정 구성(게임과 함께 제공), 경로는 게임 폴더 기준 `steam_input/actions.vdf`
3. 컨트롤러별 Steam Input 사용 칸(Xbox, PlayStation 들)은 비워 두면, PC 의 그 패드는 스팀을 거치지 않고 게임이 직접 읽습니다. 그 패드는 이 모듈로 들어오지 않으니 브라우저의 게임패드 읽기와 함께 씁니다

알아 둘 것:

- 동작 번호는 Steam Input 을 거치는 패드가 붙어 스팀이 구성을 읽은 뒤에야 나옵니다. 그 전에는 0 이라 `readInputState()` 가 매 프레임 다시 묻습니다. 패드가 없으면 `pressed` 는 늘 비어 있습니다.
- 입력 갱신(`RunFrame`)은 `readInputState()` 가 직접 부릅니다. (`ISteamInput::Init(true)`)
- `isPlayStation` 은 누르고 있는 패드가 PS3, PS4, PS5 패드인지입니다. 화면의 단추 안내를 ✕ ○ 로 바꾸는 데 씁니다.

## 스팀 오버레이 신호

스팀 신호는 이 모듈이 수동 디스패치(`SteamAPI_ManualDispatch_*`)로 모두 꺼냅니다. 그래서 **한 프로세스에서 다른 스팀 라이브러리와 함께 쓰지 않습니다.** 다른 라이브러리가 신호를 먼저 꺼내 가면 이 모듈이 받지 못하고, 반대도 같습니다.

```js
steamApi.setOverlayListener((isActive) => {
	if (isActive) {
		openPauseMenu();
	}
});
```

## 묶어서 내기

electron-builder 를 쓰면 이렇게 둡니다.

```json
"build": {
	"asarUnpack": ["node_modules/@koromix/**"],
	"extraFiles": ["steam_api64.dll", "steam_input/**"]
}
```

- koffi 의 네이티브 파일은 asar 밖에 있어야 읽힙니다.
- `steam_api64.dll` 과 `steam_input` 은 실행 파일 옆에 둡니다. 실행 중에는 `app.isPackaged ? path.dirname(process.execPath) : __dirname` 로 그 자리를 찾습니다.

## 알려진 제한

- Windows 64 비트만 됩니다. (리눅스, 맥의 SDK 파일 이름과 경로를 다루지 않습니다)
- 비동기 호출 결과(call result)를 쓰는 함수는 아직 없습니다. 신호는 오버레이 하나만 나눠 주고 나머지는 꺼내서 놓아 줍니다.
- 업적을 처음 열 때 스팀이 지금 값을 보내 주기 전이면 `false` 입니다. (이 SDK 판은 `RequestCurrentStats` 를 청해야 합니다)

## 브랜치와 판

- `dev`: 만드는 곳. (기본 브랜치)
- `release`: 내보낸 판만 올립니다. 판마다 `v0.1.0` 같은 태그를 붙이고 [업데이트 기록](UPDATE.md)에 적습니다.

## 라이선스

[MIT](LICENSE). 스팀웍스 SDK 와 `steam_api64.dll` 은 밸브의 [스팀웍스 SDK 약관](https://partner.steamgames.com/documentation/sdk_access_agreement)을 따릅니다.
