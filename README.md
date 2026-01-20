# 🚀 Anchor Vault

一个基于 **Solana Anchor** 框架实现的极简、安全的个人保险库（Vault）程序。该项目通过 **PDA (Program Derived Address)** 技术，为每个用户提供完全隔离的链上资金存储空间。

## ✨ 核心特性

- **完全隔离**: 每个用户拥有独立的 `Vault State` 和 `Vault PDA` 账户，互不干扰。
- **安全取款**: 利用 PDA 签名技术（Signer Seeds），确保只有资金的所有者才能发起取款。
- **租金回收**: 支持 `close` 指令，在清空资金后销毁账户并全额退还租金（Rent）。
- **自动化流水线**: 内置 Makefile 工具链，支持一键编译、部署、测试及 IDL 归档。

## 🛠 技术架构

该项目利用了 Solana 的核心特性：

- **State Account**: 存储保险库的元数据（目前为简约设计）。
- **System Vault**: 一个系统拥有的 PDA 账户，作为存放 Lamports 的物理池子。
- **Seeds 设计**:
- `State`: `[b"state", signer_pubkey]`
- `Vault`: `[b"vault", signer_pubkey]`

## 📂 项目结构

```text
.
├── programs/anchor_vault/src/lib.rs  # Rust 合约核心逻辑
├── tests/anchor_vault.ts            # TypeScript 集成测试套件
├── idls/                            # IDL 版本归档记录
├── Anchor.toml                      # 配置文件 (Localnet/Devnet)
└── Makefile                         # 开发工作流指令集

```

## 🚀 快速开始

### 前置条件

- Rust `1.80+`
- Solana CLI `1.18+`
- Anchor CLI `0.30+`
- Node.js & Yarn

### 1. 克隆与安装

```bash
git clone https://github.com/qiaopengjun/blueshift_anchor_vault.git
cd blueshift_anchor_vault
yarn install

```

### 2. 编译与测试

使用内置的 Makefile 快速执行：

```bash
make test  # 启动本地节点并运行所有测试用例

```

### 3. 部署到开发网 (Devnet)

```bash
make deploy CLUSTER=devnet

```

## 常用开发指令

| 指令                           | 说明                      |
| ------------------------------ | ------------------------- |
| `make build`                   | 编译 Rust 程序            |
| `make test`                    | 运行 TS 集成测试          |
| `make deploy CLUSTER=localnet` | 部署到本地测试网          |
| `make archive-idl`             | 对当前 IDL 进行时间戳归档 |

## 🧪 测试覆盖

测试脚本涵盖了以下关键场景：

1. ✅ **成功存款**: 验证 Lamports 正确进入 PDA。
2. ✅ **追加存款**: 验证余额累加逻辑。
3. ✅ **部分提款**: 验证 PDA 签名转账。
4. ❌ **超额提款拦截**: 验证 `InsufficientFunds` 错误处理。
5. ❌ **非空关闭拦截**: 防止在有余额时意外销毁账户。
6. ✅ **全额销毁**: 验证账户关闭及租金回收。

---

## 📄 开源协议

本项目采用 [MIT](https://www.google.com/search?q=LICENSE) 协议。

> **免责声明**: 本项目仅用于学习 Solana 开发。涉及真实资产操作请务必进行完整的安全审计。

---
