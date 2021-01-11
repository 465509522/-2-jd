/*
    用于需要短时间多次运行的脚本执行
    会在任务结束前两分钟通过webhook的方式继续唤醒新的脚本以防止中断的情况出现
    理论上只需要手动运行一次即可长久地运行下去

    如果是直接运行远程的文件,则需要自行在对应yaml文件中配置对应的env参数

    请勿滥用,脚本暂未测试
*/

/* 配套的yaml数据

name: 自定义JOB执行

on:
    workflow_dispatch:
    schedule:
        - cron: "30 15,7 * * *" #此处的运行需要提前在定时任务前
    repository_dispatch:
        types: schedule

jobs:
    build:
        runs-on: ubuntu-latest
        if: github.event.repository.owner.id == github.event.sender.id
        steps:
            - name: 拉取代码
              uses: actions/checkout@v2
            - name: Use Node.js
              uses: actions/setup-node@v1
              with:
                  node-version: "12.x"
            - name: 安装依赖包
              run: |
                  npm install
            - name: "运行【自定义JOB执行】"
              timeout-minutes: 40 #有需要的话,可以加上这个超时时间
              run: |
                  node schedule.js
              env:
                  #推送专用
                  PUSH_KEY: ${{ github.event.client_payload.PUSH_KEY || secrets.PUSH_KEY }}
                  BARK_PUSH: ${{ github.event.client_payload.BARK_PUSH || secrets.BARK_PUSH }}
                  BARK_SOUND: ${{ github.event.client_payload.BARK_SOUND || secrets.BARK_SOUND }}
                  TG_BOT_TOKEN: ${{ github.event.client_payload.TG_BOT_TOKEN || secrets.TG_BOT_TOKEN }}
                  TG_USER_ID: ${{ github.event.client_payload.TG_USER_ID || secrets.TG_USER_ID }}
                  DD_BOT_TOKEN: ${{ github.event.client_payload.DD_BOT_TOKEN || secrets.DD_BOT_TOKEN }}
                  DD_BOT_SECRET: ${{ github.event.client_payload.DD_BOT_SECRET || secrets.DD_BOT_SECRET }}
                  IGOT_PUSH_KEY: ${{ github.event.client_payload.IGOT_PUSH_KEY || secrets.IGOT_PUSH_KEY }}
                  QQ_SKEY: ${{ github.event.client_payload.QQ_SKEY || secrets.QQ_SKEY }}
                  QQ_MODE: ${{ github.event.client_payload.QQ_MODE || secrets.QQ_MODE }}
                  PUSH_PLUS_TOKEN: ${{ github.event.client_payload.PUSH_PLUS_TOKEN || secrets.PUSH_PLUS_TOKEN }}
                  PUSH_PLUS_USER: ${{ github.event.client_payload.PUSH_PLUS_USER || secrets.PUSH_PLUS_USER }}
                  #通用配置
                  JD_COOKIE: ${{ github.event.client_payload.JD_COOKIE || secrets.JD_COOKIE }}
                  JD_DEBUG: ${{ github.event.client_payload.JD_DEBUG || secrets.JD_DEBUG }}
                  DO_NOT_FORK: ${{ github.event.client_payload.DO_NOT_FORK || secrets.DO_NOT_FORK }}
                  #GITHUB TOKEN
                  ACTIONS_TRIGGER_TOKEN: ${{ secrets.ACTIONS_TRIGGER_TOKEN }}
                  REPO: ${{ secrets.REPO }}
                  GITHUBUSER: ${{ secrets.GITHUBUSER }}
                  TRIGGER_KEYWORDS: ${{ secrets.TRIGGER_KEYWORDS }}
                  #CRONTAB
                  CRONTAB: ${{ '0 0 0,16 * * *' }} #定时在每天0和下午4点整执行一次
                  SYNCURL: https://github.com/lxk0301/jd_scripts/raw/master/jd_joy_reward.js #此处填写你要执行的js


 */

const exec = require("child_process").execSync;
const cron = require("node-cron");
const axios = require("axios");
const fs = require("fs");

//#region 全局变量

let CRONTAB = process.env.CRONTAB; //请填写五位或六位的调度命令,这里的时间使用北京时间即可

let ACTIONS_TRIGGER_TOKEN = process.env.ACTIONS_TRIGGER_TOKEN; //Personal access tokens，申请教程:https://www.jianshu.com/p/bb82b3ad1d11 记得勾选repo权限就行
let TRIGGER_KEYWORDS = process.env.TRIGGER_KEYWORDS || "schedule"; //.github/workflows/路径里面yml文件里面repository_dispatch项目的types值，例如jd_fruit.yml里面的值为fruit
let GITHUBUSER = process.env.GITHUBUSER; //github用户名，例:lxk0301
let REPO = process.env.REPO; //需要触发的 Github Action 所在的仓库名称 例:scripts

let LONG_TIME_TRIGGER = process.env.LONG_TIME_TRIGGER == "true"; //用于判断脚本是否需要长时间执行,如果不需要记得在yaml中配置timeout-minutes
let RUN_END_TIME = new Date().getTime() + 1000 * 60 * 358; //用于记录脚本结束时间,以配合LONG_TIME_TRIGGER实现持续唤醒

let REMOTE_CONTENT = "";
//#endregion

//#region 需要自行配置执行的地方

if (!CRONTAB) {
    console.log("没有配置定时命令[CRONTAB]，不执行任何操作");
    return;
}

if (!process.env.SYNCURL) {
    console.log("没有配置定时执行的链接[SYNCURL]，不执行任何操作");
    return;
}

var my_schedule = cron.schedule(
    CRONTAB,
    () => {
        console.log(`北京时间 (UTC+08)：${new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toLocaleString()}}`);
        //每次运行前,检测之前的是否存在,存在的话则清理掉
        if (my_schedule) my_schedule.stop();
        t();
    },
    { timezone: "Asia/Shanghai" }
);
async function t() {
    if (!REMOTE_CONTENT) {
        changeFile();
    }
    await exec("node executeOnce.js", { stdio: "inherit" });
}
async function changeFile() {
    let response = await axios.get(process.env.SYNCURL);
    let content = response.data;
    REMOTE_CONTENT = await smartReplace.inject(content);
    await fs.writeFileSync("./executeOnce.js", content, "utf8");
    console.log("替换变量完毕");
}
//#endregion

//#region Github Actions持续唤醒
//一个每半分钟执行一次的job,用于判断是否即将到达执行超时时间

if (LONG_TIME_TRIGGER) {
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
}

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
