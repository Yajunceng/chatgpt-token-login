#!/usr/bin/env node

const readline = require('readline');
const path = require('path');

console.log('='.repeat(60));
console.log('🚀 ChatGPT 自动登录工具 v3 - HTTP拦截方案');
console.log('='.repeat(60));
console.log();

// 检查依赖
try {
    require.resolve('puppeteer');
} catch (e) {
    console.log('⚠️  缺少依赖，正在安装 puppeteer...');
    require('child_process').execSync('npm install puppeteer', {
        stdio: 'inherit',
        cwd: __dirname
    });
    console.log('✅ 安装完成！');
}

const puppeteer = require('puppeteer');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('请粘贴完整的认证 JSON，然后按回车：');
console.log();

let jsonInput = '';

rl.on('line', (line) => {
    jsonInput += line;
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
        const browser = await puppeteer.launch({
            headless: false,
            userDataDir: userDataDir,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ]
        });

        const page = await browser.newPage();
        const client = await page.target().createCDPSession();

        console.log('🔧 正在设置请求拦截...');

        // 启用网络拦截
        await client.send('Network.enable');
        await client.send('Fetch.enable', {
            patterns: [{
                urlPattern: '*chatgpt.com*',
                requestStage: 'Response'
            }]
        });

        console.log('✅ 拦截已启用');
        console.log('🌐 正在访问 ChatGPT...');
        console.log();

        let cookieInjected = false;

        // 监听响应并注入 Cookie
        client.on('Fetch.requestPaused', async (event) => {
            const { requestId, responseHeaders } = event;

            if (!cookieInjected && responseHeaders) {
                console.log('🎯 拦截到响应，正在注入 Cookie...');

                // 计算过期时间
                const expires = new Date();
                expires.setDate(expires.getDate() + 30);

                // 构造 Set-Cookie 头
                const setCookie = `__Secure-next-auth.session-token=${sessionToken}; Expires=${expires.toUTCString()}; Domain=.chatgpt.com; Path=/; Secure; SameSite=Lax`;

                // 添加到响应头
                const modifiedHeaders = responseHeaders ? [...responseHeaders] : [];
                modifiedHeaders.push({
                    name: 'Set-Cookie',
                    value: setCookie
                });

                try {
                    await client.send('Fetch.continueRequest', {
                        requestId,
                        responseHeaders: modifiedHeaders
                    });

                    cookieInjected = true;
                    console.log('✅ Cookie 已通过 HTTP 响应注入');
                } catch (e) {
                    // 如果失败，正常继续请求
                    await client.send('Fetch.continueRequest', { requestId });
                }
            } else {
                // 正常继续请求
                await client.send('Fetch.continueRequest', { requestId });
            }
        });

        // 访问 ChatGPT
        await page.goto('https://chatgpt.com', {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        console.log('⏳ 等待页面加载完成...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 检查登录状态
        const status = await page.evaluate(() => {
            const cookies = document.cookie;
            const pageText = document.body.innerText || '';

            return {
                allCookies: cookies,
                hasSessionToken: cookies.includes('session-token'),
                hasLoginButton: pageText.includes('登录') || pageText.includes('Log in'),
                hasUserName: pageText.toLowerCase().includes('zhang') || pageText.includes('qiuqiu')
            };
        });

        console.log();
        console.log('📊 登录状态检查：');
        console.log('   Cookie 包含 session-token:', status.hasSessionToken ? '✅' : '❌');
        console.log('   页面有登录按钮:', status.hasLoginButton ? '❌ (未登录)' : '✅ (已登录)');
        console.log('   页面有用户名:', status.hasUserName ? '✅' : '❌');
        console.log();

        if (status.hasSessionToken || status.hasUserName || !status.hasLoginButton) {
            console.log('🎉 登录成功！');
            console.log('📍 正在跳转到充值页面...');
            console.log();

            await page.goto('https://chatgpt.com/settings/billing', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            console.log('✅ 完成！浏览器已打开充值页面');
            console.log('💳 现在可以输入你的U卡信息完成充值');
            console.log();
        } else {
            console.log('⚠️  Cookie 注入可能失败');
            console.log('🔍 当前 Cookie:', status.allCookies.substring(0, 200) + '...');
            console.log();
            console.log('💡 正在尝试备用方案：直接修改 Chrome 数据库...');
            console.log();

            // 关闭浏览器以便操作数据库
            await browser.close();

            // 尝试直接修改 Cookie 数据库
            await modifyCookieDatabase(sessionToken, userDataDir);

            console.log('请重新运行程序查看结果');
            process.exit(0);
        }

        console.log('⚠️  充值完成后，可以关闭这个终端窗口');
        console.log();

    } catch (error) {
        console.error('❌ 发生错误：', error.message);
        console.log();
        process.exit(1);
    }
}

async function modifyCookieDatabase(sessionToken, userDataDir) {
    console.log('🔧 正在尝试直接修改 Cookie 数据库...');

    try {
        const sqlite3 = require('sqlite3').verbose();
        const cookieDbPath = path.join(userDataDir, 'Default', 'Cookies');

        console.log('数据库路径:', cookieDbPath);

        // 打开数据库
        const db = new sqlite3.Database(cookieDbPath);

        const expires = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

        // 插入 Cookie
        const sql = `INSERT INTO cookies (
            creation_utc, host_key, name, value, path,
            expires_utc, is_secure, is_httponly, samesite,
            source_scheme, has_expires, is_persistent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.run(sql, [
            Date.now() * 1000,  // creation_utc
            '.chatgpt.com',     // host_key
            '__Secure-next-auth.session-token',  // name
            sessionToken,       // value
            '/',                // path
            expires * 1000000,  // expires_utc
            1,                  // is_secure
            0,                  // is_httponly
            1,                  // samesite (Lax)
            2,                  // source_scheme (HTTPS)
            1,                  // has_expires
            1                   // is_persistent
        ], (err) => {
            if (err) {
                console.log('❌ 数据库操作失败:', err.message);
            } else {
                console.log('✅ Cookie 已写入数据库');
            }
            db.close();
        });

    } catch (e) {
        console.log('❌ 需要安装 sqlite3: npm install sqlite3');
        console.log('错误:', e.message);
    }
}
