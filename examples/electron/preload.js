//==============================================================================
// Electron 에서 쓰는 예제. (게임 창의 앞단)
//
// 스팀에 붙었을 때만 window.steamBridge 를 엽니다. 게임 코드는 이것만 부릅니다.
//   readPadState()           Steam Input 의 지금 동작. ({ pressed: { 동작 이름: true }, isPlayStation }, 없으면 null)
//   addOverlayListener(fn)   스팀 오버레이가 열리고 닫힐 때. (true 면 열림)
//   getGameLanguage()        스팀의 게임 언어. ("koreana", "english" 같은 것)
//   unlockAchievement(id)    업적 열기.
//   cloudRead(name), cloudWrite(name, text)   스팀 클라우드.
//==============================================================================
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

const isSteamReady = ipcRenderer.sendSync("steam:isReady");
if (isSteamReady) {
	let padState = null;
	ipcRenderer.on("steam:padState", (event, state) => {
		padState = state;
	});
	const overlayListeners = [];
	ipcRenderer.on("steam:overlay", (event, isActive) => {
		for (const overlayListener of overlayListeners) {
			overlayListener(isActive);
		}
	});
	contextBridge.exposeInMainWorld("steamBridge", {
		readPadState: () => {
			return padState;
		},
		addOverlayListener: (listener) => {
			overlayListeners.push(listener);
		},
		getGameLanguage: () => {
			return ipcRenderer.sendSync("steam:gameLanguage");
		},
		unlockAchievement: (achievementId) => {
			return ipcRenderer.invoke("steam:unlockAchievement", achievementId);
		},
		cloudRead: (fileName) => {
			return ipcRenderer.invoke("steam:cloudRead", fileName);
		},
		cloudWrite: (fileName, text) => {
			return ipcRenderer.invoke("steam:cloudWrite", fileName, text);
		},
	});
}
