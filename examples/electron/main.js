//==============================================================================
// Electron 에서 쓰는 예제. (메인 프로세스)
//
// 스팀 SDK 는 메인 프로세스에서만 부릅니다. 게임 창에는 preload.js 가 steamBridge 로 필요한 것만 엽니다.
//   1. 앱이 준비되기 전에 스팀에 붙고 오버레이를 켭니다.
//   2. Steam Input 을 시작하고, 초에 60 번 스팀 신호와 패드 동작을 읽어 바뀌면 창에 보냅니다.
//   3. 언어, 업적, 클라우드는 창이 IPC 로 청합니다.
// steam_api64.dll 과 steam_input 폴더는 실행 파일 옆에 둡니다. (개발 중에는 이 폴더)
//==============================================================================
"use strict";
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const steamApi = require("../../steam_api64.js");

const STEAM_APP_ID = 480;
const STEAM_FRAME_MILLISECONDS = 1000 / 60;
const INPUT_ACTION_SET_NAME = "InGame";
const INPUT_ACTION_NAMES = ["up", "down", "left", "right", "confirm", "cancel"];

let isSteamReady = false;
let lastInputText = "";


//==============================================================================
// 모든 창에 보내기.
//==============================================================================
function sendToAllWindows(channel, value) {
	const allWindows = BrowserWindow.getAllWindows();
	for (const browserWindow of allWindows) {
		if (!browserWindow.isDestroyed()) {
			browserWindow.webContents.send(channel, value);
		}
	}
}


//==============================================================================
// 스팀 한 프레임. (신호를 꺼내고, 패드 동작이 바뀌었으면 창에 보냅니다)
//==============================================================================
function runSteamFrame() {
	steamApi.runSteamFrame();
	const inputState = steamApi.readInputState();
	if (inputState === null) {
		return;
	}
	const inputText = JSON.stringify(inputState);
	if (inputText === lastInputText) {
		return;
	}
	lastInputText = inputText;
	sendToAllWindows("steam:padState", inputState);
}


//==============================================================================
// 시작. (앱이 준비되기 전, 오버레이는 그 전에 켜야 합니다)
//==============================================================================
const appDirectory = app.isPackaged ? path.dirname(process.execPath) : __dirname;
try {
	steamApi.initSteam(STEAM_APP_ID, path.join(appDirectory, "steam_api64.dll"));
	steamApi.enableElectronOverlay(app);
	isSteamReady = true;
}
catch (error) {
	console.log("스팀에 붙지 못했습니다: " + error.message);
}
if (isSteamReady) {
	steamApi.startInput(path.join(appDirectory, "steam_input", "actions.vdf"), INPUT_ACTION_SET_NAME, INPUT_ACTION_NAMES);
	steamApi.setOverlayListener((isActive) => {
		sendToAllWindows("steam:overlay", isActive);
	});
	setInterval(runSteamFrame, STEAM_FRAME_MILLISECONDS);
	app.on("will-quit", () => {
		steamApi.shutdownSteam();
	});
}

ipcMain.on("steam:isReady", (event) => {
	event.returnValue = isSteamReady;
});
ipcMain.on("steam:gameLanguage", (event) => {
	event.returnValue = steamApi.readGameLanguage();
});
ipcMain.handle("steam:unlockAchievement", (event, achievementId) => {
	return steamApi.unlockAchievement(achievementId);
});
ipcMain.handle("steam:cloudRead", (event, fileName) => {
	if (!steamApi.isCloudEnabled()) {
		return null;
	}
	return steamApi.readCloudFile(fileName);
});
ipcMain.handle("steam:cloudWrite", (event, fileName, text) => {
	if (!steamApi.isCloudEnabled()) {
		return false;
	}
	return steamApi.writeCloudFile(fileName, text);
});

app.whenReady().then(() => {
	const mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, "preload.js"),
		},
	});
	mainWindow.loadFile(path.join(__dirname, "index.html"));
});
