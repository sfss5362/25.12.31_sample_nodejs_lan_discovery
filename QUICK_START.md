# 快速开始指南

## 1. 启动应用

### 方式一：使用 Node.js（开发模式）

```bash
node index.js
```

或双击启动脚本：
- Windows: `start.bat`
- Linux/Mac: `start.sh`

### 方式二：使用可执行文件（推荐）

如果已经构建了 exe 文件：
- Windows: 双击 `dist/lan-discovery.exe`
- Linux: `./dist/lan-discovery-linux`
- macOS: `./dist/lan-discovery-macos`

**如何构建**: 双击 `build.bat`（Windows）或运行 `./build.sh`（Linux/Mac）

## 2. 测试互相发现

### 单机测试
打开两个终端，分别运行：

**终端 1**:
```bash
node index.js
```

**终端 2**:
```bash
node index.js
```

几秒钟后，两个终端会互相发现对方，显示类似：

```
[NEW DEVICE] GS-10-155-20230921 (192.168.1.100)
  Type: desktop, Model: linux-x64

--- Discovered Devices ---
1. GS-10-155-20230921 - 192.168.1.100
   IP: 192.168.1.100 | URL: http://192.168.1.100:53317
--------------------------
```

### 多机测试
在同一局域网的不同电脑上运行程序，会自动互相发现。

## 3. 可用命令

启动后，可以使用以下命令：

- `l` 或 `list` - 启动实时自动刷新模式
- `s` 或 `scan` - HTTP 子网扫描（适用于 AP 隔离网络）
- `i` 或 `info` - 显示本机设备信息
- `q` 或 `quit` - 退出程序
- **任意键** - 停止自动刷新

### 实时刷新模式

输入 `l` 后进入自动刷新模式：
```
>>> Auto-refresh mode started <<<
Press any key to stop and return to menu

--- Discovered Devices (14:30:25) ---
1. PC-001 (desktop)
   IP: 192.168.1.100 | URL: http://192.168.1.100:53317
2. LAPTOP-002 (desktop)
   IP: 192.168.1.101 | URL: http://192.168.1.101:53317
--------------------------
```

- 每 3 秒自动刷新一次
- 显示当前时间戳
- 按任意键停止并返回菜单

### HTTP 子网扫描模式

输入 `s` 或 `scan` 启动 HTTP 子网扫描：
```
> s

[SCAN] Starting subnet scan: 192.168.1.1-254
[SCAN] This may take 10-30 seconds...

[SCAN FOUND] LAPTOP-001 (192.168.1.100)
[SCAN FOUND] PC-002 (192.168.1.150)

[SCAN] Complete. Found 2 device(s)

--- Discovered Devices ---
1. LAPTOP-001 (desktop)
   IP: 192.168.1.100 | URL: http://192.168.1.100:53317
2. PC-002 (desktop)
   IP: 192.168.1.150 | URL: http://192.168.1.150:53317
--------------------------
```

**适用场景**:
- AP 隔离的 WiFi 网络（公共/企业 WiFi）
- 路由器禁用 UDP 多播
- UDP 发现失败时的备用方案

**性能**:
- 扫描 254 个 IP 地址
- 并发 50 个请求
- 通常耗时 10-30 秒

## 4. 测试 HTTP API

应用同时启动了 HTTP 服务器，可以通过浏览器或 curl 测试：

```bash
# 获取设备信息
curl http://localhost:53317/api/localsend/v2/info
```

响应示例：
```json
{
  "alias": "GS-10-155-20230921",
  "version": "2.0",
  "deviceModel": "linux-x64",
  "deviceType": "desktop",
  "fingerprint": "1da75dca4c24b13d69ecc214453ecee2",
  "port": 53317,
  "protocol": "http",
  "download": false,
  "announce": true
}
```

## 5. 查看本机信息

在应用中输入 `i` 或 `info` 命令：

```
> i

--- Device Info ---
Alias: GS-10-155-20230921
Fingerprint: 1da75dca4c24b13d69ecc214453ecee2
Type: desktop
Model: linux-x64
Port: 53317
Local IPs (detected):
  1. 192.168.1.50 (以太网)
  2. 192.168.0.100 (WLAN)
  3. 100.100.10.54 (VirtualBox)
API: http://localhost:53317/api/localsend/v2/info

Note: Peers discover your actual IP from UDP broadcast source address.
-------------------
```

**说明**:
- **Local IPs**: 显示所有检测到的本机 IP 地址（按网卡列出）
- **实际发现**: 对端设备通过 UDP 广播的源地址自动获取正确的 IP
- **无需手动配置**: 系统会自动选择正确的网卡发送数据

## 故障排查

### 设备无法互相发现

1. **检查防火墙**
   ```bash
   # Linux 临时允许端口
   sudo ufw allow 53317

   # Windows 防火墙设置
   # 控制面板 -> Windows Defender 防火墙 -> 高级设置 -> 入站规则 -> 新建规则
   ```

2. **检查网络**
   - 确保在同一局域网内
   - 路由器未启用 AP 隔离

3. **等待或刷新**
   - 等待约 3 秒（自动广播周期）
   - 或输入 `r` 手动刷新

### 端口被占用

应用会自动尝试下一个端口（53318, 53319...），并在启动时显示实际使用的端口。

### 看不到已连接设备

设备会在 10 秒未响应后自动从列表中移除。输入 `r` 重新广播即可。

## 下一步

- 查看 `README.md` 了解详细功能
- 阅读 `参考/` 目录了解 LocalSend 协议设计
- 查看 `参考/learning-points.md` 学习设计思想
