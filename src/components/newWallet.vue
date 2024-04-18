<script setup lang="ts">
  import { ref } from "vue"
  import { createWalletFull, MoneroNetworkType } from "monero-ts"
  import { useStore } from '../stores/store'
  import { useQuasar } from 'quasar'

  const $q = useQuasar()
  const store = useStore()

  const seedphrase = ref(undefined as (string | undefined));
  const restoreHeight =  ref(1 as number);
  const emit = defineEmits(['initWallet']);

  const nameWallet = "mywallet";

  async function createNewWallet() {
    const mainnetWallet = await createWalletFull({
      path: `${nameWallet}-${store.network}`,
      networkType: MoneroNetworkType.parse(store.network ?? "mainnet"),
      server: store.server,
    });
    emit('initWallet', mainnetWallet);
  }

  async function importWallet(restoreHeight: number) {
    try{
      if(!seedphrase.value) throw("Enter a seed phrase to import wallet")

      const mainnetWallet = await createWalletFull({
        seed: seedphrase.value,
        path: `${nameWallet}-${store.network}`,
        networkType: MoneroNetworkType.parse(store.network ?? "mainnet"),
        server: store.server,
        restoreHeight: restoreHeight
      });

      emit('initWallet', mainnetWallet);
    } catch (error) {
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
    <input @click="createNewWallet()" class="button primary" type="button" value="Create">
    <br><br>
    <hr>
    <br>
    <h4><img class="icon importIcon" src="images/import.svg"> Import existing wallet</h4>
    <div>Enter mnemonic seed phrase</div>
    <textarea v-model="seedphrase" style="resize: none;" rows="3" cols="50" placeholder="word1 word2 ..."></textarea>
    <span>Restore height: </span>
    <input v-model="restoreHeight" type="number" style="width: 100%;">
    <br>
    <input @click="importWallet(restoreHeight)" class="button primary" type="button" style="margin-top:15px" value="Import">
    <br><br>
  </fieldset>
</template>
