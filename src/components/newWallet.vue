<script setup lang="ts">
  import { ref } from "vue"
  import { createWalletFull, MoneroNetworkType } from "monero-ts"
  import { useStore } from '../stores/store'
  import { useQuasar } from 'quasar'

  const $q = useQuasar()
  const store = useStore()

  const seedphrase = ref(undefined as (string | undefined));
  const disableButtons = ref(false);
  const restoreHeight =  ref(1 as number);
  const emit = defineEmits(['initWallet']);

  const nameWallet = "mywallet";

  async function createNewWallet() {
    disableButtons.value = true;
    const wallet = await createWalletFull({
      path: `${nameWallet}-${store.network}`,
      networkType: MoneroNetworkType.parse(store.network ?? "mainnet"),
      server: store.server,
    });
    emit('initWallet', wallet);
  }

  async function importWallet(restoreHeight: number) {
    try{
      if(!seedphrase.value) throw("Enter a seed phrase to import wallet")
      disableButtons.value = true;

      const wallet = await createWalletFull({
        seed: seedphrase.value,
        path: `${nameWallet}-${store.network}`,
        networkType: MoneroNetworkType.parse(store.network ?? "mainnet"),
        server: store.server,
        restoreHeight: restoreHeight
      });

      emit('initWallet', wallet);
    } catch (error) {
      console.log(error)
      const errorMessage = typeof error == 'string' ? error : "Not a valid seed phrase"
      $q.notify({
        message: errorMessage,
        icon: 'warning',
        color: typeof error == 'string' ? "grey-7" : "red"
      })
    }
  }
</script>

<template>
  <fieldset style="margin-top: 15px;">
    <h4><img class="icon plusIcon" src="images/plus-square.svg"> Create new wallet</h4>
    <div style="display: flex; flex-direction: row; gap: 20px;">
      <input @click="createNewWallet()" :disabled="disableButtons" class="button primary" type="button" value="Create">
      <div v-if="disableButtons" class="loader"></div>
    </div>
    <br><br>
    <hr>
    <br>
    <h4><img class="icon importIcon" src="images/import.svg"> Import existing wallet</h4>
    <div>Enter mnemonic seed phrase</div>
    <textarea v-model="seedphrase" style="resize: none;" rows="3" cols="50" placeholder="word1 word2 ..."></textarea>
    <span>Restore height: </span>
    <input v-model="restoreHeight" type="number" style="width: 100%;">
    <br>
    <div style="display: flex; flex-direction: row; gap: 20px; margin-top:15px">
      <input @click="importWallet(restoreHeight)" :disabled="disableButtons" class="button primary" type="button" value="Import">
      <div v-if="disableButtons" class="loader"></div>
    </div>
    <br><br>
  </fieldset>
</template>
