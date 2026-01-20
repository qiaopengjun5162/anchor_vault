use anchor_lang::prelude::*;

declare_id!("hFnPxXhvNpkzeBG5cXsCjbsJVmzshnG5ok4W8ax9gd9");

#[program]
pub mod anchor_vault {
    use anchor_lang::system_program::{transfer, Transfer};

    use super::*;

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        // 1. 业务逻辑校验：确保金额大于 0
        require_gt!(amount, 0, VaultError::InvalidAmount);

        // 2. 执行转账
        let cpi_program = ctx.accounts.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: ctx.accounts.signer.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        };

        transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

        msg!("Deposited {} lamports to vault.", amount);
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        // 1. 业务逻辑校验：检查余额是否足够
        let vault_balance = ctx.accounts.vault.lamports();
        require!(vault_balance >= amount, VaultError::InsufficientFunds);

        // 2. 准备签名种子
        let signer_key = ctx.accounts.signer.key();
        let bump = ctx.bumps.vault;
        let seeds = &[b"vault".as_ref(), signer_key.as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        // 3. 执行转账
        let cpi_program = ctx.accounts.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.signer.to_account_info(),
        };

        transfer(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds),
            amount,
        )?;

        msg!("Withdrew {} lamports from vault.", amount);
        Ok(())
    }

    pub fn close(ctx: Context<Close>) -> Result<()> {
        // 检查 vault 是否已经清空，只有空保险库才允许关闭 state 账户
        require_eq!(ctx.accounts.vault.lamports(), 0, VaultError::VaultNotEmpty);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + VaultState::INIT_SPACE,
        seeds = [b"state", signer.key().as_ref()],
        bump
    )]
    /// 校验点：确保这个 State 账户归属于当前签名者
    pub state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"vault", signer.key().as_ref()],
        bump
    )]
    /// 校验点：Anchor 会自动校验生成的 PDA 是否匹配 seeds
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        // 校验点：必须是之前初始化过的 state 账户
        seeds = [b"state", signer.key().as_ref()],
        bump,
    )]
    pub state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"vault", signer.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"state", signer.key().as_ref()],
        bump,
        close = signer
    )]
    pub state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"vault", signer.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct VaultState {}

#[error_code]
pub enum VaultError {
    #[msg("Deposit amount must be greater than 0.")]
    InvalidAmount,
    #[msg("Insufficient funds in the vault.")]
    InsufficientFunds,
    #[msg("Vault is not empty.")]
    VaultNotEmpty,
}
