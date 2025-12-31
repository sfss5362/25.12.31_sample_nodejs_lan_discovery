# 参考资料目录

本目录包含 LocalSend 协议分析和学习资料。

## 文档列表

### 1. localsend-protocol.md
LocalSend 协议的核心分析，包括：
- 设备发现机制（UDP 多播 + HTTP）
- 设备指纹（Fingerprint）设计
- REST API 端点说明
- 关键技术特性

### 2. learning-points.md
从 LocalSend 学到的关键设计思想：
- 双重发现机制的设计思路
- 设备指纹的安全考虑
- 标准化协议设计
- 设备元数据管理
- 网络配置最佳实践
- 安全与加密
- 跨平台设计
- 用户体验优化
- 实现建议和性能优化

## 源码目录（如已克隆）

- **localsend/** - LocalSend 官方源码
- **protocol/** - LocalSend 协议规范仓库

## 在线资源

- [LocalSend GitHub](https://github.com/localsend/localsend) - 官方开源仓库
- [LocalSend 协议](https://github.com/localsend/protocol) - 协议规范文档
- [LocalSend 官网](https://localsend.org) - 项目官网

## 学习路径建议

1. **了解协议**: 阅读 `localsend-protocol.md` 了解 LocalSend 的核心协议设计
2. **学习设计思想**: 深入阅读 `learning-points.md` 理解优秀的设计原则
3. **研究源码**: 如果需要深入学习，可以研究 `localsend/` 目录中的 Flutter/Dart 源码
4. **实践应用**: 基于学到的知识，尝试扩展本项目的功能

## 协议要点总结

- **多播地址**: `224.0.0.167:53317`
- **发现方式**: UDP 多播（主） + HTTP 轮询（备）
- **安全机制**: 设备指纹防止自我发现
- **API 设计**: RESTful 风格，版本化管理（/v2/）
- **设备识别**: 包含类型、型号、协议版本等元数据
