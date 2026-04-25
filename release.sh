#!/bin/bash
set -e  # 遇到任何错误立即退出

echo "🔨 开始构建..."

# 1. 构建前端
echo "📦 构建前端 (web)..."
cd web
bun run build
cd ..

# 2. 编译 Go 程序
echo "🏗️ 编译 Go 程序..."
go build -o main ./main.go

# 3. 准备打包文件
echo "📦 打包文件..."
# 确保目标目录存在
mkdir -p ../release

# 打包 web/dist 目录、main 可执行文件和 .env 配置文件
tar -czf ../release/release.tar.gz web/dist main .env

echo "✅ 构建完成！压缩包已生成：../release/release.tar.gz"
