<script setup lang="ts">
  import { ref, toRefs } from 'vue';
  import { getSdkError } from '@walletconnect/utils';
  import type { DappMetadata, TransactionRequest, SessionRequest } from "src/interfaces/interfaces"
  import { useStore } from 'src/stores/store'
  import { useWalletconnectStore } from 'src/stores/walletconnectStore'
  import { convert, parseExtendedJson } from 'src/utils/utils'
  import { stringify } from '@bitauth/libauth';
  import { useQuasar } from 'quasar';
  import { MoneroTxWallet } from "monero-ts";
  const $q = useQuasar()
  const store = useStore()
  const walletconnectStore = useWalletconnectStore()
  const web3wallet = walletconnectStore.web3wallet
  const emit = defineEmits(['signedTransaction', 'rejectTransaction']);

  const showDialog = ref(true);

  const props = defineProps<{
    dappMetadata: DappMetadata,
    transactionRequestWC: SessionRequest<TransactionRequest>
  }>()
  const { transactionRequestWC } = toRefs(props);

  const abs = (value: bigint) => (value < 0n) ? -value : value;

  const piconeroToXMRString = (amount:bigint) => {
    const numberAmount = Number(amount);
    if (Math.abs(numberAmount / (10 ** 3)) > 1000) {
      const bchAmount = numberAmount * (10 ** -12)
      return `${bchAmount.toFixed(8)} XMR`
    } else {
      return `${numberAmount} piconero`
    }
  };

  async function convertToUsd(satAmount: bigint) {
    const newUsdValue = convert(Number(satAmount), "piconero", "usd", store.exchangeRate!);
    return Number(newUsdValue.toFixed(2));
  }

  const { id, topic } = transactionRequestWC.value;
  const requestParams = parseExtendedJson(stringify(transactionRequestWC.value.params.request.params, 0)) as TransactionRequest;
  let draftTransaction!: MoneroTxWallet;
  try {
    draftTransaction = await store.wallet!.createTx({
      ...requestParams.transaction,
      relay: false,
      accountIndex: 0, // override
      subaddressIndex: 0, // override
    });
  } catch (error: any) {
    console.log(error);

    $q.notify({
      message: "WalletConnect: Failed to create transaction: " + error.message,
      icon: 'error',
      color: "red-4",
      timeout: 10000,
      multiLine: false,
      group: false,
    });

    const response = { id, jsonrpc: '2.0', error: getSdkError('USER_REJECTED') };
    await web3wallet?.respondSessionRequest({ topic, response });
    emit('rejectTransaction');
  }

  const bchSpentInputs: bigint = draftTransaction?.incomingTransfers?.reduce((total:bigint, transfer:any) => total + (transfer.address == store?.walletAddress ? transfer.amount : 0n), 0n) ?? 0n;
  const bchReceivedOutputs: bigint = draftTransaction?.outgoingTransfer?.destinations?.reduce((total:bigint, destination:any) => total + (destination.address !== store?.walletAddress ? destination.amount : 0n), 0n);
  const bchBalanceChange = bchSpentInputs - bchReceivedOutputs;
  const usdBalanceChange = await convertToUsd(bchBalanceChange);

  const xmrFee = draftTransaction?.fee;
  const usdFee = await convertToUsd(draftTransaction?.fee);

  async function signTransactionWC() {
    const signedTxObject = { signedTransaction: draftTransaction?.metadata, signedTransactionHash: draftTransaction?.hash };

    // send transaction
    const response = { id, jsonrpc: '2.0', result: signedTxObject };
    if (requestParams.broadcast) {
      await store.wallet?.relayTx(draftTransaction?.metadata);
    }
    await web3wallet?.respondSessionRequest({ topic, response });

    emit('signedTransaction', signedTxObject.signedTransactionHash);
  }

  async function rejectTransaction(){
    const response = { id, jsonrpc: '2.0', error: getSdkError('USER_REJECTED') };
    await web3wallet?.respondSessionRequest({ topic, response });
    emit('rejectTransaction');
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
        <legend style="font-size: large;">Sign Transaction</legend>
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
          <div style="display: flex; justify-content: center; font-size: larger;"> {{ requestParams.userPrompt }}</div>
          <div v-if="draftTransaction?.incomingTransfers" class="wc-modal-heading">Inputs:</div>
          <table class="wc-data-table">
            <tbody v-for="(transfer, transferIndex) in draftTransaction?.incomingTransfers ?? []" :key="transferIndex">
              <tr>
                <td>{{ transferIndex }}</td>
                <td>
                  {{ transfer.address.slice(0,20)  + '...' }}
                  <span v-if="transfer.address === store?.walletAddress" class="thisWalletTag">
                    (this wallet)
                  </span>
                </td>
                <td>{{ piconeroToXMRString(transfer.amount) }}</td>
              </tr>
            </tbody>
          </table>
          <div>
          </div>
          <div class="wc-modal-heading">Outputs:</div>
          <table class="wc-data-table">
            <tbody v-for="(destination, destinationIndex) in draftTransaction?.outgoingTransfer.destinations" :key="destinationIndex">
              <tr>
                <td style="font-weight: 500;">{{ destinationIndex }}</td>
                <td @click="() => copyToClipboard(destination.address)">
                  {{ destination.address.slice(0,20)  + '...' }}
                  <span v-if="destination.address === store?.walletAddress" class="thisWalletTag">
                    (this wallet)
                  </span>
                </td>
                <td>{{ piconeroToXMRString(destination.amount) }}</td>
              </tr>
            </tbody>
          </table>
          <hr>
          <div v-if="bchBalanceChange !== 0n" class="wc-modal-heading">Balance Change:</div>
          <div v-if="bchBalanceChange !== 0n">
            {{ bchBalanceChange > 0 ? '+ ': '- '}} {{ piconeroToXMRString(abs(bchBalanceChange)) }}
            ({{ usdBalanceChange }}$)
          </div>
          <div class="wc-modal-heading">Fee:</div>
          <div>
            {{ piconeroToXMRString(abs(xmrFee)) }}
            ({{ usdFee }}$)
          </div>
          <div class="wc-modal-bottom-buttons">
            <input type="button" class="primaryButton" value="Sign" @click="() => signTransactionWC()" v-close-popup>
            <input type="button" value="Cancel" @click="() => rejectTransaction()" v-close-popup>
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
