
<script setup lang="ts">
  import { ref, computed } from 'vue'
  import WC2SessionRequestDialog from 'src/components/walletconnect/WC2SessionRequestDialog.vue';
  import WC2ActiveSession from 'src/components/walletconnect/WC2ActiveSession.vue'
  import type { Web3WalletTypes } from '@walletconnect/web3wallet';
  import { getSdkError } from '@walletconnect/utils';
  import { useStore } from 'src/stores/store'
  import { useWalletconnectStore } from 'src/stores/walletconnectStore'
  import { useQuasar } from 'quasar'
  const $q = useQuasar()
  const store = useStore()
  const walletconnectStore = useWalletconnectStore()
  const web3wallet = walletconnectStore.web3wallet

  const props = defineProps<{
    dappUriUrlParam?: string
  }>()

  const dappUriInput = ref("");
  const sessionProposalWC = ref(undefined as Web3WalletTypes.SessionProposal | undefined);
  const activeSessions = computed(() => walletconnectStore.activeSessions)

  async function connectDappUriInput(){
    try {
      if(!dappUriInput.value) throw("Enter XMR WalletConnect URI");
      await web3wallet?.core.pairing.pair({ uri: dappUriInput.value });
      dappUriInput.value = "";
    } catch(error) {
      const errorMessage = typeof error == 'string' ? error : "Not a valid XMR WalletConnect URI"
      $q.notify({
        message: errorMessage,
        icon: 'warning',
        color: typeof error == 'string' ? "grey-7" : "red"
      })
    }
  }

  if (props.dappUriUrlParam) {
    try {
      await web3wallet?.core.pairing.pair({ uri: props.dappUriUrlParam });
    } catch {}
  }

  web3wallet?.on('session_proposal', wcSessionProposal);

  async function wcSessionProposal(sessionProposal: Web3WalletTypes.SessionProposal) {
    const { requiredNamespaces } = sessionProposal.params;
    if (!requiredNamespaces.xmr) {
      alert(`You are trying to connect an app from unsupported blockchain(s): ${Object.keys(requiredNamespaces).join(", ")}`);
      return;
    }

    const [chain, network] = requiredNamespaces.xmr?.chains?.[0]?.split(":") ?? [];
    if (chain !== `xmr`) {
      alert(`Rejecting connection from unsupported chain: ${chain}`);
      rejectSession(sessionProposal.params.id);
      return;
    }

    if (network !== store.network) {
      alert(`Switch network to ${network} and retry`);
      rejectSession(sessionProposal.params.id);
      return;
    }

    sessionProposalWC.value = sessionProposal;
  }

  async function approveSession(sessionProposal: any){
    const namespaces = {
      xmr: {
        methods: [
          "xmr_getAddresses",
          "xmr_getBalance",
          "xmr_getUnlockedBalance",
          "xmr_getBalances",
          "xmr_signTransaction",
          "xmr_signMessage",
        ],
        chains: [`xmr:${store.network}`],
        events: [ "addressesChanged" ],
        accounts: [`xmr:${store.network}:${store.walletAddress}`],
      }
    }

    await web3wallet?.approveSession({
      id: sessionProposal.id,
      namespaces: namespaces,
    });

    const updatedSessions = web3wallet?.getActiveSessions();
    walletconnectStore.activeSessions = updatedSessions;
    sessionProposalWC.value = undefined;
  }

  async function rejectSession(id?: number){
    await web3wallet?.rejectSession({
      id: id ?? sessionProposalWC.value?.id ?? 0,
      reason: getSdkError("USER_REJECTED")
    });
    sessionProposalWC.value = undefined;
  }

  async function deleteSession(sessionId :string){
    await web3wallet?.disconnectSession({
      topic: sessionId,
      reason: getSdkError("USER_DISCONNECTED")
    });

    const updatedSessions = web3wallet?.getActiveSessions();
    walletconnectStore.activeSessions = updatedSessions;
  }
</script>

<template>
  <fieldset class="item">
    <legend>WalletConnect</legend>

    Connect New dApp:

    <input v-model="dappUriInput" placeholder="Wallet Connect URI" style="margin-bottom: 10px;">
    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 2rem;">
      <input @click="connectDappUriInput" type="button" class="primaryButton" id="connect" value="Connect New dApp">
      <!--<input @click="() => {}" type="button" class="primaryButton" id="send" value="Scan QR Code">-->
    </div>

    <div v-if="sessionProposalWC">
      <WC2SessionRequestDialog :sessionProposalWC="sessionProposalWC" @approve-session="(arg) => approveSession(arg)" @reject-session="rejectSession()"/>
    </div>

    <br/>

    <div v-if="activeSessions && Object.keys(activeSessions ?? {}).length">
      Active Sessions:
      <div v-for="sessionInfo in Object.values(activeSessions).reverse()" :key="sessionInfo.topic" class="wc2sessions" >
        <WC2ActiveSession :dappMetadata="sessionInfo.peer.metadata" :sessionId="sessionInfo.topic" @delete-session="(arg) => deleteSession(arg)"/>
      </div>
    </div>

  </fieldset>
</template>

<style>
  .wc2sessions:nth-child(odd) {
    background-color: azure;
  }
</style>
