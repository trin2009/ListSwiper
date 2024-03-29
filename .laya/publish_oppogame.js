// v1.0.0
// publish 2.x 也是用这个文件，需要做兼容
let isPublish2 = process.argv[2].includes("publish_oppogame.js") && process.argv[3].includes("--evn=publish2");
// 获取Node插件和工作路径
let ideModuleDir, workSpaceDir;
if (isPublish2) {
	//是否使用IDE自带的node环境和插件，设置false后，则使用自己环境(使用命令行方式执行)
	const useIDENode = process.argv[0].indexOf("LayaAir") > -1 ? true : false;
	ideModuleDir = useIDENode ? process.argv[1].replace("gulp\\bin\\gulp.js", "").replace("gulp/bin/gulp.js", "") : "";
	workSpaceDir = useIDENode ? process.argv[2].replace("--gulpfile=", "").replace("\\.laya\\publish_oppogame.js", "").replace("/.laya/publish_oppogame.js", "") + "/" : "./../";
} else {
	ideModuleDir = global.ideModuleDir;
	workSpaceDir = global.workSpaceDir;
}

//引用插件模块
const gulp = require(ideModuleDir + "gulp");
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const del = require(ideModuleDir + "del");
let commandSuffix = ".cmd";

let prevTasks = ["packfile"];
if (isPublish2) {
	prevTasks = "";
}

let 
    config,
	platform,
	releaseDir,
    toolkitPath,
    tempReleaseDir, // OPPO临时拷贝目录
	projDir; // OPPO快游戏工程目录
// 创建OPPO项目前，拷贝OPPO引擎库、修改index.js
// 应该在publish中的，但是为了方便发布2.0及IDE 1.x，放在这里修改
gulp.task("preCreate_OPPO", prevTasks, function() {
	if (isPublish2) {
		let pubsetPath = path.join(workSpaceDir, ".laya", "pubset.json");
		let content = fs.readFileSync(pubsetPath, "utf8");
		let pubsetJson = JSON.parse(content);
		platform = "oppogame";
		releaseDir = path.join(workSpaceDir, "release", platform).replace(/\\/g, "/");
		releaseDir = tempReleaseDir = path.join(releaseDir, "temprelease");
		config = pubsetJson[5]; // 只用到了 config.oppoInfo|config.oppoSign
	} else {
		platform = global.platform;
		releaseDir = global.releaseDir;
		tempReleaseDir = global.tempReleaseDir;
		config = global.config;
	}
    toolkitPath = path.join(ideModuleDir, "../", "out", "layarepublic", "oppo", "quickgame-toolkit");
	// 如果不是OPPO快游戏
	if (platform !== "oppogame") {
		return;
	}
	if (process.platform === "darwin") {
		commandSuffix = "";
	}
	let copyLibsList = [`${workSpaceDir}/bin/libs/laya.quickgamemini.js`];
	var stream = gulp.src(copyLibsList, { base: `${workSpaceDir}/bin` });
	return stream.pipe(gulp.dest(tempReleaseDir));
});

// 新建OPPO项目-OPPO项目与其他项目不同，需要安装OPPO quickgame node_modules，并打包成.rpk文件
gulp.task("installModules_OPPO", ["preCreate_OPPO"], function() {
	// 如果不是OPPO快游戏
	if (platform !== "oppogame") {
		return;
	}
	releaseDir = path.dirname(releaseDir);
	projDir = path.join(releaseDir, config.oppoInfo.projName);
    // 如果IDE里对应OPPO包已经install node_modules了，忽略这一步
    if (fs.existsSync(path.join(toolkitPath, "node_modules"))) {
        return;
    }
	// 安装OPPO quickgame node_modules
	return new Promise((resolve, reject) => {
		console.log("开始安装OPPO quickgame node_modules，请耐心等待...");
		let cmd = `npm${commandSuffix}`;
		let args = ["install"];
        
        let cp = childProcess.spawn(cmd, args, {
            cwd: toolkitPath
        });
        
		cp.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
		});
		
		cp.stderr.on('data', (data) => {
			console.log(`stderr: ${data}`);
			// reject();
		});
		
		cp.on('close', (code) => {
			console.log(`子进程退出码：${code}`);
			resolve();
		});
	});
});

// 拷贝文件到OPPO快游戏
gulp.task("copyFileToProj_OPPO", ["installModules_OPPO"], function() {
	// 如果不是OPPO快游戏
	if (platform !== "oppogame") {
		return;
	}
	// 将临时文件夹中的文件，拷贝到项目中去
	let originalDir = `${tempReleaseDir}/**/*.*`;
	let stream = gulp.src(originalDir);
	return stream.pipe(gulp.dest(path.join(projDir)));
});

// 拷贝icon到OPPO快游戏
gulp.task("copyIconToProj_OPPO", ["copyFileToProj_OPPO"], function() {
	// 如果不是OPPO快游戏
	if (platform !== "oppogame") {
		return;
	}
	let originalDir = config.oppoInfo.icon;
	let stream = gulp.src(originalDir);
	return stream.pipe(gulp.dest(path.join(projDir)));
});

// 清除OPPO快游戏临时目录
gulp.task("clearTempDir_OPPO", ["copyIconToProj_OPPO"], function() {
	// 如果不是OPPO快游戏
	if (platform !== "oppogame") {
		return;
	}
	// 删掉临时目录
	return del([tempReleaseDir], { force: true });
});

// 生成release签名(私钥文件 private.pem 和证书文件 certificate.pem )
gulp.task("generateSign_OPPO", ["clearTempDir_OPPO"], function() {
	// 如果不是OPPO快游戏
	if (platform !== "oppogame") {
		return;
    }
    if (!config.oppoSign.generateSign) {
        return;
    }
	// https://doc.quickapp.cn/tools/compiling-tools.html
	return new Promise((resolve, reject) => {
		let cmd = "openssl";
		let args = ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "private.pem", 
					"-x509", "-days", "3650", "-out", "certificate.pem"];
		let opts = {
			cwd: projDir,
			shell: true
		};
		let cp = childProcess.spawn(cmd, args, opts);
		cp.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
		});

		cp.stderr.on('data', (data) => {
			console.log(`stderr: ${data}`);
			data += "";
			if (data.includes("Country Name")) {
				cp.stdin.write(`${config.oppoSign.countryName}\n`);
				console.log(`Country Name: ${config.oppoSign.countryName}`);
			} else if (data.includes("Province Name")) {
				cp.stdin.write(`${config.oppoSign.provinceName}\n`);
				console.log(`Province Name: ${config.oppoSign.provinceName}`);
			} else if (data.includes("Locality Name")) {
				cp.stdin.write(`${config.oppoSign.localityName}\n`);
				console.log(`Locality Name: ${config.oppoSign.localityName}`);
			} else if (data.includes("Organization Name")) {
				cp.stdin.write(`${config.oppoSign.orgName}\n`);
				console.log(`Organization Name: ${config.oppoSign.orgName}`);
			} else if (data.includes("Organizational Unit Name")) {
				cp.stdin.write(`${config.oppoSign.orgUnitName}\n`);
				console.log(`Organizational Unit Name: ${config.oppoSign.orgUnitName}`);
			} else if (data.includes("Common Name")) {
				cp.stdin.write(`${config.oppoSign.commonName}\n`);
				console.log(`Common Name: ${config.oppoSign.commonName}`);
			} else if (data.includes("Email Address")) {
				cp.stdin.write(`${config.oppoSign.emailAddr}\n`);
				console.log(`Email Address: ${config.oppoSign.emailAddr}`);
				// cp.stdin.end();
			}
			// reject();
		});

		cp.on('close', (code) => {
			console.log(`子进程退出码：${code}`);
			resolve();
		});
	});
});

// 拷贝sign文件到指定位置
gulp.task("copySignFile_OPPO", ["generateSign_OPPO"], function() {
	// 如果不是OPPO快游戏
	if (platform !== "oppogame") {
		return;
    }
    if (config.oppoSign.generateSign) { // 新生成的签名
        // 移动签名文件到项目中（Laya & OPPO快游戏项目中）
        let 
            privatePem = path.join(projDir, "private.pem"),
            certificatePem = path.join(projDir, "certificate.pem");
        let isSignExits = fs.existsSync(privatePem) && fs.existsSync(certificatePem);
        if (!isSignExits) {
            return;
        }
        let 
            xiaomiDest = `${projDir}/sign/release`,
            layaDest = `${workSpaceDir}/sign/release`;
        let stream = gulp.src([privatePem, certificatePem]);
        return stream.pipe(gulp.dest(xiaomiDest))
                    .pipe(gulp.dest(layaDest));
    } else if (config.oppoInfo.useReleaseSign && !config.oppoSign.generateSign) { // 使用release签名，并且没有重新生成
        // 从项目中将签名拷贝到OPPO快游戏项目中
        let 
            privatePem = path.join(workSpaceDir, "sign", "release", "private.pem"),
            certificatePem = path.join(workSpaceDir, "sign", "release", "certificate.pem");
        let isSignExits = fs.existsSync(privatePem) && fs.existsSync(certificatePem);
        if (!isSignExits) {
            return;
        }
        let 
            xiaomiDest = `${projDir}/sign/release`;
        let stream = gulp.src([privatePem, certificatePem]);
        return stream.pipe(gulp.dest(xiaomiDest));
    }
});

gulp.task("deleteSignFile_OPPO", ["copySignFile_OPPO"], function() {
	// 如果不是OPPO快游戏
	if (platform !== "oppogame") {
		return;
	}
	if (config.oppoSign.generateSign) { // 新生成的签名
		let 
            privatePem = path.join(projDir, "private.pem"),
            certificatePem = path.join(projDir, "certificate.pem");
		return del([privatePem, certificatePem], { force: true });
	}
});

gulp.task("modifyFile_OPPO", ["deleteSignFile_OPPO"], function() {
	// 如果不是OPPO快游戏
	if (platform !== "oppogame") {
		return;
	}
	// 修改manifest.json文件
	let manifestPath = path.join(projDir, "manifest.json");
	let IDEManifestPath = path.join(toolkitPath, "tpl", "manifest.json");
	if (!fs.existsSync(IDEManifestPath)) {
		return;
	}
	let manifestContent = fs.readFileSync(IDEManifestPath, "utf8");
	let manifestJson = JSON.parse(manifestContent);
	manifestJson.package = config.oppoInfo.package;
	manifestJson.name = config.oppoInfo.name;
	manifestJson.orientation = config.oppoInfo.orientation;
	manifestJson.versionName = config.oppoInfo.versionName;
	manifestJson.versionCode = config.oppoInfo.versionCode;
	manifestJson.minPlatformVersion = config.oppoInfo.minPlatformVersion;
	manifestJson.icon = `./${path.basename(config.oppoInfo.icon)}`;
	if (config.oppoInfo.subpack) {
		manifestJson.subpackages = config.oppoSubpack;
	}
	fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 4), "utf8");

	// OPPO项目，修改main.js
	let filePath = path.join(projDir, "main.js");
	// 这个地方，1.x IDE和2.x IDE 不一致
	let fileContent = `window.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 6 Build/LYZ28E) AppleWebKit/603.1.30 (KHTML, like Gecko) Mobile/14E8301 OPPO MiniGame NetType/WIFI Language/zh_CN';
require("./libs/laya.quickgamemini.js");\nrequire("index.js");`;
	fs.writeFileSync(filePath, fileContent, "utf8");

	// OPPO项目，修改index.js
	let indexFilePath = path.join(projDir, "index.js");
	if (!fs.existsSync(indexFilePath)) {
		return;
	}
	let indexFileContent = fs.readFileSync(indexFilePath, "utf8");
	indexFileContent = indexFileContent.replace(/loadLib(\(['"])/gm, "require$1./");
	fs.writeFileSync(indexFilePath, indexFileContent, "utf8");
});

// 打包rpk
gulp.task("buildRPK_OPPO", ["modifyFile_OPPO"], function() {
	// 如果不是OPPO快游戏
	if (platform !== "oppogame") {
		return;
	}
	// 在OPPO轻游戏项目目录中执行:
    // quickgame pack || quickgame pack release
    // quickgame subpack || quickgame subpack release
	let cmdStr = "";
	let packStr = "pack";
	if (config.oppoInfo.subpack) {
		packStr = "subpack";
	}
    if (config.oppoInfo.useReleaseSign) {
        cmdStr = "release";
    }
	return new Promise((resolve, reject) => {
		let cmd = path.join(toolkitPath, "lib", "bin", `quickgame${commandSuffix}`);
		let args = [packStr, cmdStr];
		let opts = {
			cwd: projDir
		};
		let cp = childProcess.spawn(cmd, args, opts);
		// let cp = childProcess.spawn('npx.cmd', ['-v']);
		cp.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
		});

		cp.stderr.on('data', (data) => {
			console.log(`stderr: ${data}`);
			// reject();
		});

		cp.on('close', (code) => {
			console.log(`子进程退出码：${code}`);
			resolve();
		});
	});
});

gulp.task("pushRPK_OPPO", ["buildRPK_OPPO"], function() {
	// 如果不是OPPO快游戏
	if (platform !== "oppogame") {
		return;
	}
	if (!config.oppoInfo.oppoDebug) {
        return;
    }
	// 在OPPO轻游戏项目目录中执行:
    // adb push dist/game.rpk sdcard/games
	// adb push idePath/resources/app/out/layarepublic/oppo/instant_app_settings.properties
	// adb shell am start -n com.nearme.instant.platform/com.oppo.autotest.main.InstantAppActivity
	return new Promise((resolve, reject) => {
		let cmd = "adb";
		let sdGamesPath = config.oppoInfo.subpack ? "sdcard/subPkg" : "sdcard/games";
		let args = ["push", `dist/${config.oppoInfo.package}${config.oppoInfo.useReleaseSign ? ".signed" : ""}.rpk`, sdGamesPath];
		let opts = {
			cwd: projDir
		};
		let cp = childProcess.spawn(cmd, args, opts);
		// let cp = childProcess.spawn('npx.cmd', ['-v']);
		cp.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
		});

		cp.stderr.on('data', (data) => {
			console.log(`stderr: ${data}`);
			// reject();
		});

		cp.on('close', (code) => {
			console.log(`1) push_RPK 子进程退出码：${code}`);
			resolve();
		});
	}).then(() => {
		return new Promise((resolve, reject) => {
			let cmd = "adb";
			let args = ["push", path.join(ideModuleDir, "../", `/out/layarepublic/oppo/instant_app_settings.properties`), "sdcard/"];
			let opts = {
				cwd: projDir
			};
			let cp = childProcess.spawn(cmd, args, opts);
			// let cp = childProcess.spawn('npx.cmd', ['-v']);
			cp.stdout.on('data', (data) => {
				console.log(`stdout: ${data}`);
			});
	
			cp.stderr.on('data', (data) => {
				console.log(`stderr: ${data}`);
				// reject();
			});
	
			cp.on('close', (code) => {
				console.log(`2) push_RPK 子进程退出码：${code}`);
				resolve();
			});
		});
	}).then(() => {
		return new Promise((resolve, reject) => {
			let cmd = "adb";
			let args = ["shell", "am", "start", "-n", "com.nearme.instant.platform/com.oppo.autotest.main.InstantAppActivity"];
			let opts = {
				cwd: projDir
			};
			let cp = childProcess.spawn(cmd, args, opts);
			// let cp = childProcess.spawn('npx.cmd', ['-v']);
			cp.stdout.on('data', (data) => {
				console.log(`stdout: ${data}`);
			});
	
			cp.stderr.on('data', (data) => {
				console.log(`stderr: ${data}`);
				// reject();
			});
	
			cp.on('close', (code) => {
				console.log(`3) push_RPK 子进程退出码：${code}`);
				resolve();
			});
		});
	});
});

gulp.task("buildOPPOProj", ["pushRPK_OPPO"], function() {
	console.log("all tasks completed");
});