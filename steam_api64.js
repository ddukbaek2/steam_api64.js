//==============================================================================
// steam_api64.js
//
// 스팀 SDK 의 C 함수(flat API, steam_api64.dll)를 koffi 로 직접 부르는 Node.js, Electron 용 모듈입니다.
// 다른 감싼 라이브러리를 거치지 않으므로 그 라이브러리들이 주지 않던 것도 받습니다.
//   스팀 신호(콜백)는 수동 디스패치로 이 모듈이 한 곳에서 모두 꺼냅니다. 스팀 오버레이가 열리고 닫히는 신호가 여기서 옵니다.
//   패드는 Steam Input 의 동작(위, 아래, 확인 같은 것)으로 스팀에게 직접 묻습니다. 스팀덱에서 Proton 위의 Electron(크롬)은
//   스팀이 만든 가상 패드를 보지 못해, 이 길이 아니면 덱의 단추가 게임에 오지 않습니다.
// 창과 IPC 는 부르는 쪽이 맡습니다. Electron 에서 오버레이를 켜는 일만 enableElectronOverlay 로 함께 둡니다.
// 시험한 SDK: Steamworks SDK 1.58 ~ 1.60 의 steam_api64.dll
// (ISteamApps v008, ISteamUserStats v012, ISteamRemoteStorage v016, ISteamInput v006)
//==============================================================================
"use strict";

// 스팀 SDK 의 신호 번호. (GameOverlayActivated_t 의 k_iCallback)
const CALLBACK_GAME_OVERLAY_ACTIVATED = 331;
// 시작에 실패했을 때 스팀이 이유를 적어 주는 칸의 크기. (SteamErrMsg)
const ERROR_MESSAGE_SIZE = 1024;
// Steam Input 이 한 번에 돌려주는 패드 수의 상한. (STEAM_INPUT_MAX_COUNT)
const INPUT_MAX_COUNT = 16;
// 모든 패드에 한꺼번에. (STEAM_INPUT_HANDLE_ALL_CONTROLLERS)
const INPUT_HANDLE_ALL_CONTROLLERS = 0xFFFFFFFFFFFFFFFFn;
// 플레이스테이션 패드의 Steam Input 종류. (ESteamInputType 의 PS4Controller, PS3Controller, PS5Controller)
const PLAYSTATION_INPUT_TYPES = [5, 12, 13];
// Electron 에서 오버레이를 덧그리도록 창을 다시 그리게 하는 간격. (밀리초)
const OVERLAY_REPAINT_MILLISECONDS = 1000 / 60;

let koffi = null;
let steamFunctions = null;
let steamPipe = 0;
let appsInterface = null;
let userStatsInterface = null;
let remoteStorageInterface = null;
let inputInterface = null;
let overlayListener = null;
// Steam Input 의 동작 묶음과 동작. (handle 0 은 스팀이 아직 구성을 읽지 않은 것이라 다음 프레임에 다시 묻습니다)
let inputActionSetName = "";
let inputActionSetHandle = 0n;
let inputActionNames = [];
let inputActionHandles = [];


//==============================================================================
// 스팀 SDK 의 함수 선언.
//==============================================================================
/**
 * @param { object } steamLibrary
 * @returns { object }
 */
function declareSteamFunctions(steamLibrary) {
	koffi.struct("CallbackMsg_t", {
		steamUser: "int32_t",
		callbackId: "int32_t",
		parameter: "void *",
		parameterSize: "int32_t",
	});
	koffi.struct("InputDigitalActionData_t", {
		state: "bool",
		active: "bool",
	});
	return {
		initFlat: steamLibrary.func("int SteamAPI_InitFlat(void *errorMessage)"),
		shutdown: steamLibrary.func("void SteamAPI_Shutdown()"),
		getSteamPipe: steamLibrary.func("int32_t SteamAPI_GetHSteamPipe()"),
		manualDispatchInit: steamLibrary.func("void SteamAPI_ManualDispatch_Init()"),
		manualDispatchRunFrame: steamLibrary.func("void SteamAPI_ManualDispatch_RunFrame(int32_t steamPipe)"),
		manualDispatchGetNextCallback: steamLibrary.func("bool SteamAPI_ManualDispatch_GetNextCallback(int32_t steamPipe, _Out_ CallbackMsg_t *message)"),
		manualDispatchFreeLastCallback: steamLibrary.func("void SteamAPI_ManualDispatch_FreeLastCallback(int32_t steamPipe)"),
		apps: steamLibrary.func("void *SteamAPI_SteamApps_v008()"),
		getCurrentGameLanguage: steamLibrary.func("const char *SteamAPI_ISteamApps_GetCurrentGameLanguage(void *self)"),
		userStats: steamLibrary.func("void *SteamAPI_SteamUserStats_v012()"),
		requestCurrentStats: steamLibrary.func("bool SteamAPI_ISteamUserStats_RequestCurrentStats(void *self)"),
		setAchievement: steamLibrary.func("bool SteamAPI_ISteamUserStats_SetAchievement(void *self, const char *name)"),
		storeStats: steamLibrary.func("bool SteamAPI_ISteamUserStats_StoreStats(void *self)"),
		remoteStorage: steamLibrary.func("void *SteamAPI_SteamRemoteStorage_v016()"),
		isCloudEnabledForAccount: steamLibrary.func("bool SteamAPI_ISteamRemoteStorage_IsCloudEnabledForAccount(void *self)"),
		isCloudEnabledForApp: steamLibrary.func("bool SteamAPI_ISteamRemoteStorage_IsCloudEnabledForApp(void *self)"),
		fileExists: steamLibrary.func("bool SteamAPI_ISteamRemoteStorage_FileExists(void *self, const char *fileName)"),
		getFileSize: steamLibrary.func("int32_t SteamAPI_ISteamRemoteStorage_GetFileSize(void *self, const char *fileName)"),
		fileRead: steamLibrary.func("int32_t SteamAPI_ISteamRemoteStorage_FileRead(void *self, const char *fileName, void *data, int32_t dataSize)"),
		fileWrite: steamLibrary.func("bool SteamAPI_ISteamRemoteStorage_FileWrite(void *self, const char *fileName, void *data, int32_t dataSize)"),
		input: steamLibrary.func("void *SteamAPI_SteamInput_v006()"),
		inputInit: steamLibrary.func("bool SteamAPI_ISteamInput_Init(void *self, bool explicitlyCallRunFrame)"),
		inputShutdown: steamLibrary.func("bool SteamAPI_ISteamInput_Shutdown(void *self)"),
		setInputActionManifestFilePath: steamLibrary.func("bool SteamAPI_ISteamInput_SetInputActionManifestFilePath(void *self, const char *manifestPath)"),
		inputRunFrame: steamLibrary.func("void SteamAPI_ISteamInput_RunFrame(void *self, bool reservedValue)"),
		getConnectedControllers: steamLibrary.func("int SteamAPI_ISteamInput_GetConnectedControllers(void *self, void *handles)"),
		getActionSetHandle: steamLibrary.func("uint64_t SteamAPI_ISteamInput_GetActionSetHandle(void *self, const char *actionSetName)"),
		activateActionSet: steamLibrary.func("void SteamAPI_ISteamInput_ActivateActionSet(void *self, uint64_t controller, uint64_t actionSet)"),
		getDigitalActionHandle: steamLibrary.func("uint64_t SteamAPI_ISteamInput_GetDigitalActionHandle(void *self, const char *actionName)"),
		getDigitalActionData: steamLibrary.func("InputDigitalActionData_t SteamAPI_ISteamInput_GetDigitalActionData(void *self, uint64_t controller, uint64_t action)"),
		getInputTypeForHandle: steamLibrary.func("int SteamAPI_ISteamInput_GetInputTypeForHandle(void *self, uint64_t controller)"),
	};
}


//==============================================================================
// 시작. (스팀 SDK 를 읽고 스팀에 붙습니다)
//
// 스팀으로 띄우면 스팀이 앱 번호를 알려 줍니다. 스팀 없이 띄운 개발판은 앱 번호를 환경 변수로 넣어 붙습니다.
// 스팀이 꺼져 있거나 DLL 을 읽지 못하면 이유를 담아 던집니다. (부르는 쪽이 더미로 갑니다)
//==============================================================================
/**
 * @param { number } appId 스팀웍스의 앱 번호.
 * @param { string } libraryPath steam_api64.dll 의 경로.
 */
function initSteam(appId, libraryPath) {
	koffi = require("koffi");
	const steamLibrary = koffi.load(libraryPath);
	const functions = declareSteamFunctions(steamLibrary);
	if (process.env.SteamAppId === undefined) {
		process.env.SteamAppId = String(appId);
	}
	const errorMessage = Buffer.alloc(ERROR_MESSAGE_SIZE);
	const initResult = functions.initFlat(errorMessage);
	if (initResult !== 0) {
		const errorEnd = errorMessage.indexOf(0);
		const errorText = errorMessage.toString("utf8", 0, errorEnd < 0 ? ERROR_MESSAGE_SIZE : errorEnd);
		throw new Error("SteamAPI_InitFlat " + initResult + " " + errorText);
	}
	functions.manualDispatchInit();
	steamFunctions = functions;
	steamPipe = functions.getSteamPipe();
	appsInterface = functions.apps();
	userStatsInterface = functions.userStats();
	remoteStorageInterface = functions.remoteStorage();
	// 업적은 스팀이 지금 값을 보내 준 뒤에야 바꿀 수 있습니다. (이 SDK 판은 직접 청해야 합니다)
	functions.requestCurrentStats(userStatsInterface);
}


//==============================================================================
// 끝. (앱이 닫힐 때)
//==============================================================================
function shutdownSteam() {
	if (steamFunctions === null) {
		return;
	}
	if (inputInterface !== null) {
		steamFunctions.inputShutdown(inputInterface);
		inputInterface = null;
	}
	steamFunctions.shutdown();
	steamFunctions = null;
}


//==============================================================================
// 한 프레임. (스팀 신호를 꺼내 나눠 줍니다, 자주 부릅니다)
//
// 수동 디스패치라 꺼낸 신호는 반드시 놓아 줍니다. 이 게임이 쓰지 않는 신호는 꺼내서 그대로 놓습니다.
//==============================================================================
function runSteamFrame() {
	if (steamFunctions === null) {
		return;
	}
	steamFunctions.manualDispatchRunFrame(steamPipe);
	const callbackMessage = {};
	while (steamFunctions.manualDispatchGetNextCallback(steamPipe, callbackMessage)) {
		if (callbackMessage.callbackId === CALLBACK_GAME_OVERLAY_ACTIVATED && overlayListener !== null) {
			// GameOverlayActivated_t 의 첫 바이트(m_bActive)가 열렸는지입니다.
			const activeValue = koffi.decode(callbackMessage.parameter, "uint8_t");
			overlayListener(activeValue !== 0);
		}
		steamFunctions.manualDispatchFreeLastCallback(steamPipe);
	}
}


//==============================================================================
// 스팀 오버레이가 열리고 닫힐 때 부를 것. (true 면 열림)
//==============================================================================
/**
 * @param { function(boolean): void } listener
 */
function setOverlayListener(listener) {
	overlayListener = listener;
}


//==============================================================================
// 스팀이 정한 게임 언어. (스팀 API 의 언어 코드)
//==============================================================================
/**
 * @returns { string }
 */
function readGameLanguage() {
	if (steamFunctions === null) {
		return "";
	}
	const gameLanguage = steamFunctions.getCurrentGameLanguage(appsInterface);
	return typeof gameLanguage === "string" ? gameLanguage : "";
}


//==============================================================================
// 업적 열기. (스팀웍스에 등록한 업적의 API 이름, 열고 스팀에 올렸는지)
//==============================================================================
/**
 * @param { string } achievementId
 * @returns { boolean }
 */
function unlockAchievement(achievementId) {
	if (steamFunctions === null) {
		return false;
	}
	const isSet = steamFunctions.setAchievement(userStatsInterface, achievementId);
	if (!isSet) {
		// 스팀이 아직 지금 값을 보내 주지 않았습니다. 다시 청해 두고, 게임이 다음에 다시 열면 됩니다.
		steamFunctions.requestCurrentStats(userStatsInterface);
		return false;
	}
	return steamFunctions.storeStats(userStatsInterface);
}


//==============================================================================
// 스팀 클라우드를 쓸 수 있는지. (사용자의 계정 설정과 이 게임의 설정 둘 다 켜져 있음)
//==============================================================================
/**
 * @returns { boolean }
 */
function isCloudEnabled() {
	if (steamFunctions === null) {
		return false;
	}
	const isAccountEnabled = steamFunctions.isCloudEnabledForAccount(remoteStorageInterface);
	const isAppEnabled = steamFunctions.isCloudEnabledForApp(remoteStorageInterface);
	return isAccountEnabled && isAppEnabled;
}


//==============================================================================
// 스팀 클라우드의 파일 읽기. (UTF-8 글, 없으면 null)
//==============================================================================
/**
 * @param { string } fileName
 * @returns { string | null }
 */
function readCloudFile(fileName) {
	if (steamFunctions === null) {
		return null;
	}
	const isExisting = steamFunctions.fileExists(remoteStorageInterface, fileName);
	if (!isExisting) {
		return null;
	}
	const fileSize = steamFunctions.getFileSize(remoteStorageInterface, fileName);
	const fileData = Buffer.alloc(fileSize);
	const readSize = steamFunctions.fileRead(remoteStorageInterface, fileName, fileData, fileSize);
	if (readSize !== fileSize) {
		throw new Error("FileRead " + readSize + " / " + fileSize);
	}
	return fileData.toString("utf8");
}


//==============================================================================
// 스팀 클라우드에 파일 쓰기. (UTF-8 글, 썼는지)
//==============================================================================
/**
 * @param { string } fileName
 * @param { string } text
 * @returns { boolean }
 */
function writeCloudFile(fileName, text) {
	if (steamFunctions === null) {
		return false;
	}
	const fileData = Buffer.from(text, "utf8");
	return steamFunctions.fileWrite(remoteStorageInterface, fileName, fileData, fileData.length);
}


//==============================================================================
// Steam Input 시작. (동작 정의 파일을 알려 주고, 그 안의 동작 묶음과 디지털 동작을 씁니다)
//
// 동작 정의 파일(액션 매니페스트)은 게임 폴더에 함께 실린 것을 절대 경로로 알려 줍니다. 그 파일이 패드 종류마다
// 공식 배치 파일을 가리킵니다. 입력 갱신(RunFrame)은 readInputState() 가 직접 부릅니다.
//==============================================================================
/**
 * @param { string } manifestPath 동작 정의 파일의 절대 경로.
 * @param { string } actionSetName 동작 묶음 이름.
 * @param { string[] } actionNames 디지털 동작 이름들.
 * @returns { boolean } 시작했는지.
 */
function startInput(manifestPath, actionSetName, actionNames) {
	if (steamFunctions === null) {
		return false;
	}
	const input = steamFunctions.input();
	const isInitialized = steamFunctions.inputInit(input, true);
	if (!isInitialized) {
		return false;
	}
	const isManifestSet = steamFunctions.setInputActionManifestFilePath(input, manifestPath);
	if (!isManifestSet) {
		console.log("[steam] 동작 정의 파일을 알리지 못했습니다: " + manifestPath);
	}
	inputInterface = input;
	inputActionSetName = actionSetName;
	inputActionSetHandle = 0n;
	inputActionNames = actionNames.slice();
	inputActionHandles = actionNames.map(() => {
		return 0n;
	});
	return true;
}


//==============================================================================
// 동작 묶음과 동작의 번호를 스팀에게 묻습니다. (스팀이 구성을 읽기 전에는 0 이라 다 받을 때까지 매번 묻습니다)
//==============================================================================
/**
 * @returns { boolean } 다 받았는지.
 */
function resolveInputHandles() {
	if (inputActionSetHandle === 0n) {
		const actionSetHandle = steamFunctions.getActionSetHandle(inputInterface, inputActionSetName);
		inputActionSetHandle = BigInt(actionSetHandle);
	}
	let isResolved = inputActionSetHandle !== 0n;
	for (let actionIndex = 0; actionIndex < inputActionNames.length; ++actionIndex) {
		if (inputActionHandles[actionIndex] !== 0n) {
			continue;
		}
		const actionName = inputActionNames[actionIndex];
		const actionHandle = steamFunctions.getDigitalActionHandle(inputInterface, actionName);
		inputActionHandles[actionIndex] = BigInt(actionHandle);
		if (inputActionHandles[actionIndex] === 0n) {
			isResolved = false;
		}
	}
	return isResolved;
}


//==============================================================================
// 지금 눌린 동작. (모든 패드를 합칩니다)
//
// { pressed: { 동작 이름: true }, isPlayStation } 이고, isPlayStation 은 누르고 있는 패드가 플레이스테이션 패드인지입니다.
// Steam Input 을 시작하지 않았으면 null 입니다. 스팀이 그 패드를 Steam Input 으로 넘기지 않으면(PC 에서 사용자가
// 엑스박스, PS 패드의 Steam Input 을 켜지 않음) 여기는 비고, 그 패드는 크롬의 게임패드 읽기로 들어옵니다.
//==============================================================================
/**
 * @returns { object | null }
 */
function readInputState() {
	if (steamFunctions === null || inputInterface === null) {
		return null;
	}
	steamFunctions.inputRunFrame(inputInterface, false);
	const inputState = { pressed: {}, isPlayStation: false };
	const isResolved = resolveInputHandles();
	if (!isResolved) {
		return inputState;
	}
	steamFunctions.activateActionSet(inputInterface, INPUT_HANDLE_ALL_CONTROLLERS, inputActionSetHandle);
	const controllerHandles = Buffer.alloc(8 * INPUT_MAX_COUNT);
	const controllerCount = steamFunctions.getConnectedControllers(inputInterface, controllerHandles);
	for (let controllerIndex = 0; controllerIndex < controllerCount; ++controllerIndex) {
		const controllerHandle = controllerHandles.readBigUInt64LE(controllerIndex * 8);
		let isControllerPressed = false;
		for (let actionIndex = 0; actionIndex < inputActionNames.length; ++actionIndex) {
			const actionHandle = inputActionHandles[actionIndex];
			const actionData = steamFunctions.getDigitalActionData(inputInterface, controllerHandle, actionHandle);
			if (actionData.state) {
				const actionName = inputActionNames[actionIndex];
				inputState.pressed[actionName] = true;
				isControllerPressed = true;
			}
		}
		if (isControllerPressed) {
			const inputType = steamFunctions.getInputTypeForHandle(inputInterface, controllerHandle);
			inputState.isPlayStation = PLAYSTATION_INPUT_TYPES.includes(inputType);
		}
	}
	return inputState;
}


//==============================================================================
// Electron 에서 스팀 오버레이 켜기. (앱이 준비되기 전에 부릅니다)
//
// 스팀 오버레이는 게임의 그리기에 덧그려집니다. 크롬이 GPU 를 따로 돌리거나 다이렉트 컴포지션으로 합성하면 오버레이가 끼어들
// 자리가 없어, 그 둘을 끄고 창이 늘 다시 그려지게 합니다.
//==============================================================================
/**
 * @param { object } electronApp Electron 의 app.
 */
function enableElectronOverlay(electronApp) {
	electronApp.commandLine.appendSwitch("in-process-gpu");
	electronApp.commandLine.appendSwitch("disable-direct-composition");
	electronApp.on("browser-window-created", (event, browserWindow) => {
		const repaintTimer = setInterval(() => {
			if (browserWindow.isDestroyed()) {
				clearInterval(repaintTimer);
				return;
			}
			const isPainting = browserWindow.webContents.isPainting();
			if (!isPainting) {
				browserWindow.webContents.invalidate();
			}
		}, OVERLAY_REPAINT_MILLISECONDS);
	});
}


module.exports = {
	initSteam,
	shutdownSteam,
	runSteamFrame,
	setOverlayListener,
	readGameLanguage,
	unlockAchievement,
	isCloudEnabled,
	readCloudFile,
	writeCloudFile,
	startInput,
	readInputState,
	enableElectronOverlay,
};
