#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('🚀 ChatGPT 自动登录工具 v2');
console.log('='.repeat(60));
console.log();

// 检查依赖
try {
    require.resolve('puppeteer');
} catch (e) {
    console.log('⚠️  缺少依赖，正在安装 puppeteer...');
    console.log('这可能需要几分钟时间，请耐心等待...');
    console.log();
    require('child_process').execSync('npm install puppeteer', {
        stdio: 'inherit',
        cwd: __dirname
    });
    console.log();
    console.log('✅ 安装完成！');
    console.log();
}

const puppeteer = require('puppeteer');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('请粘贴完整的认证 JSON，然后按回车：');
console.log('(可以直接粘贴一整段 JSON)');
console.log();

let jsonInput = '';

rl.on('line', (line) => {
    jsonInput += line;

    // 尝试解析 JSON
    try {
        const data = JSON.parse(jsonInput);
        if (data.sessionToken) {
            rl.close();
            startLogin(data.sessionToken);
        }
    } catch (e) {
        // 继续读取
    }
});

async function startLogin(sessionToken) {
    console.log();
    console.log('✅ 已提取 sessionToken');
    console.log('🌐 正在启动浏览器...');
    console.log();

    const userDataDir = path.join(__dirname, '.chrome-data');

    try {
        // 启动浏览器
        const browser = await puppeteer.launch({
            headless: false,
            userDataDir: userDataDir,  // 使用持久化的用户数据目录
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',  // 禁用安全策略以允许设置 Cookie
            ]
        });

        const page = await browser.newPage();

        console.log('📝 正在准备 Cookie 数据...');

        // 使用 CDPSession 直接操作浏览器存储
        const client = await page.target().createCDPSession();

        // 计算过期时间（30天后）
        const expires = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

        console.log('🔐 正在通过 CDP 设置 Cookie...');

        // 使用 Network.setCookies (复数形式)
        try {
            await client.send('Network.setCookies', {
                cookies: [{
                    name: '__Secure-next-auth.session-token',
                    value: sessionToken,
                    domain: '.chatgpt.com',
                    path: '/',
                    secure: true,
                    httpOnly: false,
                    sameSite: 'Lax',
                    expires: expires
                }]
            });
            console.log('✅ CDP Cookie 设置成功');
        } catch (e) {
            console.log('⚠️  CDP 方法失败，尝试备用方案...');

            // 备用方案：直接访问页面，然后用 Storage API
            await page.goto('https://chatgpt.com', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // 使用 localStorage 作为中转
            await page.evaluate((token, exp) => {
                // 存储到 localStorage
                localStorage.setItem('temp_token', token);
                localStorage.setItem('temp_exp', exp);

                // 尝试各种方式设置 Cookie
                const cookieStr = `__Secure-next-auth.session-token=${token}; expires=${new Date(exp * 1000).toUTCString()}; domain=.chatgpt.com; path=/; secure; samesite=lax`;

                // 方法1：直接设置
                document.cookie = cookieStr;

                // 方法2：不带前缀尝试
                document.cookie = `next-auth.session-token=${token}; expires=${new Date(exp * 1000).toUTCString()}; domain=.chatgpt.com; path=/; secure; samesite=lax`;

            }, sessionToken, expires);

            console.log('✅ 备用方案已执行');
        }

        console.log('🔄 正在访问 ChatGPT 并验证登录状态...');
        console.log();

        // 访问首页
        await page.goto('https://chatgpt.com', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // 等待页面加载
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 检查登录状态
        const status = await page.evaluate(() => {
            const cookies = document.cookie;
            const pageText = document.body.innerText || '';

            return {
                hasCookie: cookies.includes('session-token'),
                cookies: cookies,
                hasLogin: pageText.includes('登录') || pageText.includes('Log in'),
                hasUserName: pageText.toLowerCase().includes('zhang') || pageText.includes('qiuqiu')
            };
        });

        console.log('📊 登录状态检查：');
        console.log('   Cookie 包含 session-token:', status.hasCookie ? '✅' : '❌');
        console.log('   页面有登录按钮:', status.hasLogin ? '❌ (未登录)' : '✅ (已登录)');
        console.log('   页面有用户名:', status.hasUserName ? '✅' : '❌');
        console.log();

        if (status.hasUserName || !status.hasLogin) {
            console.log('✅ 登录成功！');
            console.log('📍 正在跳转到充值页面...');
            console.log();

            await page.goto('https://chatgpt.com/settings/billing', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            console.log('🎉 完成！浏览器已打开充值页面');
            console.log('💳 现在可以输入你的U卡信息完成充值');
        } else {
            console.log('⚠️  登录可能未成功');
            console.log('🔍 当前 Cookie:', status.cookies);
            console.log();
            console.log('💡 建议：');
            console.log('1. 让朋友重新获取最新的 sessionToken');
            console.log('2. 确认 token 是从同一个浏览器/设备获取的');
            console.log('3. 尝试手动登录一次，看看是否需要验证码');
        }

        console.log();
        console.log('⚠️  充值完成后，可以关闭这个终端窗口');
        console.log('    浏览器会继续保持打开状态');
        console.log();

    } catch (error) {
        console.error('❌ 发生错误：', error.message);
        console.log();
        console.log('可能的原因：');
        console.log('1. Token 格式问题或已失效');
        console.log('2. 网络连接问题');
        console.log('3. ChatGPT 更新了认证机制');
        process.exit(1);
    }
}
