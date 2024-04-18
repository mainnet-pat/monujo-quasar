import { defineStore } from "pinia"
import { ref, computed, shallowRef } from 'vue'
import { MoneroWalletFull } from "monero-ts"
import { BalanceResponse } from "src/interfaces/interfaces"
import { getServer } from "src/utils/utils"

export const explorerUrlMainnet = "https://xmrchain.net";
export const explorerUrltestnet = "https://testnet.xmrchain.net";

export const useStore = defineStore('store', () => {
  // Wallet State
  const wallet = shallowRef(undefined as MoneroWalletFull | undefined);
  const balance = ref(undefined as (BalanceResponse | undefined));
  const unlockedBalance = ref(undefined as (BalanceResponse | undefined));
  const network = ref(localStorage.getItem("network") ?? "mainnet" as string);
  const server = ref(getServer(network.value) as string | undefined);
  const explorerUrl = computed(() => network.value === "mainnet" ? explorerUrlMainnet : explorerUrltestnet);
  const walletAddress = ref(undefined as string | undefined);
  const mnemonic = ref(undefined as string | undefined);
  const exchangeRate = ref(undefined as number | undefined);
  const lastBlockHeight = ref(undefined as number | undefined);
  const syncStatus = ref("" as string);

  return {
    wallet,
    walletAddress,
    balance,
    unlockedBalance,
    network,
    server,
    explorerUrl,
    mnemonic,
    exchangeRate,
    lastBlockHeight,
    syncStatus,
  };
});
