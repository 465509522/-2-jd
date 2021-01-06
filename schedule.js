/*
    用于需要短时间多次运行的脚本执行
    会在任务结束前两分钟通过webhook的方式继续唤醒新的脚本以防止中断的情况出现
    理论上只需要手动运行一次即可长久地运行下去

    如果是直接运行远程的文件,则需要自行在对应yaml文件中配置对应的env参数

    请勿滥用,脚本暂未测试
*/

const exec = require("child_process").execSync;
const cron = require("node-cron");
const axios = require("axios");
const fs = require("fs");

//#region 全局变量
let ACTIONS_TRIGGER_TOKEN = process.env.ACTIONS_TRIGGER_TOKEN; //Personal access tokens，申请教程:https://www.jianshu.com/p/bb82b3ad1d11 记得勾选repo权限就行
let TRIGGER_KEYWORDS = process.env.TRIGGER_KEYWORDS || "schedule"; //.github/workflows/路径里面yml文件里面repository_dispatch项目的types值，例如jd_fruit.yml里面的值为fruit
let GITHUBUSER = process.env.GITHUBUSER; //github用户名，例:lxk0301
let REPO = process.env.REPO; //需要触发的 Github Action 所在的仓库名称 例:scripts
let RUN_END_TIME = new Date().getTime() + 1000 * 60 * 358; //用于记录脚本结束时间
//#endregion

//#region 需要自行配置执行的地方

var my_schedule = cron.schedule("* 2 * * *", () => {
    //每次运行前,检测之前的是否存在,存在的话则清理掉
    if(my_schedule) my_schedule.stop();
    await download("https://github.com/lxk0301/jd_scripts/raw/master/jd_fruit.js", "./jd_fruit.js", "指定要执行的js文件");
    //执行此文件需要配置JD_COOKIE这个secret,并且在yaml中添加此项
    await exec("node ./jd_fruit.js", { stdio: "inherit" });
});

//#endregion

//#region Github Actions持续唤醒
//一个每半分钟执行一次的job,用于判断是否即将到达执行超时时间

var rebirth = cron.schedule("0/30 * * * * *", () => {
    var now_time = new Date().getTime();
    if (now_time >= RUN_END_TIME) {
        hook(TRIGGER_KEYWORDS).then((res) => {
            if (res == 1) {
                //stop this schedule and kill the process
                hook(TRIGGER_KEYWORDS);
                rebirth.stop();
            } else {
                console.log("尝试唤醒新的脚本失败,稍后可能会进行重试");
            }
        });
    }
});

function hook(event_type) {
    const options = {
        url: `https://api.github.com/repos/${GITHUBUSER}/${REPO}/dispatches`,
        body: `${JSON.stringify({ event_type: event_type })}`,
        headers: {
            Accept: "application/vnd.github.everest-preview+json",
            Authorization: `token ${ACTIONS_TRIGGER_TOKEN}`,
        },
    };
    return new Promise((resolve) => {
        const { url, ..._opts } = options;
        require("got")
            .post(url, _opts)
            .then(
                (resp) => {
                    // const { statusCode: status, statusCode, headers, body } = resp;
                    // callback(null, { status, statusCode, headers, body }, body);
                    console.log(`触发[${event_type}]成功`);
                    resolve(1);
                },
                (err) => {
                    const { message: error, response: resp } = err;
                    // callback(error, resp, resp && resp.body);
                    var data = resp && resp.body;
                    if (data && data.match("404")) {
                        console.log(`触发[${event_type}]失败,请仔细检查提供的参数`);
                        resolve(2);
                    } else if (data && data.match("401")) {
                        console.log(`触发[${event_type}]失败,github token权限不足`);
                        resolve(3);
                    } else {
                        console.log("失败", `${JSON.stringify(error)}`);
                        resolve(4);
                    }
                }
            );
    });
}

//#endregion

async function download(url, path, target) {
    let response = await axios.get(url);
    let fcontent = response.data;
    await fs.writeFileSync(path, fcontent, "utf8");
    console.log(`下载${target}完毕`);
}
