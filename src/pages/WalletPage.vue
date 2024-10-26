<script setup lang="ts">
  import newWalletView from 'src/components/newWallet.vue'
  import walletView from 'src/components/wallet.vue'
  import settingsMenu from 'src/components/settingsMenu.vue'
  import connectView from 'src/components/walletConnect.vue'
  import WC2TransactionRequest from 'src/components/walletconnect/WC2TransactionRequest.vue';
  import WC2SignatureRequest from 'src/components/walletconnect/WC2SignatureRequest.vue';
  import { ref, computed } from 'vue'
  import { useRouter } from 'vue-router'
  import type { Web3WalletTypes } from '@walletconnect/web3wallet';
  import { useStore } from 'src/stores/store'
  import { useSettingsStore } from 'src/stores/settingsStore'
  import { useWalletconnectStore } from 'src/stores/walletconnectStore'
  import { BalanceResponse } from 'src/interfaces/interfaces';
  import { stringifyExtendedJson } from 'src/utils/utils';
  import { MoneroNetworkType, MoneroWalletFull, MoneroWalletListener, createWalletFull } from 'monero-ts'
  import { useWindowSize } from '@vueuse/core'
  const router = useRouter()
  const store = useStore()
  const settingsStore = useSettingsStore()
  const walletconnectStore = useWalletconnectStore()
  const { width } = useWindowSize();
  const isMobile = computed(() => width.value < 480)

  const props = defineProps<{
    uri: string | undefined,
    hash: string | undefined,
  }>()

  const nameWallet = 'mywallet';
  let cancelWatchWallet: undefined | (() => Promise<void>);

  const displayView = ref(undefined as (number | undefined));
  const transactionRequestWC = ref(undefined as Web3WalletTypes.SessionRequest | undefined);
  const signatureRequestWC = ref(undefined as any);
  const dappMetadata = ref(undefined as any);
  const dappUriUrlParam = ref(undefined as undefined|string);

  // check if wallet exists
  const mainnetWalletExists = await MoneroWalletFull.walletExists(`${nameWallet}-mainnet`, undefined);
  const testnetWalletExists = await MoneroWalletFull.walletExists(`${nameWallet}-testnet`, undefined);
  const walletExists = mainnetWalletExists || testnetWalletExists;
  if (walletExists) {
    // initialise wallet on configured network
    const initWallet = await MoneroWalletFull.openWallet({
      path: `${nameWallet}-${store.network}`,
      server: store.server,
      networkType: MoneroNetworkType.parse(store.network ?? (mainnetWalletExists ? "mainnet" : "testnet")),
    });
    setWallet(initWallet);
  }

  function changeView(newView: number){
    displayView.value = newView;
  }

  async function setWallet(newWallet: MoneroWalletFull){
    changeView(1);
    store.wallet = newWallet;
    store.walletAddress = await newWallet.getPrimaryAddress();
    store.network = MoneroNetworkType.toString(await newWallet.getNetworkType());
    store.mnemonic = await newWallet.getSeed();
    console.time('initweb3wallet');
    await walletconnectStore.initweb3wallet();
    console.timeEnd('initweb3wallet');
    const web3wallet = walletconnectStore.web3wallet;
    web3wallet?.on('session_request', async (event) => wcRequest(event));
    // check if session request in URL params
    if(props?.hash?.startsWith('#/wc/wc?uri=')){
      router.replace('/');
      dappUriUrlParam.value = props.hash?.replace('#/wc/wc?uri=', '');
      changeView(4);
    }
    // fetch wallet balance
    console.time('Balance Promises');
    const promiseWalletBalance = store.wallet.getBalance(0, 0);
    const promiseunlockedBalance = store.wallet.getUnlockedBalance(0, 0);
    const promiseLastBlockHeight = store.wallet.getDaemonHeight();
    const promiseExchangeRate = fetch("https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=usd", {});
    const promises = [promiseWalletBalance,promiseunlockedBalance,promiseExchangeRate,promiseLastBlockHeight];
    const [resultWalletBalance, resultunlockedBalance, exchangeRateResponse, lastBlockHeight] = await Promise.all(promises);
    store.lastBlockHeight = lastBlockHeight as number;
    const exchangeRate = await (exchangeRateResponse as Response).json();
    store.exchangeRate = exchangeRate.monero.usd;
    console.timeEnd('Balance Promises');
    // fetch token balance
    store.balance = {
      piconero: Number(resultWalletBalance),
      xmr: Number(resultWalletBalance) / 1e12,
      usd: Number(resultWalletBalance) * exchangeRate.monero.usd,
    } as BalanceResponse

    store.unlockedBalance = {
      piconero: Number(resultunlockedBalance),
      xmr: Number(resultunlockedBalance) / 1e12,
      usd: Number(resultWalletBalance) * exchangeRate.monero.usd,
    } as BalanceResponse;
    setUpWalletSubscriptions();
  }

  async function setUpWalletSubscriptions(){
    store.wallet?.addListener(new class extends MoneroWalletListener {
      async onSyncProgress(height: number, _startHeight: number, endHeight: number, percentDone: number) {

        let update = false;
        let save = false;
        const distance = endHeight - height;
        // if (distance >= 1000 && distance % 1000 === 0) {
        //   update = true;
        // } else
        if (distance < 10) {
          update = true;
        } else if (distance <= 100 && (height % 10 === 0)) {
          update = true;
        } else if (distance <= 1000 && (height % 100 === 0)) {
          update = true;
        } else if (distance <= 10000 && (height % 1000 === 0)) {
          update = true;
        }
        if (height % 1000 === 0) {
          update = true;
        }

        if (height % 5000 === 0) {
          save = true;
        }

        if (!store.syncStatus) {
          update = true;
        }

        if ((save) || percentDone === 1) {
          console.log("saving at height", height)
          await store.wallet?.stopSyncing();
          await store.wallet?.save();
          await store.wallet?.startSyncing(15000);
        }

        if (update) {
          store.syncStatus = percentDone === 1 ? "Synced" : `Syncing ${height}/${endHeight}`;
        } else if (percentDone === 1) {
          const [balance, unlockedBalance] = await Promise.all([store.wallet!.getBalance(0, 0), store.wallet!.getUnlockedBalance(0, 0)]);
          await this.onBalancesChanged(balance, unlockedBalance);

          store.syncStatus = "Synced";
          await store.wallet?.stopSyncing();
          await store.wallet?.save();
          await store.wallet?.startSyncing(15000);
        }
      }

      async onBalancesChanged(newBalance: bigint, newUnlockedBalance: bigint) {
        store.balance = {
          piconero: Number(newBalance),
          xmr: Number(newBalance) / 1e12,
          usd: Number(newBalance) * (store.exchangeRate ?? 0),
        } as BalanceResponse
        store.unlockedBalance = {
          piconero: Number(newUnlockedBalance),
          xmr: Number(newUnlockedBalance) / 1e12,
          usd: Number(newUnlockedBalance) * (store.exchangeRate ?? 0),
        } as BalanceResponse
      }

      async onNewBlock(height: number) {
        store.lastBlockHeight = height;
      }
    });

    cancelWatchWallet = async () => {
      await store.wallet?.stopSyncing();
      await store.wallet?.removeListener(store.wallet?.getListeners()[0]);
    }

    await store.wallet?.startSyncing(15000);
  }

  async function changeNetwork(newNetwork: 'mainnet' | 'testnet', server: string){
    // cancel active listeners
    if(cancelWatchWallet){
      await cancelWatchWallet()
    }

    const seed = await store.wallet?.getSeed();

    await store.wallet?.close(true);

    let newWallet: MoneroWalletFull;
    if (await MoneroWalletFull.walletExists(`${nameWallet}-${store.network}`, undefined)) {
      newWallet = await MoneroWalletFull.openWallet({
        path: `${nameWallet}-${store.network}`,
        server: server,
        networkType: MoneroNetworkType.parse(store.network ?? "mainnet"),
      });
    } else {
      newWallet = await createWalletFull({
        seed: seed,
        path: `${nameWallet}-${store.network}`,
        server: server,
        networkType: MoneroNetworkType.parse(store.network ?? "mainnet"),
      });
    }
    setWallet(newWallet);
    localStorage.setItem('network', newNetwork);
    // reset wallet to default state
    store.balance = undefined;
    store.unlockedBalance = undefined;
    changeView(1);
  }

  // Wallet connect dialog functionality
  async function wcRequest(event: Web3WalletTypes.SessionRequest) {
    const web3wallet = walletconnectStore.web3wallet;
    if(!web3wallet) return
    const { topic, params, id } = event;
    const { request } = params;
    const method = request.method;
    const walletAddress = await store.wallet?.getPrimaryAddress();

    switch (method) {
      case "xmr_getAddresses":
      case "xmr_getAccounts": {
        const result = [walletAddress];
        const response = { id, jsonrpc: '2.0', result };
        web3wallet.respondSessionRequest({ topic, response });
      }
        break;
      case "xmr_getBalance": {
        const result = JSON.parse(stringifyExtendedJson(await store.wallet?.getBalance(0, 0)));
        const response = { id, jsonrpc: '2.0', result };
        web3wallet.respondSessionRequest({ topic, response });
      }
        break;
      case "xmr_getUnlockedBalance": {
        const result = JSON.parse(stringifyExtendedJson(await store.wallet?.getUnlockedBalance(0, 0)));
        const response = { id, jsonrpc: '2.0', result };
        web3wallet.respondSessionRequest({ topic, response });
      }
        break;
      case "xmr_getBalances": {
        const balance = await store.wallet?.getBalance(0, 0);
        const unlocked = await store.wallet?.getUnlockedBalance(0, 0);
        const response = { id, jsonrpc: '2.0', result: JSON.parse(stringifyExtendedJson({
          balance: balance,
          unlocked: unlocked,
        })) };
        web3wallet.respondSessionRequest({ topic, response });
      }
        break;
      case "xmr_signMessage":
      case "personal_sign":
      case "xmr_signTransaction": {
        const sessions = web3wallet.getActiveSessions();
        const session = sessions[topic];
        if (!session) return;
        const metadataDapp = session.peer.metadata;
        dappMetadata.value = metadataDapp;
        if (method === "xmr_signTransaction") {
          transactionRequestWC.value = event;
        } else {
          signatureRequestWC.value = event;
        }
      }
        break;
      default:{
        const response = { id, jsonrpc: '2.0', error: {code: 1001, message: `Unsupported method ${method}`} };
        await web3wallet.respondSessionRequest({ topic, response });
      }
    }
  }
  // Reset transactionRequestWC after sign or reject
  function signedTransaction(txId:string){
    console.log("Transaction succesfully sent! Txid:" + txId)
    transactionRequestWC.value = undefined;
  }
  function rejectTransaction(){
    console.log("Transaction rejected");
    transactionRequestWC.value = undefined;
  }
  // Reset signatureRequestWC after sign or reject
  function signedMessage(message:string){
    console.log("Message succesfully signed! Message:" + message)
    signatureRequestWC.value = undefined;
  }
  function rejectMessage(){
    console.log("Message rejected");
    signatureRequestWC.value = undefined;
  }
</script>

<template>
  <header>
    <!-- ᗰOᑎᑌᒍO logo font https://www.fontspace.com/evil-typewriter-font-f86236 -->
    <img :src="settingsStore.darkMode? 'images/monujo-logo.png' : 'images/monujo-logo.png'" alt="Monujo: a Monero Web Wallet" style="height: 85px;" >
    <span class="primaryColor" style="font-size: x-large">Monero Web Wallet</span>
    <nav v-if="displayView" style="display: flex; justify-content: center;" class="tabs">
      <div @click="changeView(1)" v-bind:style="displayView == 1 ? {color: 'var(--color-primary'} : ''">XMR Wallet</div>
      <div @click="changeView(4)" v-bind:style="displayView == 4 ? {color: 'var(--color-primary'} : ''">{{isMobile?  "Connect" : "WalletConnect"}}</div>
      <div @click="changeView(5)">
        <img style="vertical-align: text-bottom;" v-bind:src="displayView == 5 ? 'images/settingsActive.svg' :
          settingsStore.darkMode? 'images/settingsLightGrey.svg' : 'images/settings.svg'">
      </div>
    </nav>
  </header>
  <main style="margin: 20px auto; max-width: 78rem;">
    <newWalletView v-if="!store.wallet" @init-wallet="(arg) => setWallet(arg)"/>
    <walletView v-if="displayView == 1"/>
    <connectView v-if="displayView == 4" :dappUriUrlParam="dappUriUrlParam"/>
    <settingsMenu v-if="displayView == 5" @change-network="(newNetwork, server) => changeNetwork(newNetwork, server)" @change-view="(arg) => changeView(arg)"/>
  </main>
  <div v-if="transactionRequestWC">
    <WC2TransactionRequest :transactionRequestWC="transactionRequestWC" :dappMetadata="dappMetadata" @signed-transaction="(arg:string) => signedTransaction(arg)" @reject-transaction="rejectTransaction()"/>
  </div>
  <div v-if="signatureRequestWC">
    <WC2SignatureRequest :signatureRequestWC="signatureRequestWC" :dappMetadata="dappMetadata" @signed-message="(arg:string) => signedMessage(arg)" @reject-message="rejectMessage()"/>
  </div>
  <div style="display: flex; position: absolute; bottom: 0px; right: 10px; flex-direction: column;">
    <span style="text-align: end;">
    Brought to you by
      <a href="https://x.com/mainnet_pat" style="margin-left: 0.5rem;">mainnet_pat</a>
    </span>
    <span style="text-align: end;">Donations are welcome ❤️ 89cajfVxGiPX1Fnhjo3zTkMfnU22WbaqHGK8Ef2TxnAM7kE47JWri2v7gctGmJakd7cTq2R8eHRfPF73LWsYyQCRBRM61Hn</span>
  </div>
</template>
