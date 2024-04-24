import type { Web3WalletTypes } from '@walletconnect/web3wallet';
import { Verify } from "@walletconnect/types";
import { MoneroTxConfig } from 'monero-ts';

export interface BalanceResponse {
  xmr: number;
  piconero: number;
  usd: number;
}

export interface DappMetadata {
  description: string,
  icons: string[]
  name: string,
  url: string
}

export type SessionRequest<T> = Web3WalletTypes.BaseEventArgs<{
  request: {
      method: string;
      params: T;
  };
  chainId: string;
}> & {
  verifyContext: Verify.Context;
};

export interface TransactionRequest {
  transaction: Partial<MoneroTxConfig>,
  broadcast: boolean,
  userPrompt: string,
}

export interface SignatureRequest {
  message: string,
  userPrompt: string,
}
