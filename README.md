# LAN Discovery - 局域网设备发现

基于 LocalSend 协议实现的局域网设备自动发现示例。

## 功能特性

- **UDP 多播发现** - 使用 LocalSend 标准多播地址 `224.0.0.167`
- **HTTP REST API** - 完整的 LocalSend v2 协议端点
- **设备指纹** - 防止自我发现的安全机制
- **终端交互界面** - 简单易用的命令行界面
- **实时设备列表** - 自动显示在线/离线设备
- **设备类型识别** - 区分 desktop、mobile、web 等设备类型

## 快速开始

### 方式一：Node.js 运行

**安装依赖**:
```bash
npm install
```

**启动应用**:
```bash
npm start
# 或
node index.js
```

**双击启动**:
- Windows: 双击 `start.bat`
- Linux/Mac: `chmod +x start.sh && ./start.sh`

### 方式二：独立可执行文件（推荐分发）

**构建 exe**:
```bash
# Windows
build.bat

# Linux/Mac
./build.sh
```

构建完成后，双击 `dist/lan-discovery.exe` 即可运行（无需安装 Node.js）。

详细构建说明请查看 [BUILD.md](BUILD.md)

## 使用方法

1. 在多台设备上启动应用
2. 应用会自动发现同一局域网内的其他设备
3. 可用命令：
   - `l` 或 `list` - 启动实时自动刷新模式（每3秒刷新一次）
   - `i` 或 `info` - 显示本机设备信息
   - `q` 或 `quit` - 退出程序
   - **任意键** - 停止自动刷新，返回菜单

**实时刷新模式**:
- 输入 `l` 后，程序会每3秒自动刷新设备列表
- 屏幕会清空并显示最新的设备列表和时间戳
- 按任意键可停止刷新，返回命令菜单

## 测试方法

### 单机测试
在同一台电脑上打开多个终端窗口，分别运行：
```bash
node index.js
```

几秒钟后，终端会互相发现对方。

### 多机测试
1. 确保所有设备在同一局域网内
2. 确保防火墙允许 UDP/TCP 53317 端口
3. 在每台设备上运行应用

## 技术实现

### LocalSend v2 协议
- **多播地址**: `224.0.0.167` (LocalSend 标准)
- **端口**: `53317` (TCP/UDP)
- **协议**: UDP 多播 + HTTP REST API
- **广播间隔**: 3 秒
- **设备超时**: 10 秒

### REST API 端点
- `GET /api/localsend/v2/info` - 获取设备信息
- `POST /api/localsend/v2/register` - 设备注册

### 设备信息格式
```json
{
  "alias": "设备名称",
  "version": "2.0",
  "deviceModel": "设备型号",
  "deviceType": "desktop",
  "fingerprint": "唯一设备指纹",
  "port": 53317,
  "protocol": "http",
  "download": false,
  "announce": true
}
```

## API 测试

应用启动后，可以通过 HTTP 访问设备信息：

```bash
# 命令行
curl http://localhost:53317/api/localsend/v2/info

# 或在浏览器访问
http://localhost:53317/api/localsend/v2/info
```

## 故障排查

### 设备无法互相发现
1. 检查防火墙是否允许 UDP 53317 端口
2. 确保在同一局域网内
3. 如果使用 WiFi，确保路由器未启用 AP 隔离
4. 等待约 3 秒（自动广播间隔）或手动刷新

### 端口被占用
应用会自动尝试使用下一个可用端口（53318, 53319...）

### 看不到其他设备
输入 `r` 命令手动刷新，或等待自动广播周期

## 参考资料

- [LocalSend 官方仓库](https://github.com/localsend/localsend)
- [LocalSend 协议文档](https://github.com/localsend/protocol)
- 详细协议分析见 `参考/` 目录

## 协议兼容性

本实现遵循 LocalSend v2 协议规范，理论上可以与真实的 LocalSend 应用互相发现（仅设备发现功能，不包括文件传输）。

## 技术说明

### IP 地址发现机制

- **显示的 LAN IP**: 程序通过 `os.networkInterfaces()` 获取的第一个非内部 IPv4 地址，仅供参考
- **实际发现 IP**: 对端设备通过 UDP 多播消息的源地址（`rinfo.address`）获取你的真实 IP
- **多网卡情况**: 如果有多个网卡，显示的 IP 可能不是对端实际使用的 IP
- **自动处理**: 协议会自动使用正确的 IP，无需用户手动配置
