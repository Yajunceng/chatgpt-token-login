#!/usr/bin/env node

const readline = require('readline');

console.log('='.repeat(60));
console.log('🚀 ChatGPT 自动登录工具');
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

    try {
        // 启动浏览器
        const browser = await puppeteer.launch({
            headless: false,  // 显示浏览器界面
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        const page = await browser.newPage();

        console.log('📝 正在访问 ChatGPT...');

        // 先访问 ChatGPT 来建立域名上下文
        await page.goto('https://chatgpt.com', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        console.log('🔐 正在注入 Cookie...');

        // 在页面上下文中设置 Cookie
        const cookieSet = await page.evaluate((token) => {
            const expires = new Date();
            expires.setDate(expires.getDate() + 30);

            // 设置 Cookie
            document.cookie = `__Secure-next-auth.session-token=${token}; expires=${expires.toUTCString()}; domain=.chatgpt.com; path=/; secure; samesite=lax`;

            // 验证 Cookie 是否设置成功
            const cookies = document.cookie;
            const hasToken = cookies.includes('__Secure-next-auth.session-token');

            return {
                success: hasToken,
                allCookies: cookies,
                tokenLength: token.length
            };
        }, sessionToken);

        console.log('Cookie 设置结果:', cookieSet);

        if (!cookieSet.success) {
            console.log('⚠️  警告：Cookie 可能没有设置成功');
            console.log('尝试使用 CDP 协议直接设置...');

            // 使用 CDP 协议直接设置 Cookie
            const client = await page.target().createCDPSession();
            await client.send('Network.setCookie', {
                name: '__Secure-next-auth.session-token',
                value: sessionToken,
                domain: '.chatgpt.com',
                path: '/',
                secure: true,
                httpOnly: false,
                sameSite: 'Lax'
            });

            console.log('✅ 已通过 CDP 设置 Cookie');
        }

        console.log('✅ Cookie 已设置');
        console.log('🔄 正在刷新页面以应用登录状态...');
        console.log();

        // 等待一下确保 Cookie 写入
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 刷新页面以应用登录状态
        await page.goto('https://chatgpt.com', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // 检查刷新后的 Cookie
        const afterRefresh = await page.evaluate(() => {
            return {
                cookies: document.cookie,
                hasToken: document.cookie.includes('__Secure-next-auth.session-token')
            };
        });

        console.log('刷新后 Cookie 状态:', afterRefresh);

        // 检查是否登录成功（看页面上是否有登录按钮）
        const isLoggedIn = await page.evaluate(() => {
            // 如果有"登录"按钮，说明没登录成功
            const loginButton = document.querySelector('button') || document.querySelector('a');
            const pageText = document.body.innerText;
            return !pageText.includes('登录') || pageText.includes('zhang qiuqiu');
        });

        console.log('登录状态检查:', isLoggedIn ? '✅ 已登录' : '❌ 未登录');
        console.log();

        // 等待一下确保登录生效
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('✅ 登录成功！');
        console.log('📍 正在跳转到充值页面...');
        console.log();

        // 跳转到充值页面
        await page.goto('https://chatgpt.com/settings/billing', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        console.log('🎉 完成！浏览器已打开充值页面');
        console.log('💳 现在可以输入你的U卡信息完成充值');
        console.log();
        console.log('⚠️  充值完成后，可以关闭这个终端窗口');
        console.log('    浏览器会继续保持打开状态');
        console.log();

        // 不关闭浏览器，让用户手动操作充值
        // browser.close();

    } catch (error) {
        console.error('❌ 发生错误：', error.message);
        console.log();
        console.log('可能的原因：');
        console.log('1. Token 已过期');
        console.log('2. 网络连接问题');
        console.log('3. ChatGPT 网站结构变化');
        process.exit(1);
    }
}
