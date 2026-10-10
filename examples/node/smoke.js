//==============================================================================
// 스팀에 붙어 보는 가장 짧은 예제. (Node.js)
//
// 스팀이 켜져 있어야 합니다. 이 폴더에 스팀웍스 SDK 의 redistributable_bin/win64/steam_api64.dll 을 두고 칩니다.
//   node examples/node/smoke.js 480
// 480 은 밸브가 시험용으로 열어 둔 앱(Spacewar)입니다. 자기 앱 번호를 넣으면 그 앱으로 붙습니다.
//==============================================================================
"use strict";
const path = require("path");
const steamApi = require("../../steam_api64.js");

const appId = Number(process.argv[2] || 480);
const libraryPath = path.join(__dirname, "steam_api64.dll");

steamApi.initSteam(appId, libraryPath);
console.log("게임 언어:", steamApi.readGameLanguage());
console.log("클라우드:", steamApi.isCloudEnabled());

steamApi.setOverlayListener((isActive) => {
	console.log("오버레이:", isActive ? "열림" : "닫힘");
});

// 스팀 신호는 자주 꺼내야 합니다. 3 초 동안 초에 60 번 꺼내고 끝냅니다.
let frameCount = 0;
const frameTimer = setInterval(() => {
	steamApi.runSteamFrame();
	frameCount += 1;
	if (frameCount >= 180) {
		clearInterval(frameTimer);
		steamApi.shutdownSteam();
		console.log("끝");
	}
}, 1000 / 60);
