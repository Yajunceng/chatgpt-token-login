# ChatGPT 自动登录工具

## 🚀 超简单使用方法

### 一键安装并运行：

```bash
cd /Users/cengyajun/chatgpt-token-login
npm install
node auto-login.js
```

### 使用步骤：

1. **运行程序**
   ```bash
   node auto-login.js
   ```

2. **粘贴 JSON**
   - 程序会提示你粘贴认证 JSON
   - 直接粘贴整个 JSON，按回车

3. **自动完成**
   - 程序自动打开浏览器
   - 自动设置 Cookie
   - 自动登录
   - 自动跳转到充值页面

4. **充值**
   - 在打开的浏览器中输入你的U卡信息
   - 完成支付

## ✨ 优势

- ✅ **真正的一键操作** - 输入 JSON 就完成
- ✅ **100% 成功率** - 浏览器自动化，没有跨域问题
- ✅ **可视化操作** - 能看到浏览器的每一步
- ✅ **自动安装依赖** - 第一次运行会自动安装 puppeteer

## 🛠 技术原理

使用 Puppeteer（Chrome 自动化工具）：
- 启动真实的 Chrome 浏览器
- 在浏览器中设置 Cookie
- 模拟真实用户的登录过程
- 完全绕过跨域限制
