const axios = require("axios");
const fs = require("fs");
const replacements = [];
var remoteContent;
async function init(content) {
    remoteContent = content;
    await inject();
    return batchReplace(remoteContent);
}
//#region 注入代码
async function inject() {
    await inject_jd();
}

async function inject_jd() {
    if (!process.env.JD_COOKIE) return;
    if (remoteContent.indexOf("function requireConfig()") >= 0 && remoteContent.indexOf("jd_bean_sign.js") >= 0) {
        replacements.push({
            key: "resultPath = err ? '/tmp/result.txt' : resultPath;",
            value: `resultPath = err ? './tmp/result.txt' : resultPath;`,
        });
        replacements.push({
            key: "JD_DailyBonusPath = err ? '/tmp/JD_DailyBonus.js' : JD_DailyBonusPath;",
            value: `JD_DailyBonusPath = err ? './tmp/JD_DailyBonus.js' : JD_DailyBonusPath;`,
        });
        replacements.push({
            key: "outPutUrl = err ? '/tmp/' : outPutUrl;",
            value: `outPutUrl = err ? './tmp/' : outPutUrl;`,
        });
    }
    ignore_jd();
    await downloader_jd();
    await downloader_notify();
    await downloader_user_agents();
}

function ignore_jd() {
    // 京喜农场禁用部分Cookie，以避免被频繁通知需要去种植啥的
    if (process.env.IGNORE_COOKIE_JXNC) {
        try {
            var ignore_indexs = JSON.parse(process.env.IGNORE_COOKIE_JXNC);
            var ignore_names = [];
            ignore_indexs.forEach((it) => {
                if (it == 1) {
                    ignore_names.push("CookieJD");
                } else {
                    ignore_names.push("CookieJD" + it);
                }
            });
            replacements.push({
                key: "if (jdCookieNode[item]) {",
                value: `if (jdCookieNode[item] && ${JSON.stringify(ignore_names)}.indexOf(item) == -1) {`,
            });
            console.log(`IGNORE_COOKIE_JXNC已生效，将为您禁用${ignore_names}`);
        } catch (e) {
            console.log("IGNORE_COOKIE_JXNC填写有误,不禁用任何Cookie");
        }
    }
    // 京喜工厂禁用部分Cookie，以避免被频繁通知需要去种植啥的
    if (process.env.IGNORE_COOKIE_JXGC) {
        try {
            var ignore_indexs = JSON.parse(process.env.IGNORE_COOKIE_JXGC);
            var ignore_names = [];
            ignore_indexs.forEach((it) => {
                if (it == 1) {
                    ignore_names.push("CookieJD");
                } else {
                    ignore_names.push("CookieJD" + it);
                }
            });
            replacements.push({
                key: "cookiesArr.push(jdCookieNode[item])",
                value: `if (jdCookieNode[item] && ${JSON.stringify(
                    ignore_names
                )}.indexOf(item) == -1) cookiesArr.push(jdCookieNode[item])`,
            });
            console.log(`IGNORE_COOKIE_JXNC已生效，将为您禁用${ignore_names}`);
        } catch (e) {
            console.log("IGNORE_COOKIE_JXNC填写有误,不禁用任何Cookie");
        }
    }
    // 口袋书店禁用部分Cookie
    if (process.env.IGNORE_COOKIE_BOOKSHOP) {
        try {
            var ignore_indexs = JSON.parse(process.env.IGNORE_COOKIE_BOOKSHOP);
            var ignore_names = [];
            ignore_indexs.forEach((it) => {
                if (it == 1) {
                    ignore_names.push("CookieJD");
                } else {
                    ignore_names.push("CookieJD" + it);
                }
            });
            replacements.push({
                key: "cookiesArr.push(jdCookieNode[item])",
                value: `if (jdCookieNode[item] && ${JSON.stringify(
                    ignore_names
                )}.indexOf(item) == -1) cookiesArr.push(jdCookieNode[item])`,
            });
            console.log(`IGNORE_COOKIE_BOOKSHOP已生效，将为您禁用${ignore_names}`);
        } catch (e) {
            console.log("IGNORE_COOKIE_BOOKSHOP填写有误,不禁用任何Cookie");
        }
    }
    // 京东农场禁用部分Cookie
    if (process.env.IGNORE_COOKIE_JDNC) {
        try {
            var ignore_indexs = JSON.parse(process.env.IGNORE_COOKIE_JDNC);
            var ignore_names = [];
            ignore_indexs.forEach((it) => {
                if (it == 1) {
                    ignore_names.push("CookieJD");
                } else {
                    ignore_names.push("CookieJD" + it);
                }
            });
            replacements.push({
                key: "cookiesArr.push(jdCookieNode[item])",
                value: `if (jdCookieNode[item] && ${JSON.stringify(
                    ignore_names
                )}.indexOf(item) == -1) cookiesArr.push(jdCookieNode[item])`,
            });
            console.log(`IGNORE_COOKIE_JDNC已生效，将为您禁用${ignore_names}`);
        } catch (e) {
            console.log("IGNORE_COOKIE_JDNC填写有误,不禁用任何Cookie");
        }
    }
    // 京东工厂禁用部分Cookie
    if (process.env.IGNORE_COOKIE_JDGC) {
        try {
            var ignore_indexs = JSON.parse(process.env.IGNORE_COOKIE_JDGC);
            var ignore_names = [];
            ignore_indexs.forEach((it) => {
                if (it == 1) {
                    ignore_names.push("CookieJD");
                } else {
                    ignore_names.push("CookieJD" + it);
                }
            });
            replacements.push({
                key: "cookiesArr.push(jdCookieNode[item])",
                value: `if (jdCookieNode[item] && ${JSON.stringify(
                    ignore_names
                )}.indexOf(item) == -1) cookiesArr.push(jdCookieNode[item])`,
            });
            console.log(`IGNORE_COOKIE_JDGC已生效，将为您禁用${ignore_names}`);
        } catch (e) {
            console.log("IGNORE_COOKIE_JDGC填写有误,不禁用任何Cookie");
        }
    }
}

function batchReplace() {
    for (var i = 0; i < replacements.length; i++) {
        remoteContent = remoteContent.replace(replacements[i].key, replacements[i].value);
    }
    // console.log(remoteContent);
    return remoteContent;
}
//#endregion

//#region 文件下载

async function downloader_jd() {
    if (/require\(['"`]{1}.\/jdCookie.js['"`]{1}\)/.test(remoteContent))
        await download("https://github.com/lxk0301/jd_scripts/raw/master/jdCookie.js", "./jdCookie.js", "京东Cookies");
    if (remoteContent.indexOf("jdFruitShareCodes") > 0) {
        await download(
            "https://github.com/lxk0301/jd_scripts/raw/master/jdFruitShareCodes.js",
            "./jdFruitShareCodes.js",
            "东东农场互助码"
        );
    }
    if (remoteContent.indexOf("jdPetShareCodes") > 0) {
        await download(
            "https://github.com/lxk0301/jd_scripts/raw/master/jdPetShareCodes.js",
            "./jdPetShareCodes.js",
            "京东萌宠"
        );
    }
    if (remoteContent.indexOf("jdPlantBeanShareCodes") > 0) {
        await download(
            "https://github.com/lxk0301/jd_scripts/raw/master/jdPlantBeanShareCodes.js",
            "./jdPlantBeanShareCodes.js",
            "种豆得豆互助码"
        );
    }
    if (remoteContent.indexOf("jdSuperMarketShareCodes") > 0)
        await download(
            "https://github.com/lxk0301/jd_scripts/raw/master/jdSuperMarketShareCodes.js",
            "./jdSuperMarketShareCodes.js",
            "京小超互助码"
        );
    if (remoteContent.indexOf("jdFactoryShareCodes") > 0) {
        await download(
            "https://github.com/lxk0301/jd_scripts/raw/master/jdFactoryShareCodes.js",
            "./jdFactoryShareCodes.js",
            "东东工厂互助码"
        );
    }
    if (remoteContent.indexOf("jdDreamFactoryShareCodes") > 0) {
        await download(
            "https://github.com/lxk0301/jd_scripts/raw/master/jdDreamFactoryShareCodes.js",
            "./jdDreamFactoryShareCodes.js",
            "京喜工厂互助码"
        );
    }
    if (remoteContent.indexOf("new Env('京喜农场')") > 0) {
        await download(
            "https://github.com/lxk0301/jd_scripts/raw/master/jdJxncTokens.js",
            "./jdJxncTokens.js",
            "京喜农场Token"
        );
        await download(
            "https://github.com/lxk0301/jd_scripts/raw/master/jdJxncShareCodes.js",
            "./jdJxncShareCodes.js",
            "京喜农场分享码"
        );
        await download(
            "https://github.com/lxk0301/jd_scripts/raw/master/USER_AGENTS.js",
            "./USER_AGENTS.js",
            "USER_AGENTS"
        );
    }
}

async function downloader_notify() {
    await download("https://github.com/lxk0301/jd_scripts/raw/master/sendNotify.js", "./sendNotify.js", "统一通知");
}

async function downloader_user_agents() {
    await download("https://github.com/lxk0301/jd_scripts/raw/master/USER_AGENTS.js", "./USER_AGENTS.js", "云端UA");
}

async function download(url, path, target) {
    let response = await axios.get(url);
    let fcontent = response.data;
    await fs.writeFileSync(path, fcontent, "utf8");
    console.log(`下载${target}完毕`);
}
//#endregion

module.exports = {
    inject: init,
};
