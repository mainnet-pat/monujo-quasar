import { defineStore } from "pinia"
import { ref } from 'vue'
import { Core } from '@walletconnect/core'
import { Web3Wallet } from '@walletconnect/web3wallet'
import type Client from '@walletconnect/web3wallet'
import type {SessionTypes} from '@walletconnect/types'

export const useWalletconnectStore = defineStore('walletconnectStore', () => {

  const activeSessions = ref(undefined as undefined | Record<string, SessionTypes.Struct>);
  const web3wallet = ref(undefined as undefined | Client);

  async function initweb3wallet() {
    const core = new Core({
      projectId: "3fd234b8e2cd0e1da4bc08a0011bbf64"
    });

    const newweb3wallet = await Web3Wallet.init({
      core,
      metadata: {
        name: 'Monujo',
        description: 'Monujo BitcoinCash Web Wallet',
        url: 'monujo.cash/',
        icons: ['https://monujo.cash/images/favicon.ico'],
      }
    })

    web3wallet.value = newweb3wallet
    activeSessions.value = web3wallet.value.getActiveSessions();
  }


  return { web3wallet, activeSessions, initweb3wallet }
})
