import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorVault } from "../target/types/anchor_vault"; // 确保名称匹配
import { expect } from "chai";

describe("anchor-vault-tests", () => {
  // 配置 Provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorVault as Program<AnchorVault>;
  const signer = provider.wallet as anchor.Wallet;

  // 派生 PDA 地址
  const [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("state"), signer.publicKey.toBuffer()],
    program.programId,
  );

  const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), signer.publicKey.toBuffer()],
    program.programId,
  );

  const oneSol = new anchor.BN(anchor.web3.LAMPORTS_PER_SOL);

  it("1. 成功存款 (Initial Deposit)", async () => {
    try {
      await program.methods
        .deposit(oneSol)
        .accounts({
          signer: signer.publicKey,
        })
        .rpc();

      const vaultBalance = await provider.connection.getBalance(vaultPda);
      expect(vaultBalance).to.equal(oneSol.toNumber());
    } catch (err) {
      console.error("Deposit error:", err);
      throw err;
    }
  });

  it("2. 追加存款 (Top-up)", async () => {
    const topUpAmount = new anchor.BN(0.5 * anchor.web3.LAMPORTS_PER_SOL);

    await program.methods
      .deposit(topUpAmount)
      .accounts({ signer: signer.publicKey })
      .rpc();

    const vaultBalance = await provider.connection.getBalance(vaultPda);
    expect(vaultBalance).to.equal(oneSol.add(topUpAmount).toNumber());
  });

  it("3. 提取部分资金 (Withdraw Partial)", async () => {
    const withdrawAmount = new anchor.BN(0.8 * anchor.web3.LAMPORTS_PER_SOL);

    await program.methods
      .withdraw(withdrawAmount)
      .accounts({ signer: signer.publicKey })
      .rpc();

    const vaultBalance = await provider.connection.getBalance(vaultPda);
    // 1.5 - 0.8 = 0.7 SOL
    expect(vaultBalance).to.equal(0.7 * anchor.web3.LAMPORTS_PER_SOL);
  });

  it("4. 尝试超额提款 (Should Fail)", async () => {
    const excessiveAmount = new anchor.BN(10 * anchor.web3.LAMPORTS_PER_SOL);

    try {
      await program.methods
        .withdraw(excessiveAmount)
        .accounts({ signer: signer.publicKey })
        .rpc();
      expect.fail("应该报错：余额不足");
    } catch (err: any) {
      // 检查错误码是否符合合约定义的 InsufficientFunds
      expect(err.error.errorCode.code).to.equal("InsufficientFunds");
    }
  });

  it("5. 尝试在有余额时关闭金库 (Should Fail)", async () => {
    try {
      await program.methods
        .close()
        .accounts({ signer: signer.publicKey })
        .rpc();
      expect.fail("应该报错：金库不为空");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("VaultNotEmpty");
    }
  });

  it("6. 清空资金并关闭金库 (Final Cleanup)", async () => {
    // 1. 获取当前剩余所有余额并取出
    const currentBalance = await provider.connection.getBalance(vaultPda);
    await program.methods
      .withdraw(new anchor.BN(currentBalance))
      .accounts({ signer: signer.publicKey })
      .rpc();

    // 2. 调用 close 销毁 state 账户
    const tx = await program.methods
      .close()
      .accounts({ signer: signer.publicKey })
      .rpc();

    // 3. 验证 state 账户已被销毁 (AccountInfo 为 null)
    const stateInfo = await provider.connection.getAccountInfo(statePda);
    expect(stateInfo).to.be.null;

    console.log("Vault closed and rent reclaimed. Signature:", tx);
  });
});
