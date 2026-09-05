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

        console.log('📝 正在设置 Cookie...');

        // 先访问 ChatGPT 来建立域名上下文
        await page.goto('https://chatgpt.com', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // 使用 evaluateOnNewDocument 在页面加载前注入 Cookie
        await page.evaluateOnNewDocument((token) => {
            const expires = new Date();
            expires.setDate(expires.getDate() + 30);
            document.cookie = `__Secure-next-auth.session-token=${token}; expires=${expires.toUTCString()}; domain=.chatgpt.com; path=/; secure; samesite=lax`;
        }, sessionToken);

        console.log('✅ Cookie 已设置');
        console.log('🔄 正在刷新页面以应用登录状态...');
        console.log();

        // 刷新页面以应用登录状态
        await page.goto('https://chatgpt.com', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

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
