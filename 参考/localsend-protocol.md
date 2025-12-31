# LocalSend 协议分析

参考：https://github.com/localsend/protocol

## 设备发现机制

### 1. Multicast UDP (主要方式)
- **多播地址**: `224.0.0.167`
- **端口**: `53317`
- **消息格式**: JSON 格式的设备信息

**广播内容**:
```json
{
  "alias": "设备名称",
  "version": "2.0",
  "deviceModel": "设备型号",
  "deviceType": "mobile|desktop|web|headless|server",
  "fingerprint": "设备唯一指纹",
  "port": 53317,
  "protocol": "https",
  "download": false,
  "announce": true
}
```

### 2. HTTP Legacy Mode (备用方式)
当多播不可用时，向所有本地 IP 地址发送 HTTP 请求：
- **端点**: `POST /api/localsend/v2/register`
- 遍历整个子网的所有 IP

## 设备指纹 (Fingerprint)

**用途**: 防止设备发现自己

**生成方式**:
- **HTTPS**: SHA-256 哈希值（TLS 证书）
- **HTTP**: 随机生成的字符串

## REST API 端点

```
GET  /api/localsend/v2/info          # 获取设备信息
POST /api/localsend/v2/register      # 设备注册/发现
POST /api/localsend/v2/prepare-upload # 准备上传文件
POST /api/localsend/v2/upload        # 上传文件
POST /api/localsend/v2/cancel        # 取消传输
```

## 关键特性

1. **双向发现**: 设备 A 广播后，设备 B 可以通过 UDP 或 HTTP 响应
2. **自我过滤**: 通过比较 fingerprint 避免发现自己
3. **协议协商**: 支持 HTTP/HTTPS 两种模式
4. **设备类型**: 区分移动设备、桌面、Web 等类型
