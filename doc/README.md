# 技术文档

## 文档索引

- [协议规范](localsend-protocol.md) - LocalSend v2 协议详解

## 核心技术

### 三层发现策略

#### 1. UDP 多播（第一层）

**工作原理**:
```
设备启动 → 发送 3 次 UDP 广播
  ├─ 100ms 后第 1 次
  ├─ 600ms 后第 2 次（+500ms）
  └─ 2600ms 后第 3 次（+2000ms）
```

**优势**: 快速（0-2秒）、轻量
**劣势**: 可能丢包、可能被禁用

#### 2. HTTP 双向响应（第二层）

**工作原理**:
```
收到 UDP 公告
  ↓
立即 HTTP POST /register 响应
  ↓
对方收到，完成双向发现
```

**优势**: 可靠（TCP）、即时（不等周期）
**用途**: 防止 UDP 丢包，加速发现

#### 3. HTTP 子网扫描（第三层）

**工作原理**:
```
UDP 发现失败 10 秒后
  ↓
扫描 192.168.x.1-254
  ↓
并发 50 个 HTTP GET /info 请求
  ↓
发现运行相同协议的设备
```

**优势**: 兜底方案，适应严格网络
**劣势**: 慢（10-30秒）、消耗资源

### 关键设计

#### 防自响应

```javascript
// 过滤自己的消息
if (deviceInfo.fingerprint === DEVICE_FINGERPRINT) {
  return;  // 不处理
}
```

#### 发现方式标记

```javascript
registerDevice(deviceInfo, ip, 'multicast');  // UDP 多播
registerDevice(deviceInfo, ip, 'http-scan');  // HTTP 扫描
```

显示为: `[多播发现]` 或 `[HTTP扫描]`

#### 自动扫描触发

```javascript
// list 命令中
if (refreshCount >= 3 && discoveredDevices.size === 0) {
  // 10秒后仍无设备，自动 HTTP 扫描
  await this.scanSubnet();
}
```

## 网络兼容性

| 网络类型 | UDP 多播 | HTTP 响应 | HTTP 扫描 | 结果 |
|---------|---------|----------|----------|------|
| 正常家庭网络 | ✅ | ✅ | - | 0-2秒 |
| AP 隔离 WiFi | ❌ | ❌ | ✅ | 10-30秒 |
| 企业网络 | ⚠️ | ✅ | ✅ | 2-30秒 |
| 防火墙严格 | ❌ | ⚠️ | ✅ | 10-30秒 |

## 性能参数

| 参数 | 值 | 说明 |
|------|---|------|
| UDP 广播次数 | 3 | 100ms, 600ms, 2600ms |
| 广播间隔 | 3秒 | 定期保活 |
| 设备超时 | 10秒 | 未响应则移除 |
| HTTP 超时 | 1-2秒 | 快速失败 |
| 扫描并发 | 50 | 平衡速度和资源 |
| 自动扫描延迟 | 10秒 | UDP 失败后触发 |

## 调试技巧

### 抓包分析

```bash
# UDP 多播
sudo tcpdump -i any port 53317 and udp

# HTTP 流量
sudo tcpdump -i any port 53317 and tcp
```

### 启用详细日志

修改 `index.js` 添加调试日志:
```javascript
// 在 respondToAnnouncement 中
console.log(`[DEBUG] Responding to ${peer.alias}`);
```

## 参考资源

- [LocalSend GitHub](https://github.com/localsend/localsend)
- [LocalSend 协议](https://github.com/localsend/protocol)
