<script setup lang="ts">
  import { ref, toRefs, computed } from 'vue';
  import { getSdkError } from '@walletconnect/utils';
  import type { DappMetadata, SignatureRequest, SessionRequest } from "src/interfaces/interfaces"
  import { useStore } from 'src/stores/store'
  import { useWalletconnectStore } from 'src/stores/walletconnectStore'
  import { useQuasar } from 'quasar';
  import { useWindowSize } from '@vueuse/core'
  const { width } = useWindowSize();
  const isMobile = computed(() => width.value < 480)

  const $q = useQuasar()
  const store = useStore()
  const walletconnectStore = useWalletconnectStore()
  const web3wallet = walletconnectStore.web3wallet
  const emit = defineEmits(['signedMessage', 'rejectMessage']);

  const showDialog = ref(true);

  const props = defineProps<{
    dappMetadata: DappMetadata,
    signatureRequestWC: SessionRequest<SignatureRequest>
  }>()

  const { signatureRequestWC } = toRefs(props);

  const { id, topic, params } = signatureRequestWC.value;
  const { message, userPrompt } = toRefs(params.request.params);

  async function signMessageWC() {
    const signedMessage = await store.wallet?.signMessage(message.value);
    const response = { id, jsonrpc: '2.0', result: signedMessage };
    await web3wallet?.respondSessionRequest({ topic, response });

    emit('signedMessage', signedMessage);
  }

  async function rejectMessage(){
    const response = { id, jsonrpc: '2.0', error: getSdkError('USER_REJECTED') };
    await web3wallet?.respondSessionRequest({ topic, response });
    emit('rejectMessage')
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    $q.notify({
      message: "Copied to clipboard",
      icon: 'done',
      color: "yellow-10",
      timeout: 1
    });
  }
</script>

<template>
  <q-dialog v-model="showDialog" persistent transition-show="scale" transition-hide="scale">
    <q-card>
      <fieldset class="dialogFieldsetTxRequest">
        <legend style="font-size: large;">Sign Message</legend>
        <div style="font-size: large; margin-top: 2rem;">Origin:</div>
        <div style="display: flex;">
          <img :src="dappMetadata.icons[0]" style="display: flex; height: 55px; width: 55px;">
          <div style="margin-left: 10px;">
            <div>{{ dappMetadata.name }}</div>
            <a :href="dappMetadata.url" target="_blank">{{ dappMetadata.url.replace("https://", "") }}</a>
          </div>
        </div>
        <hr style="margin-top: 2rem;">

        <div class="wc-modal-details">
          <div style="display: flex; justify-content: center; font-size: larger;">{{ userPrompt }}</div>
          <div style="font-size: large; margin-top: 2rem;">Signer:</div>
          <div style="overflow-x: hidden; text-overflow: ellipsis; display: flex; flex-direction: row; overflow-wrap: anywhere;">
            <div @click="() => copyToClipboard(store.walletAddress!)" style="overflow-x: hidden; text-overflow: ellipsis; font-size: smaller;">{{ isMobile ? `${store.walletAddress?.slice(0, 30)}...` : store.walletAddress }}</div>
          </div>
          <div style="font-size: large; margin-top: 2rem;">Message:</div>
          <div @click="() => copyToClipboard(message)" style="overflow-wrap: anywhere; font-size: smaller;">{{ message }}</div>
          <hr style="margin-top: 3rem;" />
          <div class="wc-modal-bottom-buttons">
            <input type="button" class="primaryButton" value="Sign" @click="() => signMessageWC()" v-close-popup>
            <input type="button" value="Cancel" @click="() => rejectMessage()" v-close-popup>
          </div>
        </div>
      </fieldset>
    </q-card>
  </q-dialog>
</template>

<style>
  .dialogFieldsetTxRequest{
    padding: .5rem 2rem;
    width: 500px;
    max-height: 90vh;
    background-color: white;
    overflow: auto;
  }
  .q-dialog__backdrop {
    backdrop-filter: blur(24px);
    background-color: transparent;
    pointer-events: all  !important;
  }
  .q-card{
    box-shadow: none;
    background: none;
  }
  .wc-modal-details {
    font-size: smaller;
  }
  .wc-modal-heading {
    font-weight: 700;
  }
  .wc-data-table tbody td {
    padding-right: .3em;
  }
  td {
    padding: 0;
  }
  .wc-modal-bottom-buttons {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
    margin-bottom: 2rem;
    gap: 10px;
  }
  .wc-modal-bottom-buttons > input {
    width: 111px;
  }
  .thisWalletTag{
    color: var(--color-primary);
  }

  @media only screen and (max-width: 570px) {
    .dialogFieldsetTxRequest{
      width: 100%;
    }
    .thisWalletTag{
      display: block;
    }
  }
</style>
