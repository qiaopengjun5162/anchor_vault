import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BlueshiftAnchorVault } from "../target/types/blueshift_anchor_vault";
import { expect } from "chai";

const { Keypair, LAMPORTS_PER_SOL } = anchor.web3;

describe("blueshift_anchor_vault", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .blueshiftAnchorVault as Program<BlueshiftAnchorVault>;
  const provider = anchor.getProvider();

  // Helper function to derive vault PDA
  const getVaultPDA = (signer: anchor.web3.PublicKey) => {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), signer.toBuffer()],
      program.programId,
    );
  };

  // Helper function to create a funded keypair for testing
  const createFundedKeypair = async (
    lamports: number = 2 * LAMPORTS_PER_SOL,
  ) => {
    const keypair = Keypair.generate();
    const signature = await provider.connection.requestAirdrop(
      keypair.publicKey,
      lamports,
    );
    await provider.connection.confirmTransaction(signature);
    return keypair;
  };

  it("Deposit: Successfully deposits to empty vault", async () => {
    const signer = await createFundedKeypair();
    const [vaultPDA] = getVaultPDA(signer.publicKey);

    const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

    // Get initial balances
    const initialSignerBalance = await provider.connection.getBalance(
      signer.publicKey,
    );
    const initialVaultBalance = await provider.connection.getBalance(vaultPDA);

    // Deposit - Anchor automatically resolves the vault PDA
    const tx = await program.methods
      .deposit(depositAmount)
      .accounts({
        signer: signer.publicKey,
      })
      .signers([signer])
      .rpc();

    console.log("Deposit transaction signature:", tx);

    // Verify balances
    const finalSignerBalance = await provider.connection.getBalance(
      signer.publicKey,
    );
    const finalVaultBalance = await provider.connection.getBalance(vaultPDA);

    // Vault should receive exactly the deposit amount
    expect(finalVaultBalance - initialVaultBalance).to.equal(
      depositAmount.toNumber(),
    );
    // Signer should lose at least the deposit amount (may be more due to transaction fees)
    expect(initialSignerBalance - finalSignerBalance).to.be.at.least(
      depositAmount.toNumber(),
    );
  });

  it("Deposit: Fails when vault already has funds", async () => {
    const signer = await createFundedKeypair();
    const [vaultPDA] = getVaultPDA(signer.publicKey);

    const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

    // First deposit should succeed
    await program.methods
      .deposit(depositAmount)
      .accounts({
        signer: signer.publicKey,
      })
      .signers([signer])
      .rpc();

    // Second deposit should fail
    try {
      await program.methods
        .deposit(depositAmount)
        .accounts({
          signer: signer.publicKey,
        })
        .signers([signer])
        .rpc();
      expect.fail("Should have thrown an error");
    } catch (err: any) {
      expect(err.error.errorMessage).to.equal("Vault already exists");
    }
  });

  it("Deposit: Fails when amount is too small", async () => {
    const signer = await createFundedKeypair();
    const [vaultPDA] = getVaultPDA(signer.publicKey);

    // Try to deposit a very small amount (less than rent-exempt minimum)
    const smallAmount = new anchor.BN(1000); // 1000 lamports

    try {
      await program.methods
        .deposit(smallAmount)
        .accounts({
          signer: signer.publicKey,
        })
        .signers([signer])
        .rpc();
      expect.fail("Should have thrown an error");
    } catch (err: any) {
      expect(err.error.errorMessage).to.equal("Invalid amount");
    }
  });

  it("Withdraw: Successfully withdraws all funds from vault", async () => {
    const signer = await createFundedKeypair();
    const [vaultPDA] = getVaultPDA(signer.publicKey);

    const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

    // First, deposit some funds
    await program.methods
      .deposit(depositAmount)
      .accounts({
        signer: signer.publicKey,
      })
      .signers([signer])
      .rpc();

    // Get balances before withdrawal
    const beforeWithdrawSignerBalance = await provider.connection.getBalance(
      signer.publicKey,
    );
    const beforeWithdrawVaultBalance =
      await provider.connection.getBalance(vaultPDA);

    // Withdraw
    const tx = await program.methods
      .withdraw()
      .accounts({
        signer: signer.publicKey,
      })
      .signers([signer])
      .rpc();

    console.log("Withdraw transaction signature:", tx);

    // Verify balances
    const afterWithdrawSignerBalance = await provider.connection.getBalance(
      signer.publicKey,
    );
    const afterWithdrawVaultBalance =
      await provider.connection.getBalance(vaultPDA);

    expect(afterWithdrawVaultBalance).to.equal(0);
    expect(afterWithdrawSignerBalance).to.be.greaterThan(
      beforeWithdrawSignerBalance,
    );
    // The signer should receive the vault balance minus transaction fees
    expect(
      afterWithdrawSignerBalance - beforeWithdrawSignerBalance,
    ).to.be.closeTo(beforeWithdrawVaultBalance, 0.01 * LAMPORTS_PER_SOL);
  });

  it("Withdraw: Fails when vault is empty", async () => {
    const signer = await createFundedKeypair();
    const [vaultPDA] = getVaultPDA(signer.publicKey);

    // Ensure vault is empty (new keypair, so vault should be empty)
    const vaultBalance = await provider.connection.getBalance(vaultPDA);
    expect(vaultBalance).to.equal(0);

    // Try to withdraw from empty vault
    try {
      await program.methods
        .withdraw()
        .accounts({
          signer: signer.publicKey,
        })
        .signers([signer])
        .rpc();
      expect.fail("Should have thrown an error");
    } catch (err: any) {
      expect(err.error.errorMessage).to.equal("Invalid amount");
    }
  });
});
