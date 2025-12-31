#!/usr/bin/env node

const dgram = require('dgram');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');

// 配置 - 使用 LocalSend 的标准配置
const MULTICAST_ADDR = '224.0.0.167';  // LocalSend 标准多播地址
const PORT = 53317;  // LocalSend 标准端口
const ANNOUNCE_INTERVAL = 3000;  // 广播间隔（毫秒）
const DEVICE_TIMEOUT = 10000;  // 设备超时时间（毫秒）
const API_VERSION = 'v2';

// 生成唯一设备指纹 (Fingerprint)
const DEVICE_FINGERPRINT = crypto.randomBytes(16).toString('hex');
const DEVICE_ALIAS = os.hostname();
const DEVICE_MODEL = `${os.platform()}-${os.arch()}`;

// 存储发现的设备
const discoveredDevices = new Map();

class LocalSendDiscovery {
  constructor() {
    this.udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.httpServer = null;
    this.announceTimer = null;
    this.cleanupTimer = null;
    this.httpPort = PORT;
    this.autoRefreshTimer = null;  // 自动刷新定时器
  }

  // 获取所有本机 IP 地址
  getAllLocalIPs() {
    const ips = [];
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push({ name, address: iface.address });
        }
      }
    }
    return ips.length > 0 ? ips : [{ name: 'localhost', address: '127.0.0.1' }];
  }

  // 获取本机 IP 地址（第一个）
  getLocalIP() {
    const ips = this.getAllLocalIPs();
    return ips[0].address;
  }

  // 创建 LocalSend 协议的设备信息
  getDeviceInfo(announcement = false) {
    return {
      alias: DEVICE_ALIAS,
      version: '2.0',
      deviceModel: DEVICE_MODEL,
      deviceType: 'desktop',  // mobile, desktop, web, headless, server
      fingerprint: DEVICE_FINGERPRINT,
      port: this.httpPort,
      protocol: 'http',  // 简化版本使用 http
      download: false,
      announcement: announcement,  // 是否为公告
      announce: announcement       // 兼容字段
    };
  }

  // 启动 HTTP 服务器（REST API）
  startHTTPServer() {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        this.handleHTTPRequest(req, res);
      });

      this.httpServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${this.httpPort} in use, trying ${this.httpPort + 1}...`);
          this.httpPort++;
          this.httpServer.listen(this.httpPort);
        } else {
          reject(err);
        }
      });

      this.httpServer.listen(this.httpPort, () => {
        console.log(`HTTP server listening on port ${this.httpPort}`);
        resolve();
      });
    });
  }

  // 处理 HTTP 请求
  handleHTTPRequest(req, res) {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    // 解析 URL
    const url = new URL(req.url, `http://${req.headers.host}`);

    // /api/localsend/v2/info - 获取设备信息
    if (url.pathname === `/api/localsend/${API_VERSION}/info` && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(this.getDeviceInfo()));
      return;
    }

    // /api/localsend/v2/register - 设备注册
    if (url.pathname === `/api/localsend/${API_VERSION}/register` && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const deviceInfo = JSON.parse(body);
          this.registerDevice(deviceInfo, req.socket.remoteAddress);
          res.writeHead(200);
          res.end(JSON.stringify(this.getDeviceInfo()));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid request' }));
        }
      });
      return;
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  // 注册设备
  registerDevice(deviceInfo, ip, discoveryMethod = 'multicast') {
    // 过滤掉自己
    if (deviceInfo.fingerprint === DEVICE_FINGERPRINT) {
      return;
    }

    // 清理 IPv6 映射的 IPv4 地址
    const cleanIP = ip.replace('::ffff:', '');

    const deviceKey = deviceInfo.fingerprint;
    const isNew = !discoveredDevices.has(deviceKey);
    const existing = discoveredDevices.get(deviceKey);

    discoveredDevices.set(deviceKey, {
      ...deviceInfo,
      ip: cleanIP,
      lastSeen: Date.now(),
      discoveryMethod: existing?.discoveryMethod || discoveryMethod  // 保留首次发现方式
    });

    if (isNew) {
      const methodLabel = discoveryMethod === 'http-scan' ? 'HTTP扫描' : '多播发现';
      console.log(`\n[NEW DEVICE] ${deviceInfo.alias} (${cleanIP}) - ${methodLabel}`);
      console.log(`  Type: ${deviceInfo.deviceType}, Model: ${deviceInfo.deviceModel}`);
      this.showDeviceList();
    }
  }

  // 启动 UDP 多播发现
  startUDPDiscovery() {
    return new Promise((resolve, reject) => {
      this.udpSocket.on('error', (err) => {
        console.error(`UDP Socket error: ${err}`);
        reject(err);
      });

      this.udpSocket.on('message', (msg, rinfo) => {
        this.handleUDPMessage(msg, rinfo);
      });

      this.udpSocket.on('listening', () => {
        const address = this.udpSocket.address();
        console.log(`\n=== LocalSend-like Discovery Started ===`);
        console.log(`UDP listening on ${address.address}:${address.port}`);
        console.log(`Multicast: ${MULTICAST_ADDR}`);
        console.log(`Fingerprint: ${DEVICE_FINGERPRINT}`);
        console.log(`Device: ${DEVICE_ALIAS}`);
        console.log(`Local IP: ${this.getLocalIP()}`);
        console.log(`=======================================\n`);

        // 加入多播组
        try {
          this.udpSocket.addMembership(MULTICAST_ADDR);
          this.udpSocket.setMulticastTTL(128);
          this.udpSocket.setMulticastLoopback(true);
        } catch (err) {
          console.warn('Failed to setup multicast:', err.message);
        }

        resolve();
      });

      // 绑定端口
      this.udpSocket.bind(PORT);
    });
  }

  // 处理接收到的 UDP 消息
  handleUDPMessage(msg, rinfo) {
    try {
      const deviceInfo = JSON.parse(msg.toString());

      // 验证是否是 LocalSend 协议消息
      if (!deviceInfo.fingerprint || !deviceInfo.alias) {
        return;
      }

      // 过滤自己 - 不处理自己的消息
      if (deviceInfo.fingerprint === DEVICE_FINGERPRINT) {
        return;
      }

      // 注册设备
      this.registerDevice(deviceInfo, rinfo.address);

      // 如果是公告消息，发送响应（双向确认）
      if (deviceInfo.announcement === true || deviceInfo.announce === true) {
        this.respondToAnnouncement(deviceInfo, rinfo.address);
      }

    } catch (err) {
      // 忽略无效消息
    }
  }

  // 响应公告（HTTP 优先，UDP fallback）
  async respondToAnnouncement(deviceInfo, ip) {
    const peer = {
      ip: ip,
      port: deviceInfo.port || PORT,
      alias: deviceInfo.alias
    };

    try {
      // 优先：通过 HTTP/TCP 响应
      await this.respondViaHTTP(peer);
      // 静默响应，不显示日志
    } catch (err) {
      // Fallback：HTTP 失败，改用 UDP 响应
      this.respondViaUDP(peer);
      // 静默响应，不显示日志
    }
  }

  // 通过 HTTP 响应公告
  respondViaHTTP(peer) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(this.getDeviceInfo(false));
      const options = {
        hostname: peer.ip,
        port: peer.port,
        path: `/api/localsend/${API_VERSION}/register`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 2000  // 2秒超时
      };

      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  // 通过 UDP 响应公告（fallback）
  respondViaUDP(peer) {
    const message = JSON.stringify(this.getDeviceInfo(false));
    const buffer = Buffer.from(message);

    this.udpSocket.send(buffer, 0, buffer.length, PORT, MULTICAST_ADDR, (err) => {
      if (err) {
        console.error('UDP respond error:', err.message);
      }
    });
  }

  // 通过 UDP 多播广播自己
  announceViaUDP() {
    const message = JSON.stringify(this.getDeviceInfo(true));  // announcement=true
    const buffer = Buffer.from(message);

    this.udpSocket.send(buffer, 0, buffer.length, PORT, MULTICAST_ADDR, (err) => {
      if (err) {
        console.error('UDP announce error:', err.message);
      }
    });
  }

  // 启动时发送 3 次公告序列（防止 UDP 丢包）
  async sendAnnouncementSequence() {
    const delays = [100, 500, 2000];  // LocalSend 标准延迟
    for (const delay of delays) {
      await new Promise(resolve => setTimeout(resolve, delay));
      this.announceViaUDP();
    }
  }

  // HTTP 子网扫描（AP 隔离网络备用方案）
  async scanSubnet() {
    const localIPs = this.getAllLocalIPs();
    if (localIPs.length === 0) {
      console.log('[SCAN] No network interface found');
      return [];
    }

    // 使用第一个非本地 IP 的子网
    const myIP = localIPs[0].address;
    const subnet = myIP.split('.').slice(0, 3).join('.');

    console.log(`\n[SCAN] Starting subnet scan: ${subnet}.1-254`);
    console.log('[SCAN] This may take 10-30 seconds...\n');

    const tasks = [];
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      if (ip !== myIP) {
        tasks.push(this.tryDiscoverViaHTTP(ip));
      }
    }

    // 并发控制：每批 50 个
    const concurrency = 50;
    const discovered = [];

    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      const results = await Promise.allSettled(batch);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          discovered.push(result.value);
          const device = result.value;
          console.log(`[SCAN FOUND] ${device.alias} (${device.ip})`);
        }
      }
    }

    console.log(`\n[SCAN] Complete. Found ${discovered.length} device(s)\n`);
    return discovered;
  }

  // 尝试通过 HTTP 发现单个设备
  async tryDiscoverViaHTTP(ip) {
    return new Promise((resolve) => {
      const options = {
        hostname: ip,
        port: this.httpPort,
        path: `/api/localsend/${API_VERSION}/info?fingerprint=${DEVICE_FINGERPRINT}`,
        method: 'GET',
        timeout: 1000  // 1秒超时（快速失败）
      };

      const req = http.request(options, (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }

        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const deviceInfo = JSON.parse(data);

            // 过滤自己
            if (deviceInfo.fingerprint === DEVICE_FINGERPRINT) {
              resolve(null);
              return;
            }

            // 注册设备（标记为 HTTP 扫描发现）
            this.registerDevice(deviceInfo, ip, 'http-scan');
            resolve(deviceInfo);

          } catch (err) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });

      req.end();
    });
  }

  // 启动服务
  async start() {
    try {
      // 启动 HTTP 服务器
      await this.startHTTPServer();

      // 启动 UDP 发现
      await this.startUDPDiscovery();

      // 开始定期广播
      this.startAnnouncing();

      // 开始清理过期设备
      this.startCleanup();

    } catch (err) {
      throw err;
    }
  }

  // 开始定期广播
  async startAnnouncing() {
    // 启动时发送 3 次公告序列（100ms, 500ms, 2000ms）
    await this.sendAnnouncementSequence();

    // 定期广播（保持在线状态）
    this.announceTimer = setInterval(() => {
      this.announceViaUDP();
    }, ANNOUNCE_INTERVAL);
  }

  // 清理过期设备
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let removed = false;

      for (const [key, device] of discoveredDevices.entries()) {
        if (now - device.lastSeen > DEVICE_TIMEOUT) {
          console.log(`\n[DEVICE LOST] ${device.alias} (${device.ip})`);
          discoveredDevices.delete(key);
          removed = true;
        }
      }

      if (removed) {
        this.showDeviceList();
      }
    }, 2000);
  }

  // 显示设备列表（单次）
  showDeviceListOnce() {
    console.clear();
    const now = new Date().toLocaleTimeString();
    console.log(`\n--- Discovered Devices (${now}) ---`);
    if (discoveredDevices.size === 0) {
      console.log('(No devices found yet)');
    } else {
      let index = 1;
      for (const device of discoveredDevices.values()) {
        const protocol = device.protocol || 'http';
        const url = `${protocol}://${device.ip}:${device.port}`;
        const methodLabel = device.discoveryMethod === 'http-scan' ? '[HTTP扫描]' : '[多播发现]';
        console.log(`${index}. ${device.alias} (${device.deviceType}) ${methodLabel}`);
        console.log(`   IP: ${device.ip} | URL: ${url}`);
        index++;
      }
    }
    console.log('--------------------------');
  }

  // 显示设备列表（带菜单）
  showDeviceList() {
    this.showDeviceListOnce();
    console.log('');
    this.showMenu();
  }

  // 开始自动刷新设备列表
  startAutoRefresh() {
    // 停止之前的自动刷新
    this.stopAutoRefresh();

    console.log('\n>>> Auto-refresh mode started <<<');
    console.log('Press any key to stop and return to menu\n');

    let refreshCount = 0;
    let hasScanned = false;

    // 立即广播并显示一次
    this.announceViaUDP();
    setTimeout(() => this.showDeviceListOnce(), 500);

    // 每3秒自动刷新
    this.autoRefreshTimer = setInterval(async () => {
      refreshCount++;
      this.announceViaUDP();

      // 等待 UDP 响应
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 如果 10 秒后仍未发现设备，自动触发 HTTP 扫描（仅一次）
      if (refreshCount >= 3 && discoveredDevices.size === 0 && !hasScanned) {
        hasScanned = true;
        console.log('\n[AUTO] No devices found via multicast, starting HTTP scan...\n');
        await this.scanSubnet();
      }

      this.showDeviceListOnce();
    }, 3000);
  }

  // 停止自动刷新
  stopAutoRefresh() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
      console.log('\n>>> Auto-refresh mode stopped <<<\n');
    }
  }

  // 显示菜单
  showMenu() {
    console.log('Commands: list (auto-refresh + auto-scan) | info | quit');
    console.log('Tip: Press any key to stop auto-refresh');
    process.stdout.write('> ');
  }

  // 显示本机信息
  showInfo() {
    console.log('\n--- Device Info ---');
    const info = this.getDeviceInfo();
    console.log(`Alias: ${info.alias}`);
    console.log(`Fingerprint: ${info.fingerprint}`);
    console.log(`Type: ${info.deviceType}`);
    console.log(`Model: ${info.deviceModel}`);
    console.log(`Port: ${info.port}`);

    // 显示所有本机 IP 地址
    const ips = this.getAllLocalIPs();
    console.log(`Local IPs (detected):`);
    ips.forEach((ip, index) => {
      console.log(`  ${index + 1}. ${ip.address} (${ip.name})`);
    });

    console.log(`API: http://localhost:${this.httpPort}/api/localsend/v2/info`);
    console.log('');
    console.log('Note: Peers discover your actual IP from UDP broadcast source address.');
    console.log('-------------------\n');
    this.showMenu();
  }

  // 停止服务
  stop() {
    if (this.announceTimer) {
      clearInterval(this.announceTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.udpSocket) {
      this.udpSocket.close();
    }
    if (this.httpServer) {
      this.httpServer.close();
    }
    console.log('\nDiscovery service stopped.');
  }
}

// 主程序
async function main() {
  const discovery = new LocalSendDiscovery();

  try {
    await discovery.start();

    // 设置命令行界面
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    discovery.showMenu();

    rl.on('line', async (input) => {
      const cmd = input.trim().toLowerCase();

      switch (cmd) {
        case 'l':
        case 'list':
        case 'r':
        case 'refresh':
          // 启动自动刷新模式（包含自动扫描）
          discovery.startAutoRefresh();
          break;

        case 's':
        case 'scan':
          // 手动 HTTP 子网扫描（备用）
          discovery.stopAutoRefresh();
          await discovery.scanSubnet();
          discovery.showDeviceList();
          break;

        case 'i':
        case 'info':
          discovery.stopAutoRefresh();
          discovery.showInfo();
          break;

        case 'q':
        case 'quit':
        case 'exit':
          console.log('\nShutting down...');
          discovery.stopAutoRefresh();
          discovery.stop();
          rl.close();
          process.exit(0);
          break;

        default:
          if (discovery.autoRefreshTimer) {
            // 如果在自动刷新模式，任意输入都停止刷新
            discovery.stopAutoRefresh();
            discovery.showMenu();
          } else {
            console.log('Unknown command');
            discovery.showMenu();
          }
      }
    });

    rl.on('close', () => {
      discovery.stop();
      process.exit(0);
    });

    // 处理进程退出
    process.on('SIGINT', () => {
      console.log('\nReceived SIGINT, shutting down...');
      discovery.stop();
      rl.close();
      process.exit(0);
    });

  } catch (err) {
    console.error('Failed to start discovery service:', err);
    process.exit(1);
  }
}

// 启动应用
main();
