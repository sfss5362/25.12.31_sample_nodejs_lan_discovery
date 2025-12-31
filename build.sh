#!/bin/bash

echo "========================================"
echo "  LAN Discovery - Build Script"
echo "========================================"
echo

# 检查是否安装了 Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "[Step 1/4] Checking Node.js version..."
node --version
echo

# 检查是否存在 node_modules
if [ ! -d "node_modules" ]; then
    echo "[Step 2/4] Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install dependencies"
        exit 1
    fi
else
    echo "[Step 2/4] Dependencies already installed"
fi
echo

# 安装 pkg
echo "[Step 3/4] Installing pkg..."
npm install --save-dev pkg
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install pkg"
    exit 1
fi
echo

# 创建输出目录
mkdir -p dist

# 执行打包（Linux 和 macOS）
echo "[Step 4/4] Building executables..."
echo "This may take a few minutes..."
echo

# 打包 Linux 版本
npx pkg . --targets node18-linux-x64 --output dist/lan-discovery-linux
if [ $? -ne 0 ]; then
    echo
    echo "[ERROR] Build failed"
    exit 1
fi

# 如果是 macOS，也打包 macOS 版本
if [[ "$OSTYPE" == "darwin"* ]]; then
    npx pkg . --targets node18-macos-x64 --output dist/lan-discovery-macos
fi

echo
echo "========================================"
echo "  Build completed successfully!"
echo "========================================"
echo
echo "Executable files:"
ls -lh dist/
echo
echo "You can now run: ./dist/lan-discovery-linux"
echo

# 添加执行权限
chmod +x dist/lan-discovery-*

read -p "Do you want to run the application now? (y/n): " run
if [[ "$run" == "y" || "$run" == "Y" ]]; then
    echo
    echo "Starting lan-discovery..."
    ./dist/lan-discovery-linux
fi
